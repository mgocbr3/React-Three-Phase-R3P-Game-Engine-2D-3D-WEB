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

Risco: alto. Mexe em `editorStore.ts` (1.5k linhas), `EditableObject`, gizmos, undo/redo. Precisa de Mac com browser pra QA visual.

## 2. Fechar um round-trip end-to-end com Harvest Rush 3D

O editor escreve o `project.pixlproject.json`. Nada o lê do lado do runtime — o jogo continua bootando de `apps/portal/games-src/harvest-rush-3d/src/main.js` + `public/levels/harvest-rush.level3d.json`.

Acceptance:
- Implementar `pixl-engine export-level3d <project> <out>` que regenera `harvest-rush.level3d.json` a partir do project document.
- Loop manual: mover um campo no editor → salvar → rodar export → reabrir o jogo → a mudança aparece.
- Sample documentado no `HANDOFF-MAC.md` com o comando exato.

Risco: médio. Aditivo, mas precisa rodar o runtime pra validar.

## 3. Carve-out do legacy cloud

O `engine/apps/studio/supabase/` continua dentro do engine, e `EditorPage.tsx` ainda importa `fetchProject`, `useProjectAutoSave`, `ConflictResolutionDialog`, `useAuthStore`.

Acceptance:
- Mover `supabase/`, `integrations/supabase/`, `stores/authStore.ts`, `services/conflictResolution.ts`, `services/projectService.ts`, `services/projectVersioning.ts` e `hooks/useProjectAutoSave.ts` para `engine/apps/studio/src/legacy/` (ou um package separado).
- Engine sobe sem `VITE_SUPABASE_*` setados; toda a UI cloud some por trás de um feature flag `VITE_ENGINE_CLOUD=true`.

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
- `export-three <project> <out-dir>` — bundle standalone via **vite.build** + Assets/ via Vite publicDir, runtime via `Game.loadFromPixlProject` (Phase 2, 2026-05-22 session 3+4+5; migrado de esbuild pra Vite na session 4 pra unificar com `apps/studio` e a convenção Phaser/PlayCanvas; session 5 fechou os follow-ups). `--asset-search <dir>` pra resolver assets que vivem fora do project dir; `--skip-bundle` pra emit raw entry (debug); `--sourcemap` pra emitir `.js.map` ao lado dos chunks; `--no-minify` pra bundle inspectável.

Próximos comandos (precisam de design ao vivo):
- `pixl-engine export-phaser <project> <out>` — bundle HTML+JS Phaser 4+DOM standalone (espelho 2D do export-three)
- `pixl-engine export-pixlland <project> <out>` — bundle pronto pra upload no Pixlland

Follow-ups do export-three:
- ✅ **Asset URL mismatch** (2026-05-22 session 5): `exportProjectToThree` agora chama `rewriteAssetUrlsInProject`, que reescreve `data.modelUrl` / `data.assetPath` / `data.url` / `data.customData.sourceAsset` no project doc copiado pra apontar pra `entry.path`. Runtime normaliza (strip `public/`) e fetcha `<outDir>/<entry.path>` direto — onde o Vite publicDir colocou o binário. Round-trip de URL fica fechado. `rewriteCount` aparece no log final. 7 testes novos em [`exportThree.test.ts`](./packages/cli/src/commands/exportThree.test.ts) (6 pure + 1 IO).
- ✅ **Sourcemap opcional** (session 5): flag `--sourcemap` no CLI, `sourcemap?: boolean` em `RunExportThreeOptions`, repassado pra `vite.build({ build: { sourcemap } })`. Default off.
- ✅ **Minify control** (session 5): flag `--no-minify` no CLI, `minify?: boolean` em `RunExportThreeOptions`. Quando explicitamente `false`, passa `minify: false` pro Vite; quando undefined, deixa o default do Vite (esbuild minify em production). Combined real-vite test cobre os dois flags juntos.
- ✅ **Code-split / hashing**: Vite faz automático — bundle live em `assets/index-<hash>.js`, cacheável.

Risco: baixo. Aditivo, sem UI.

## 6. Família de componentes 2D no editor

Schema já tem os tipos (`PIXL_2D_COMPONENT_TYPES`, `PixlTransform2D`, `PixlSpriteComponentData`, `PixlPhysics2DComponentData`, `PixlTileMapComponentData`, `PixlAnimation2DComponentData`, `PixlCamera2DComponentData`). Falta:

- Inspector mostrar esses componentes quando `scene.kind === '2d'`.
- Content browser filtrar `.png/.atlas/.tilemap.json` em cenas 2D.
- Substituir `PhaserViewport2D.tsx` (minimapa do 3D) por um editor 2D real — Phaser 4 scene editável, gizmo 2D, drag-and-drop de sprites.
- Asset folders 2D (`Assets/Sprites/`, `Assets/Tilemaps/`) operando no content browser.

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
