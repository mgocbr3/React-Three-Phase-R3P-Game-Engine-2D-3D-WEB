# PixlPlayground Engine Handoff - Mac

Date: 2026-05-20
Branch used on Windows: `fix/admin-auth-and-metrics`
Active review branch: `claude/review-codex-engine-I1E8y`
Remote: `origin` -> `https://github.com/mgocbr3/pixlland-poki.git`

This handoff is for continuing PixlPlayground Studio engine work on a Mac without needing the full Codex conversation.

Update 2026-05-22: Enable3D is legacy context only. The current engine direction is Three.js for 3D runtime/editor work and Phaser 4 for 2D runtime/editor work.

> Antes de qualquer outra tarefa, leia [`engine/PLAN.md`](./PLAN.md) — ordem priorizada de ataque pós-review.

## Phase 1 done 2026-05-22 — `.pixl` package round-trip

Novo workspace package `@pixlland/engine-core` em [`engine/packages/core/`](./packages/core/). Empacota um projeto em ZIP com manifest sha256-hashado.

```bash
# CLI
pixl-engine pack    apps/portal/games-src/harvest-rush-3d/pixlplayground /tmp/harvest-rush.pixl
pixl-engine unpack  /tmp/harvest-rush.pixl /tmp/harvest-rush-restored
pixl-engine inspect /tmp/harvest-rush.pixl

# Editor
# File menu: "Open .pixl Package" / "Save as .pixl Package".
```

Validado end-to-end no Harvest Rush 3D (11.243 objetos, 60 FPS):
- CLI pack → unpack → re-pack: hash idêntico (round-trip determinístico).
- Editor save → bytes → open: 11.243 objetos preservados, mesmo hash.
- 5 testes vitest no CLI + 8 testes no `@pixlland/engine-core` (todos verdes).

Padrão de assets adaptado de `tools/vendor/three-game-engine/src/assets/` (MIT WesUnwin) — `AssetSource` aceita `string | FileSystemDirectoryHandle`, mesma API que o runtime preview vai usar quando Phase 2 (`export-three`) produzir bundles self-contained servidos do OPFS.

Notas de porting em [`engine/REFERENCE-ENGINES.md`](./REFERENCE-ENGINES.md).


## Review pass 2026-05-21 (iPhone session 3, A+B+C+D: round-trip + scaffold + Enable3D out + CI)

Continuação do PR #171. Quatro blocos:

**C — Enable3D removido do repositório.** Decisão da `ARCHITECTURE.md` cumprida:
- `@enable3d/phaser-extension` removida de `engine/apps/studio/package.json` e `apps/portal/games-src/harvest-rush-3d/package.json` (zero imports em ambos).
- Pasta `tools/vendor/enable3d/` deletada.
- A string `'enable3d'` no union `PixlPhysicsKind` no schema fica preservada — adapter opt-in pode entrar no futuro sem mudar schema.

**D — GitHub Actions CI** em `.github/workflows/engine-ci.yml`:
- Roda em push pra main e PR que mexem em `engine/**` ou no workspace.
- `pnpm engine:test` + `pnpm --filter @pixlland/engine-cli build` + CLI vitest + smoke do CLI contra Harvest Rush.
- Studio typecheck rodando informativamente (95 erros baseline; vira gate quando o item 4 do PLAN bumpar as deps).
- Antes desta sessão: zero CI no engine. Vercel preview era o único check.

**B — `pixl-engine new <dir> --kind 2d|3d [--name X]`** (scaffold):
- Cria diretório com `project.pixlproject.json` + `Assets/...` + `Scenes/` + `Scripts/` + `ProjectSettings/` + `.gitignore`.
- Lê o manifest em runtime e embeda as deps abençoadas no `engine.runtimeManifest` do projeto criado.
- Smoke: cria projeto 3D + 2D, ambos passam no `validate`. 5 testes vitest cobrem `buildProjectDocument`.

**A — `pixl-engine import-level3d` + `export-level3d`** (round-trip):
- `import-level3d <src.level3d.json> <out.pixlproject.json>` — extraído como código novo no CLI, **sem leak `data.editorObject`**. Cria objetos com componentes limpos `pixl.mesh/physics/logic`.
- `export-level3d <src.pixlproject.json> <out.level3d.json>` — caminho reverso. Filtra só objetos que tem `customData.assetKey` (i.e., originados de level3d) — exclui qualquer objeto sintético tipo câmera/sun/ground.
- **Round-trip identity comprovado contra dado real:** Harvest Rush `harvest-rush.level3d.json` (22 objetos, 19 assets) → project doc → level3d.json reconstruído. `schema`, `game`, `engineTarget`, `sourceScene`, `notes`, `camera`, `assetLibrary`, todos os objetos com `id/assetKey/layer/collider/transform` — todos preservados.
- 7 testes vitest cobrem importer + exporter + round-trip + casos de erro.

CLI cresceu de 3 pra **6 comandos** + 1 helper compartilhado:
- validate, outdated, migrate (já existiam)
- new, import-level3d, export-level3d (novos)

Tests: **27/27 vitest verdes** (era 15; +12).

Importante: o novo `import-level3d` do CLI é um **modelo de referência** pro refactor do item 1 do PLAN (`data.editorObject` leak). Ele mostra como o studio's `level3dImporter.ts` deveria ficar quando o `PixlSceneDocument` virar fonte de verdade — componentes estruturados, zero blob legacy.

Baseline preservado:
- Engine typecheck: **95 erros pré-existentes** (inalterado)
- Engine vitest: **3/3** (inalterado)
- Engine build: OK (inalterado)
- CLI vitest: **27/27** (+12)

## Review pass 2026-05-21 (iPhone session 2, arquitetura + manifest + CLI)

Continuação do PR #171, mesma branch. Foco: estabelecer fundação 2D+3D e sistema de update sem mexer no editor (zero QA visual necessário).

Novo: **manifesto de versões abençoadas** em [`engine/engine.versions.json`](./engine.versions.json). Single source of truth pras versões pinned por runtime. Verificadas direto em npm:

- 3D: Three `0.184.0`, R3F `9.6.1`, Drei `10.7.7`, @react-three/rapier `2.2.0`, @dimforge/rapier3d-compat `0.19.3`
- 2D: Phaser `4.1.0` (GA confirmado), @dimforge/rapier2d-compat `0.19.3`
- UI: React `19.2.3`, react-dom `19.2.3`

Schema estendido (aditivo, sem breaking change pro 3D atual):
- Família de componentes 2D declarada: `pixl.sprite`, `pixl.transform2d`, `pixl.physics2d`, `pixl.tilemap`, `pixl.animation2d`, `pixl.camera2d`
- Famílias 3D e compartilhados também declarados como constantes (`PIXL_3D_COMPONENT_TYPES`, `PIXL_SHARED_COMPONENT_TYPES`) — ficam disponíveis pro inspector filtrar por kind.
- Interfaces tipadas pros dados de cada componente 2D (`PixlSpriteComponentData`, `PixlPhysics2DComponentData`, etc.).
- `PixlTransform2D` (Vec2 + rotation float) ao lado do `PixlTransform` 3D existente.
- Novo campo opcional `engine.runtimeManifest` no project document (snapshot das versões usadas pra produzir aquele projeto).

CLI ampliado (de 1 pra 3 comandos):
- `validate` agora checa coerência scene.kind ↔ componentes (componente 3D em cena 2D = erro de schema).
- `outdated <project>` — compara o projeto contra o manifest da engine; reporta drift, missing, extra.
- `migrate <project> [--dry]` — alinha o projeto com o manifest (atualiza `engine.version`, `schemaVersion`, `runtimeManifest`). Backup é o próprio git; escreve no JSON original.
- Manifest loader compartilhado (`commands/manifest-loader.ts`) — DRY entre outdated e migrate.

Testes: **13/13 vitest verdes** (4 validate + 5 outdated + 4 migrate).

Smoke contra dados reais (Harvest Rush 3D project):
- `validate` → 0 erros, 34 warnings de `editorObject` leak. Inalterado.
- `outdated` → engine version `0.1.0 → 0.2.0`, 6 deps faltando no `runtimeManifest`. Era esperado: o sample foi gerado antes do manifest existir.

`engine/ARCHITECTURE.md` **reescrito do zero** com a arquitetura efetiva:
- Dois runtimes paralelos (Three+Rapier+DOM pra 3D, Phaser 4+DOM pra 2D), nunca misturados no bundle.
- UI/HUD sempre DOM React+CSS (decisão do usuário) — bundle 3D não carrega Phaser.
- Scene.kind dirige o editor: viewport, inspector, content browser.
- Enable3D oficialmente fora do roadmap padrão (opt-in pra casos raros).
- Sistema de update: project carrega seu runtimeManifest; editor compara com engine.versions.json; CLI executa migration.
- Editor desktop com auto-update: alvo Tauri, planejado pro item 7 do PLAN.

`engine/PLAN.md` atualizado: versões alvo no topo, item 4 reformulado como "alinhar deps", item 6 novo (família 2D no editor), item 7 novo (editor desktop com auto-update), KPIs adicionados (`validate warnings`, `outdated drift`).

Baseline preservado:
- Engine typecheck: **95 erros pré-existentes** (conflito `@types/three`). Inalterado.
- Engine vitest: **3/3**. Inalterado.
- Engine build: OK. Inalterado.
- CLI vitest: **13/13** (de 4, +9 novos).

Próxima sessão Mac deve atacar nesta ordem:
1. Promover `PixlSceneDocument` à fonte de verdade (matar `data.editorObject`).
2. Fechar round-trip Harvest Rush.
3. Carve-out cloud Supabase.
4. **Bump deps pro manifest** (Three 0.184, R3F 9.6.1, Phaser 4.1.0, Rapier compat 0.19.3) — provavelmente zera os 95 erros TS de baseline.
5. Construir famíılia de componentes 2D no editor (inspector + content browser).
6. Editor desktop Tauri com auto-update.

## Review pass 2026-05-20 (iPhone session, low-risk cleanup)

Mudanças mecânicas feitas **sem QA visual** (validadas por typecheck + vitest + build). Branch `claude/review-codex-engine-I1E8y`.

Removido do `engine/apps/studio/package.json` (zero usos no `src/` confirmados antes da remoção):
- `recharts`, `embla-carousel-react`, `cmdk`, `vaul`, `react-day-picker`, `input-otp`
- `lovable-tagger` (devDep). Removido também do `vite.config.ts`.

Wrappers UI órfãos deletados (nenhum import referencia):
- `src/components/ui/chart.tsx`, `carousel.tsx`, `command.tsx`, `drawer.tsx`, `calendar.tsx`, `input-otp.tsx`

**Mantido** (uso real confirmado):
- `@mediapipe/*` → `src/hooks/useHandTracking.ts` (motion control).
- `@mlc-ai/web-llm` → `src/services/ai/providers/WebLLMProvider.ts` (aiStore).
- Decisão sobre manter ou mover essas duas features pra portal está no `PLAN.md` item 4.

Limpeza de ruído em logs:
- `src/components/canvas/EditorCanvas.tsx` — removida instrumentação debug do `onPointerMissed` (rodava a cada clique).
- `src/pages/EditorPage.tsx` — removidos `console.log` informativos de carga de nuvem (toast já avisa). `console.error` mantido.

Novo workspace package: `engine/packages/cli` (`@pixlland/engine-cli`).
- Comando inicial: `pixl-engine validate <project.pixlproject.json>`.
- 4 testes vitest (`src/commands/validate.test.ts`).
- Detecta o leak `data.editorObject` no schema (warning, não erro).
- Quando rodado contra `apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json` reporta hoje **34 warnings** — vira o KPI do refactor descrito em `PLAN.md` item 1.

Baseline antes/depois desta sessão:
- Engine typecheck: **95 erros pré-existentes** (conflito `@types/three` 0.171 vs 0.184 hoistado pelo workspace). Inalterado por esta sessão.
- Engine vitest: **3/3 passa**. Inalterado.
- Engine `pnpm engine:build`: **succeeds**. Inalterado.
- CLI vitest: **4/4 passa** (novo).

Comandos de verificação:

```bash
pnpm install
pnpm engine:typecheck   # 95 erros pré-existentes, sem regressões
pnpm engine:test        # 3/3
pnpm engine:build       # OK

pnpm --filter @pixlland/engine-cli build
pnpm --filter @pixlland/engine-cli test  # 4/4

node engine/packages/cli/dist/index.js validate \
  apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json
```

Não toquei nesta sessão (precisa de Mac + browser):
- Refactor do `editorStore`/adapter pra promover `PixlSceneDocument` à fonte de verdade.
- Carve-out das pastas `supabase/`/`integrations/supabase/` etc.
- Conserto do conflito `@types/three`.
- Round-trip de Harvest Rush.
- Move/arquive da pilha de MDs do studio (decisão estética, deixa pra quando houver mais sinal).

## What This Branch Contains

- A separated engine workspace at `engine/`.
- PixlPlayground Studio app at `engine/apps/studio`.
- Root workspace wiring for `pnpm engine:*` scripts.
- Local-first project open/save flow using the browser File System Access API.
- Pixlland publish button routed to the platform submit page instead of cloud sync.
- Godot/Unreal-inspired editor chrome pass:
  - dark grey menu and toolbar contrast;
  - compact top menu;
  - `2D` / `3D` mode switch moved beside viewport gizmos;
  - dock panels with darker outlines;
  - sober icons and no emoji in the editor chrome;
  - bottom dock tabs grouped left and reorderable by drag.
- Harvest Rush 3D bridge:
  - game source stays under `apps/portal/games-src/harvest-rush-3d`;
  - PixlPlayground project document at `apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json`;
  - bundled sample copy at `engine/apps/studio/public/sample-projects/harvest-rush-3d/project.pixlproject.json`;
  - runtime level document at `apps/portal/games-src/harvest-rush-3d/public/levels/harvest-rush.level3d.json`;
  - full `Farm.glb` visible in the engine sample, not only 2D proxy boxes.
- Runtime target update:
  - Three.js owns the 3D editor/runtime path.
  - Phaser 4 owns the 2D editor/runtime path.
  - Enable3D-era notes are historical reference only.

## Mac Setup

Use Node 22+ or the repo's preferred toolchain. Then:

```bash
git fetch origin
git checkout fix/admin-auth-and-metrics
git pull --ff-only origin fix/admin-auth-and-metrics
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install
```

Run the engine:

```bash
pnpm engine:dev -- --host 127.0.0.1 --port 8082
```

Open:

```text
http://127.0.0.1:8082/editor?sampleProject=harvest-rush-3d
```

Validate:

```bash
pnpm engine:typecheck
pnpm engine:test
```

Optional build:

```bash
pnpm engine:build
```

## Where Things Live

```text
engine/
  README.md
  ARCHITECTURE.md
  SECURITY.md
  HANDOFF-MAC.md
  apps/studio/
    src/pages/EditorPage.tsx
    src/components/editor/
      EditorHeader.tsx
      EditorToolbar.tsx
      SceneGraphPanel.tsx
      InspectorPanel.tsx
      BottomPanel.tsx
      EditorStatusBar.tsx
    src/components/ui/resizable.tsx
    src/engine/project/
      schema.ts
      editorProjectAdapter.ts
      level3dImporter.ts
      editorProjectAdapter.test.ts
    src/services/
      localProjectFiles.ts
      sampleProjects.ts
    scripts/
      import-harvest-rush-project.mjs
    public/sample-projects/harvest-rush-3d/
      project.pixlproject.json

apps/portal/games-src/harvest-rush-3d/
  src/main.js
  public/levels/harvest-rush.level3d.json
  pixlplayground/project.pixlproject.json
  phaser/

tools/vendor/
  # historical third-party references only
```

## Current Architecture Decisions

1. PixlPlayground is the visual editor, not a new copy of Phaser Editor.
2. Three.js 3D and Phaser 4 2D are runtime/export targets.
3. The editor source of truth is a local `project.pixlproject.json`.
4. Runtime bundles should stay stack-specific: Three.js for 3D scenes, Phaser 4 for 2D scenes.
5. Harvest Rush 3D currently edits a visual representation of the game scene and asset layout; gameplay systems remain in the game runtime.
6. The full game scene, scripts, UI and logic are not yet round-tripped as editable engine components. That is the next big milestone.
7. Cloud/Supabase code from the original Studio exists as legacy code, but engine local mode is the default and the visible editor chrome no longer presents cloud sync as the main workflow.

## Harvest Rush 3D Workflow

Generate or refresh the PixlPlayground sample:

```bash
pnpm --filter pixlplaygroundstudio import:harvest-rush
```

Open the sample in the engine:

```text
http://127.0.0.1:8082/editor?sampleProject=harvest-rush-3d
```

Runtime game source:

```bash
cd apps/portal/games-src/harvest-rush-3d
npm install
npm run dev
```

Build and sync the game bundle through the portal script:

```bash
pnpm --filter @pixlland/portal build:harvest-rush
```

Phaser Editor Desktop bridge:

```bash
cd apps/portal/games-src/harvest-rush-3d
npm run phaser:open
npm run phaser:export-level
```

Important distinction:

- `Farm.glb` is the visual world asset.
- `harvest-rush.level3d.json` is the editable placement/metadata bridge.
- `project.pixlproject.json` is the PixlPlayground engine project file.
- `src/main.js` still owns game rules, controls, HUD and runtime simulation.

## What Works Now

- Engine opens from the monorepo with `pnpm engine:dev`.
- Harvest Rush 3D sample opens directly in the editor.
- The full farm GLB renders in the 3D viewport.
- Hierarchy shows `Farm.glb`, camera, sun and gameplay groups.
- Content Browser lists Harvest Rush assets.
- Inspector, scene graph and bottom browser are resizable docks.
- Bottom panel tabs can be reordered by dragging.
- `Open` and `Save` operate on local project folders where browser support exists.
- `Publish` opens Pixlland submission flow.
- TypeScript typecheck passes.
- Vitest passes.

## What Is Not Finished Yet

- Full Godot-style arbitrary drag-and-dock layout for every panel.
- Persistent multi-monitor/window layouts.
- Full game round-trip editing:
  - scripts as components;
  - HUD as editable UI scene;
  - gameplay state/components;
  - runtime collision volumes;
  - prefab variants.
- Proper 2D Phaser viewport editor.
- Phaser 4 exporter from `project.pixlproject.json`.
- CLI commands for validate/import/export/snapshot.
- MCP server for agents.
- VS Code extension / scene diagnostics.
- Complete removal or isolation of old Supabase/cloud source files.
- Packaged desktop app build.

## Recommended Next Milestones

1. Define the project folder contract:
   - `project.pixlproject.json`;
   - `Assets/`;
   - `Scenes/`;
   - `Scripts/`;
   - `ProjectSettings/`;
   - generated `Builds/`.
2. Build engine CLI:
   - `pixl engine validate <project>`;
   - `pixl engine import-harvest-rush`;
   - `pixl engine export-three`;
   - `pixl engine export-phaser`.
3. Implement real dock manager:
   - draggable panels;
   - split panes;
   - saved layouts;
   - reset/preset layouts from the `Window` menu.
4. Promote scene schema:
   - components registry;
   - JSON schema validation;
   - migrations between project versions.
5. Add first MCP surface:
   - inspect hierarchy;
   - move object;
   - create object;
   - validate project;
   - export diff.
6. Make Harvest Rush the test game:
   - edit tree/building/field objects in engine;
   - save project file;
   - regenerate runtime level;
   - launch runtime and verify the change.

## Validation Run On Windows

Commands run successfully:

```bash
pnpm --reporter=silent --filter pixlplaygroundstudio typecheck
pnpm --reporter=silent --filter pixlplaygroundstudio test
```

Playwright/Chrome visual check opened:

```text
http://127.0.0.1:8082/editor?sampleProject=harvest-rush-3d
```

The in-app Browser plugin failed locally because its Node runtime could not load the browser skill module, so Playwright with Chrome was used for visual QA.

## Notes For Codex / Claude Code / VS Code

Use the project document instead of editing runtime code blindly:

- scene data: `project.pixlproject.json`;
- importer/exporter code: `engine/apps/studio/src/engine/project`;
- local file IO: `engine/apps/studio/src/services/localProjectFiles.ts`;
- Harvest Rush generator: `engine/apps/studio/scripts/import-harvest-rush-project.mjs`.

Future agent-safe workflow:

1. Load project document.
2. Validate schema.
3. Make structured scene edits.
4. Emit diff.
5. Run engine validation.
6. Export runtime artifacts.
7. Run game smoke test.

## Keep Out Of Git

Do not commit:

- `node_modules/`;
- `dist/`;
- `.env.local`;
- OS/editor files;
- raw downloaded assets unless license and size are reviewed.

The repo already ignores these, including `engine/apps/studio/node_modules` and `engine/apps/studio/dist`.
