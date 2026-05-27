# PixlPlayground Engine — Plan

Ordem priorizada de ataque, derivada da review feita em `claude/review-codex-engine-I1E8y` (2026-05-20/21).

Pré-requisito de leitura: [`engine/ARCHITECTURE.md`](./ARCHITECTURE.md). A arquitetura define a separação 2D/3D (dois runtimes paralelos, nunca misturados no bundle), o sistema de update via [`engine.versions.json`](./engine.versions.json) e a regra "scene.kind dirige tudo".

## Versões abençoadas (target)

Manifest em [`engine/engine.versions.json`](./engine.versions.json):

- **3D runtime:** Three.js `0.184.0`, R3F `9.6.1`, Drei `10.7.7`, Rapier React `2.2.0`, `@dimforge/rapier3d-compat 0.19.3`
- **2D runtime:** Phaser `4.1.0` (GA), `@dimforge/rapier2d-compat 0.19.3`
- **UI:** React `19.2.3`

**Status (2026-05-22, session 2):** todas as deps do `engine/apps/studio/package.json` já casam com o manifest. Item 4 abaixo está efetivamente concluído (typecheck zerado); restam só os ítems "verificar PhaserViewport2D em runtime" e "decidir destino de @mediapipe/* e @mlc-ai/web-llm".

## 1. Tornar `PixlSceneDocument` a fonte de verdade

Hoje o adapter empurra o `SceneObject` legacy inteiro como `data.editorObject` dentro de cada `PixlSceneObject`, e no caminho de volta o blob vence os `components` estruturados. Resultado: os `components` são cosmético.

Acceptance:
- `editorProjectAdapter.ts` não escreve mais `data.editorObject`.
- `useEditorStore` opera sobre `PixlSceneDocument` (ou um adaptador equivalente que leia do schema, não de `SceneObject[]` paralelo).
- `pixl-engine validate apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json` reporta **0 warnings** (hoje reporta 34, um por objeto).
- Componentes faltantes (`pixl.camera`, `pixl.light`, `pixl.player`, etc.) ganham tipos no schema em vez de viajar como campos de `SceneObject`.

Progress (2026-05-27):
- ✅ `editorProjectAdapter.ts` já não escreve `data.editorObject`; os round-trips do Studio preservam dados/componentes estruturados e removem blobs legacy.
- ✅ Auditoria de invariantes de documento adicionada no Studio e no CLI: `data.editorObject` agora é detectado em objetos raiz e filhos por um contrato dedicado, usado por Build Settings e `pixl-engine validate`.
- ✅ `pixl-engine validate` nos samples locais `magic-battleground-2d`, `harvest-rush-3d` e `sample-2d` reporta OK / 0 warnings com a nova auditoria.
- ✅ `createActiveProjectDocumentSnapshot` virou a API comum para Runtime Preview, Build Settings e `.pixl` package exportarem o documento ativo com assinatura de conteúdo estável; autosave agora escuta assets do projeto e `scene.kind`, então imports/moves 2D entram no `PixlProjectDocument` sem depender de outra edição na cena.

- Project diagnostics virou uma superficie reutilizavel do Studio (`createProjectDiagnostics` / `createActiveProjectDiagnosticsSnapshot`): o Header mostra status compacto da engine e Build Settings consome o mesmo contrato agrupado por runtime, cena, assets e schema.
- Engine Console no Bottom Panel agora consome os mesmos diagnosticos da engine como mensagens filtraveis, com origem (`Runtime`, `Scene`, `Assets`, `Schema`) e path do documento para depurar projetos como uma surface de editor.
- Diagnosticos que apontam para `rootObjects` agora carregam alvo de cena/objeto; clicar numa linha do Engine Console seleciona o objeto afetado no editor/Inspector, aproximando o fluxo de debug de um console de engine.
- Inspector ganhou uma stack de `Components` com catalogo 2D/3D/shared e fluxo `Add Component`/enable/remove baseado em `SceneObject.components`, aproximando o objeto do contrato `PixlSceneDocument` em vez de depender so de campos legacy.
- A stack de `Components` agora edita campos escalares (`string`, `number`, `boolean`, cor) diretamente no Inspector, mantendo arrays/objetos complexos como resumo somente-leitura para preservar dados estruturados sem forcar JSON bruto no fluxo comum.
- Operacoes de componente (`add/update data/update enabled/remove`) viraram acoes do `editorStore`, com historico em add/remove e guards contra duplicata/no-op/scene-kind, para que Inspector e futuros atalhos/menus usem uma API de editor em vez de manipular arrays localmente.
- Hierarquia do editor agora sai como arvore real em `PixlSceneDocument.rootObjects[].children` e volta como lista plana com `parentId`; Three runtime e exporters 3D aceitam tanto o formato antigo plano quanto o formato novo aninhado.
- `editorStore` ganhou `reparentObject` com guards contra parent inexistente, self-parent e ciclos; deletes agora removem subarvores em vez de deixar filhos orfaos escondidos, e a Hierarchy expõe `Desanexar` no menu de contexto.
- Hierarchy ganhou drag-and-drop pointer-based para reparenting visual: arrastar um objeto sobre outro cria parent-child via `reparentObject`, e soltar na raiz da cena desanexa o objeto sem furar os guards do store nem depender do HTML5 drag nativo.
- Hierarchy também ganhou reorder visual por zonas de drop: topo/base da linha move objetos antes/depois do alvo via `reorderObject`, carregando subarvores como pacote e adotando o parent do alvo sem permitir ciclos.

Risco: alto. Mexe em `editorStore.ts` (1.5k linhas), `EditableObject`, gizmos, undo/redo. Precisa de Mac com browser pra QA visual.

## 2. Fechar um round-trip end-to-end com Harvest Rush 3D

O editor escreve o `project.pixlproject.json`. Nada o lê do lado do runtime — o jogo continua bootando de `apps/portal/games-src/harvest-rush-3d/src/main.js` + `public/levels/harvest-rush.level3d.json`.

Acceptance:
- Implementar `pixl-engine export-level3d <project> <out>` que regenera `harvest-rush.level3d.json` a partir do project document.
- Loop manual: mover um campo no editor → salvar → rodar export → reabrir o jogo → a mudança aparece.
- Sample documentado no `HANDOFF-MAC.md` com o comando exato.

Risco: médio. Aditivo, mas precisa rodar o runtime pra validar.

## 3. Carve-out do legacy cloud

O legado cloud já foi movido para `apps/studio/src/legacy/cloud`; o trabalho agora é manter o editor standalone sem montar/importar surfaces Pixlland quando `VITE_ENGINE_CLOUD` estiver desligado.

Acceptance:
- Mover `supabase/`, `integrations/supabase/`, `stores/authStore.ts`, `services/conflictResolution.ts`, `services/projectService.ts`, `services/projectVersioning.ts` e `hooks/useProjectAutoSave.ts` para `engine/apps/studio/src/legacy/` (ou um package separado).
- Engine sobe sem `VITE_SUPABASE_*` setados; toda a UI cloud some por trás de um feature flag `VITE_ENGINE_CLOUD=true`.

Progress (2026-05-27):
- ✅ Legacy cloud já vive em `apps/studio/src/legacy/cloud`; o modo local (`VITE_ENGINE_CLOUD` desligado) esconde a aba `Store`/Pixlland do Bottom Panel, normaliza a ordem salva das abas sem ressuscitar surfaces cloud, e mantém `Content Browser`, `UI Editor`, `Timeline` e `Console` operando no editor standalone.
- ✅ `useProjectAutoSave` virou no-op em modo local-only: o autosave/atalho legado da nuvem não instala intervalos nem listener de `Ctrl+S` quando `VITE_ENGINE_CLOUD` está desligado, deixando `useEditorAutosave` + File/Save como donos do standalone.
- ✅ A superfície Store do Bottom Panel agora vive em `apps/studio/src/legacy/cloud/components/CloudStorePane.tsx` e monta por `lazy()` apenas quando cloud está habilitado; `BottomPanel.tsx` não importa mais hooks/stores Pixlland no standalone.
- ✅ `EditorPage.tsx` deixou de importar hooks/serviços cloud diretos (`useProjectAutoSave`, `usePixllandBridge`, `useAuthStore`, `fetchProject`, `ConflictResolutionDialog`): a página usa uma ponte local no-op e carrega `LegacyCloudEditorIntegration` via `lazy()` só quando `VITE_ENGINE_CLOUD=true`.
- ✅ Smoke no Browser contra `magic-battleground-2d`: tabs locais (`Content Browser`, `UI Editor`, `Timeline`, `Console`) renderizam, `Store`/`Pixlland` não aparecem, clique em `Console` ativa o painel e não há overlay de erro.

Risco: médio. Precisa boot do editor pra confirmar.

## 4. Alinhar deps do studio com `engine.versions.json` — ✅ DONE (2026-05-22, session 2)

Concluído:
- ✅ `three@0.184.0`, `@types/three@0.184.1`, `@react-three/fiber@9.6.1`, `@react-three/drei@10.7.7`, `@react-three/rapier@2.2.0`, `@dimforge/rapier3d-compat@0.19.3`, `@dimforge/rapier2d-compat@0.19.3`, `phaser@4.1.0`, `react/react-dom@19.2.3` — todas casando 100% com [`engine.versions.json`](./engine.versions.json).
- ✅ `@enable3d/phaser-extension` removido. `tools/vendor/enable3d/` deletado.
- ✅ Typecheck baseline do studio: **0 erros** (era 95; bump de `@types/three` cobriu 94, último fix em [`editorStore.ts`](./apps/studio/src/stores/editorStore.ts) — `setActiveSceneKind` setter implementado).

Aberto / follow-ups:
- 🟡 [`apps/studio/src/components/canvas/PhaserViewport2D.tsx`](./apps/studio/src/components/canvas/PhaserViewport2D.tsx) ainda existe. Tipos compilam contra Phaser 4 mas runtime não foi smoked. Verificar quando atacar item 6 (viewport 2D real).
- 🟡 Decidir destino de `@mediapipe/camera_utils`, `@mediapipe/hands`, `@mediapipe/drawing_utils` (motion control) e `@mlc-ai/web-llm` (AI no browser) — manter no studio ou mover pro portal?
- 🟡 Verificar se há shader TSL customizado em `src/components/canvas/effects/` afetado pela mudança da TSL em Three.js 0.184. (typecheck passa, mas pode ser visual regression.)

## 5. CLI continua antes de MCP

`@pixlland/engine-cli` agora tem:
- `validate` — schema + coerência 2D/3D + leak `data.editorObject`
- `outdated` — diff projeto vs `engine.versions.json`
- `migrate` — alinha projeto com manifest, `--dry` pra preview
- `new <dir> --kind 2d|3d` — scaffold de projeto novo com manifesto pinned
- `import-level3d <src> <out>` — converte `*.level3d.json` em project doc (sem leak `editorObject`)
- `export-level3d <src> <out>` — caminho reverso; fecha o round-trip Harvest Rush
- `pack <dir> <out.pixl>` — empacota projeto em ZIP único com manifest sha256-hashado (Phase 1, 2026-05-22)
- `unpack <in.pixl> <dir>` — desempacota verificando hashes
- `inspect <in.pixl>` — lê só o manifest header (sem verificar hashes)
- `export-three <project> <out-dir>` — bundle standalone via **vite.build** + Assets/ via Vite publicDir, runtime via `Game.loadFromPixlProject` (Phase 2, 2026-05-22 sessions 3+4+5+6; migrado de esbuild pra Vite na session 4; session 5 fechou os follow-ups originais; session 6 fixou os gaps reveladas pelo smoke real). `--asset-search <dir>` pra resolver assets que vivem fora do project dir; `--skip-bundle` pra emit raw entry (debug); `--sourcemap` pra emitir `.js.map` ao lado dos chunks; `--no-minify` pra bundle inspectável.

**Smoke validation (session 6, 2026-05-22)**: `pixl-engine export-three apps/studio/public/sample-projects/harvest-rush-3d/project.pixlproject.json /tmp/harvest-three` produz bundle de 2.88 MB com 22.379 URL rewrites + 15/16 assets copiados (o 1 missing é `Scripts/harvest-rush-runtime-main.js` — runtime game script, fora do escopo do exporter atual). Servido via `python3 -m http.server 8090 --directory /tmp/harvest-three`, o farm do Harvest Rush renderiza completo end-to-end (verificado via screenshot). Zero erros no console, zero requests falhados. **Engine usável end-to-end pra projetos 3D.**

- `export-runtime <project> <out-dir>` — bundla o **game runtime real** (o JS apontado por `p.game.source.runtimeFile`), distinto do export-three (que bundla o snapshot editorial). Vite build com a entry no arquivo do game; copia siblings (`assets/`, `levels/`) verbatim. Flags `--runtime-file <path>`, `--sourcemap`, `--no-minify`. Session 7, 2026-05-22. Smoke real contra Harvest Rush: bundle de 710 KB (sem rapier — o game tem física própria), index.html minimal gerado.

**Smoke do export-runtime contra Harvest Rush (session 7)**: o comando produz bundle válido, o `main.js` do game executa, three.js inicializa, scene faz clearColor azul, o game **constrói sua HUD inteira programaticamente** (24KB de HTML gerado em `#app`). MAS **este clone não tem o subset completo de assets que o game consome em runtime**: faltam ~30+ GLBs (cars, livestock, trees: `car_001.glb`, `cow_001.glb`, `tree_001.glb`, etc.), `levels/harvest-rush.level3d.json`, e a `styles.css` canônica (stub criada em `runtime/src/styles.css` permite o build, mas a UI fica sem polish). Esses arquivos vivem no parent monorepo (`apps/portal/games-src/harvest-rush-3d/`) e não foram copiados pro standalone clone. **Engine funciona; sample é incompleto pra jogar end-to-end neste clone**. Pra jogar real: clonar o parent monorepo OU restaurar os arquivos faltantes.

Próximos comandos (precisam de design ao vivo):
- ✅ `pixl-engine export-phaser <project> <out>` — bundle 2D Phaser standalone (2026-05-27). `packages/phaser-runtime/src/Game.ts` agora tem `Game.fromPixlProject`, `loadFromPixlProject`, `play`, `pause`, `destroy` e instancia `Phaser.Game` para exports standalone. O exporter copia assets, copia `runtime/`, reescreve URLs 2D para `entry.path`, passa por Vite e usa `@pixlland/phaser-runtime`. Smoke real contra `magic-battleground-2d`: 11 assets copiados, bundle JS ~1,67 MB, canvas 960x640, 12 objetos Phaser, 14 texturas, overlay de erro desligado.
- ✅ `pixl-engine export-pixlland <project> <out.pixlbuild>` — build target unificado (2026-05-27). Detecta `scene.kind`, chama `export-three` para 3D ou `export-phaser` para 2D/hybrid, normaliza `slug`/`createdAt` do project doc de build quando faltam, e empacota o output estático com o packer `.pixl` hash-verificado. Testes cobrem rota 2D e 3D com `unpackPackage`.
- ✅ Studio Build Settings (2026-05-27). Menu `Build → Build Settings` mostra runtime ativo, targets `Three Web`, `Phaser Web` e `Pixlland`, output esperado e comandos CLI copiáveis. Smoke visual no Chrome contra `magic-battleground-2d`: modal abriu sem overlay/erro, Phaser Web e Pixlland prontos, comandos `export-phaser`/`export-pixlland` presentes.

Follow-ups do export-three:
- ✅ **Asset URL mismatch** (sessions 5+6): runtime side fechado na session 5 via `rewriteAssetUrlsInProject` (reescreve `data.modelUrl` / `data.assetPath` / `data.url` / `data.customData.sourceAsset` no project doc copiado pra apontar pra `entry.path`); file-finder side fechado na session 6 via `pushVariants(base, ref)` em `copyAssetEntry` (tenta tanto `entry.url` cru quanto `normalizeAssetPath(entry.url)`, espelhando o que o runtime faz no fetch). Sample real Harvest Rush: 22.379 rewrites + 15/16 assets copiados.
- ✅ **Sourcemap opcional** (session 5): flag `--sourcemap` no CLI, `sourcemap?: boolean` em `RunExportThreeOptions`, repassado pra `vite.build({ build: { sourcemap } })`. Default off.
- ✅ **Minify control** (session 5): flag `--no-minify` no CLI, `minify?: boolean` em `RunExportThreeOptions`. Quando explicitamente `false`, passa `minify: false` pro Vite; quando undefined, deixa o default do Vite (esbuild minify em production). Combined real-vite test cobre os dois flags juntos.
- ✅ **Code-split / hashing**: Vite faz automático — bundle live em `assets/index-<hash>.js`, cacheável.
- ✅ **Canvas bootstrap** (session 6): `buildMainJsSource` agora gera bundle que anexa `game.renderer.threeJSRenderer.domElement` ao `document.body` + registra resize handler (setSize + camera aspect update). Sem isso o canvas ficava órfão no headless e o bundle nascia "preto". 10 testes novos em [`exportThree.test.ts`](./packages/cli/src/commands/exportThree.test.ts) total nas sessions 5+6 (24 totais agora).

Risco: baixo. Aditivo, sem UI.

## 6. Família de componentes 2D no editor

Schema já tem os tipos (`PIXL_2D_COMPONENT_TYPES`, `PixlTransform2D`, `PixlSpriteComponentData`, `PixlPhysics2DComponentData`, `PixlTileMapComponentData`, `PixlAnimation2DComponentData`, `PixlCamera2DComponentData`). Falta:

Progress (2026-05-27):
- ✅ Editor adapter preserva objetos 2D (`image`, `sprite`, `rectangle`, `circle`, `text`), `data` bruto de render (ex.: `imageUrl`, frames, depth) e componentes schema como `pixl.physics2d` ao abrir/salvar.
- ✅ Projetos 2D agora setam `activeSceneKind` + viewport store para `2d` ao abrir, e novos projetos 2D usam runtime `phaser-2d` + física `arcade`.
- ✅ Content Browser / TexturePicker reconhecem assets `image`, `sprite`, `spritesheet` e `tilemap`; Inspector desktop mostra seções `Sprite 2D`, `Forma 2D` e `Texto 2D`.
- ✅ Smoke visual no Chrome contra `magic-battleground-2d`: canvas 2D visível, Inspector `Sprite 2D` com asset `Mage Ember`, sem console errors/requests 400+.
- ✅ `PhaserViewport2D` deixou de ser minimapa 3D: abre em coordenadas pixel/top-left, renderiza sprites/imagens reais, permite drag de objetos e aceita drop de assets 2D do Content Browser criando objetos `image/sprite` com componente `pixl.sprite`.
- ✅ Resolução de assets 2D em samples agora preenche `asset.url` a partir de `asset.path` sem perder `path` portátil; `makeProjectDocumentPortable` volta `/sample-projects/<slug>/...` para paths relativos.

- ✅ Inspector desktop mostra controles 2D quando `scene.kind === '2d'`.
- ✅ Content browser reconhece `.png/.atlas/.tilemap.json` como assets 2D.
- ✅ `PhaserViewport2D.tsx` agora é um editor 2D real básico — cena Phaser editável, drag de objetos e drag-and-drop de sprites.
- ✅ Asset folders 2D (`Assets/Sprites/`, `Assets/Tilemaps/`) operam no Content Browser com import/copy real para o workspace local, criação de subpastas e movimentação de assets em disco mantendo `asset.path` portátil no manifest.

Risco: médio-alto. Precisa Mac + browser; é o segundo maior bloco depois do item 1.

## 7. Editor desktop com auto-update

A meta "engine desktop que atualiza projetos junto" precisa:

- Build via **Tauri** (preferido) ou Electron — Tauri tem auto-updater nativo + bundle menor.
- Empacotar a engine + `pixl-engine` CLI no mesmo binário.
- Ao abrir projeto: chama `outdated` internamente, oferece `migrate`, com backup automático.
- Distribuição: releases GitHub do repo (mesmo já em uso pra portal).

Risco: alto. Trabalho de plataforma + DevOps + CI release pipeline. Não bloqueia desenvolvimento — engine web continua funcional. Fazer só depois dos itens 1-6.

## 8. Depois (não bloqueia nada)

- Dock manager arrastável full-Godot.
- VS Code extension / scene diagnostics.
- MCP server (depois que o CLI tiver 5-6 comandos estabilizados).
- Exporter Enable3D opt-in pra casos raros.

---

## Como medir progresso

```bash
pnpm --filter @pixlland/engine-cli build

node engine/packages/cli/dist/index.js validate \
  apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json

node engine/packages/cli/dist/index.js outdated \
  apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json
```

KPIs:

- `validate` no sample legacy do Harvest Rush reporta `34 warnings` hoje. **Pós-item 1: 0 warnings.**
- `outdated` reporta 6 deps faltando + drift de engine version no parent monorepo. **Pós-item 4 + um `migrate`: 0 drift.** (Standalone, este repo já está alinhado — sem como rodar `outdated` sem o sample do parent.)
- `import-level3d` + `export-level3d` no harvest-rush.level3d.json é **round-trip identity** hoje (22 objetos, 19 assets, schema/game/engineTarget/camera preservados). Esse é o KPI do round-trip Harvest Rush.
- **Studio typecheck baseline: 0 erros** (era 95 antes do bump de `@types/three`). Verificado nesta sessão: `pnpm --filter pixlplaygroundstudio typecheck` → exit 0.

Esses sinais são o termômetro do refactor estrutural, do alinhamento de deps e do round-trip de runtime.
