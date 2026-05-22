# @pixlland/engine-cli

Deterministic CLI for the PixlPlayground engine. Codex, Claude Code, VS Code or any agent should drive scene-document operations through this binary instead of editing the JSON blindly.

## Status

Disponíveis:
- `validate` — schema + coerência 2D/3D componentes ↔ scene.kind + leak `data.editorObject`.
- `outdated` — compara projeto contra [`engine/engine.versions.json`](../../engine.versions.json) (manifesto de versões abençoadas).
- `migrate` — alinha projeto com o manifest (`engine.version`, `schemaVersion`, `runtimeManifest`). `--dry` pra preview.
- `new <dir> --kind 2d|3d [--name X]` — scaffold de projeto novo com deps pinned a partir do manifest.
- `import-level3d <src> <out>` — converte `*.level3d.json` em `project.pixlproject.json` (sem leak `data.editorObject`).
- `export-level3d <src> <out>` — caminho reverso. Round-trip identity comprovado contra o `harvest-rush.level3d.json` real.

Planejados:
- `export-three <project> <out>` — bundle HTML+JS Three+Rapier+DOM standalone.
- `export-phaser <project> <out>` — bundle HTML+JS Phaser 4+DOM standalone.
- `export-pixlland <project> <out>` — bundle pronto pra upload no Pixlland.

## Usage

```bash
pnpm --filter @pixlland/engine-cli build

# Diagnóstico do projeto
node engine/packages/cli/dist/index.js validate apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json

# Versões alinhadas com a engine?
node engine/packages/cli/dist/index.js outdated apps/portal/games-src/harvest-rush-3d/pixlplayground/project.pixlproject.json

# Update preview / aplicar
node engine/packages/cli/dist/index.js migrate ./project.pixlproject.json --dry
node engine/packages/cli/dist/index.js migrate ./project.pixlproject.json

# Scaffold de projeto novo
node engine/packages/cli/dist/index.js new ./my-3d-game --kind 3d --name "My 3D Game"
node engine/packages/cli/dist/index.js new ./my-2d-game --kind 2d

# Round-trip Harvest Rush level3d
node engine/packages/cli/dist/index.js import-level3d \
  apps/portal/games-src/harvest-rush-3d/public/levels/harvest-rush.level3d.json \
  /tmp/harvest.pixlproject.json
node engine/packages/cli/dist/index.js export-level3d \
  /tmp/harvest.pixlproject.json /tmp/harvest.level3d.json
```

Exit code `0` em sucesso, `1` em erro de validação ou drift detectado. Warnings não falham; servem pra agents identificarem smells (como `data.editorObject` blobs).

## Schema

The CLI keeps a minimal mirror of the schema in `src/schema.ts`. When `engine/apps/studio/src/engine/project/schema.ts` graduates into a shared package, this mirror should be replaced with a direct import.
