# PixlPlayground Engine — Architecture

> Estado em 2026-05-21. Substitui a versão anterior do documento (aspiracional).

## Objetivo

Engine própria que produza jogos web na qualidade que o Pixlland precisa pra competir no nicho Poki: HTML5, mobile-friendly, sessão curta, dois grandes formatos de gameplay (3D estilo Harvest Rush, 2D estilo Average Routine). Editor visual rodando em browser, runtimes empacotados como bundles `.html`+`.js`+`.wasm` que carregam **um único stack de runtime** por jogo.

Não é Unity. Não é Unreal. Não compete em AAA, em pipeline de animação rigada complexa, em editor de shader. Compete em **ergonomia pra autoria de jogos web casuais** com automação acessível pra agents (Codex, Claude, futuros).

## Princípio fundamental: dois runtimes paralelos, nunca misturados no bundle

| Camada | Stack | Usa quando |
|---|---|---|
| **3D runtime** | Three.js + R3F + Rapier + DOM/CSS (UI) | Jogos com gameplay 3D (Harvest Rush, FPS, racing, sandbox) |
| **2D runtime** | Phaser 4 + Rapier 2D opcional + DOM/CSS (UI) | Jogos com gameplay 2D (Average Routine, plataforma, puzzle, runner) |
| **UI/HUD/menu** | DOM React + CSS sobre `<canvas>` | Em ambos os runtimes — DOM é portátil, acessível, leve |

Um jogo escolhe seu runtime no `project.runtime.primary`. O exporter empacota **apenas** esse runtime — um jogo 3D nunca carrega Phaser, um jogo 2D nunca carrega Three+Rapier. Zero conflito no browser do jogador, bundles enxutos.

**Exceção opt-in (não default):** se um projeto precisar de cena 2D Phaser **com** camada 3D Three.js dentro (caso raro, ex.: jogo de cartas 2D com mini-cena 3D no tabuleiro), o adapter Enable3D entra como add-on explícito. Não é o caminho recomendado.

## Versionamento e sistema de update

A engine carrega um **manifesto de versões abençoadas** em [`engine/engine.versions.json`](./engine.versions.json) — fonte única de verdade pra:

- Versão da engine (`engine.version`)
- Versão do schema do project document (`schemaVersion`)
- Versões pinned das deps de runtime por stack (`runtimes.three-3d.dependencies`, `runtimes.phaser-2d.dependencies`, `ui.dependencies`)

Quando o usuário (ou um agent) atualiza a engine no MacBook desktop:

1. O manifesto novo é o que está empacotado com o release do engine.
2. Cada projeto carrega seu próprio `engine.runtimeManifest` no `project.pixlproject.json` — snapshot das versões usadas pra produzir aquele build.
3. Ao abrir um projeto, o editor compara `project.engine.version` + `runtimeManifest.dependencies` contra o manifesto carregado.
4. Diff é classificado:
   - **Patch** (`0.184.0 → 0.184.2`): migração automática silenciosa.
   - **Minor** (`0.184 → 0.185`): aviso + confirmação.
   - **Major** (`0.184 → 1.0`): bloqueio até confirmação explícita; oferece backup do projeto antes.
5. CLI implementa o mecanismo:
   - `pixl-engine outdated <project>` — diagnóstico.
   - `pixl-engine migrate <project> [--dry]` — aplica migração, escreve `engine.runtimeManifest` novo no project doc.

Inspiração: Godot (`config_version`), Unity (`ProjectVersion.txt` + package manifest), Unreal (`EngineAssociation`). O modelo aqui é mais próximo do Godot: schema versionado + steps de migração discretos.

## Scene document — fonte única de verdade

Todo projeto tem **um** `project.pixlproject.json` (versionado, ver [`engine/apps/studio/src/engine/project/schema.ts`](./apps/studio/src/engine/project/schema.ts)). Estrutura:

```ts
PixlProjectDocument {
  format: 'pixlplayground-project',
  version: 2,
  engine: { version, schemaVersion, runtimeManifest? },
  runtime: { primary: 'three-3d' | 'phaser-2d' | 'hybrid', renderers, physics },
  scenes: PixlSceneDocument[],   // cada cena declara kind: '2d' | '3d'
  assets: { folders, entries },
  editor: { mode, snap, layout },
  game: { templateId, script },
}
```

Cada `PixlSceneDocument` tem `kind: '2d' | '3d'`. **Um projeto pode ter cenas mistas**, mas uma cena nunca é "as duas coisas":
- Cena 3D só aceita componentes da família 3D + compartilhados.
- Cena 2D só aceita componentes da família 2D + compartilhados.
- Componentes inválidos pra família são **erro** de validação (não warning) — o validador no CLI bloqueia o build.

Famílias de componentes (ver `PIXL_*_COMPONENT_TYPES` no schema):

**3D-only:** `pixl.visual`, `pixl.physics`, `pixl.logic`, `pixl.entity`, `pixl.animation`, `pixl.audio`, `pixl.particles`, `pixl.terrain`, `pixl.mesh`, `pixl.transform3d`, `pixl.light3d`, `pixl.camera3d`

**2D-only:** `pixl.sprite`, `pixl.transform2d`, `pixl.physics2d`, `pixl.tilemap`, `pixl.animation2d`, `pixl.camera2d`

**Compartilhados:** `pixl.script`, `pixl.audio`, `pixl.ui`, `pixl.tag`

## Editor — reativo ao kind da cena ativa

- Abre cena 3D → viewport = `EditorCanvas` (R3F), inspector mostra componentes 3D+compartilhados, content browser filtra `.glb/.fbx/.hdr`.
- Abre cena 2D → viewport = `EditorCanvas2D` (Phaser 4, ainda a construir — hoje só existe um minimapa 3D usando Phaser), inspector mostra componentes 2D+compartilhados, content browser filtra `.png/.atlas/.tilemap.json`.
- `useViewportStore` já existe pra disparar essa troca. Falta o viewport 2D virar runtime real.

### Referencia obrigatoria para interacao 3D

Para selecao, raycast, gizmo, highlight e fly camera do editor 3D, a referencia primaria e o MavonEngine/Core. Ver [`engine/REFERENCE-ENGINES.md`](./REFERENCE-ENGINES.md).

Regra pratica: o usuario clica no `Object3D` real que esta vendo, a engine seleciona esse mesmo objeto, e o gizmo prende nesse mesmo objeto. Nao usar clone/proxy deslocado ou heuristica 2D quando o mesh real existe na cena.

## Scripts — API unificada, vetor depende do kind

Um script roda em qualquer cena. Mesma assinatura, vetor diferente:

```ts
export const onUpdate = (ctx) => {
  // Em 3D: ctx.transform.position é PixlVec3, input bridged via R3F
  // Em 2D: ctx.transform.position é PixlVec2, input bridged via Phaser
  ctx.transform.move(ctx.input.axis('move'), ctx.delta);
  if (ctx.input.pressed('jump')) ctx.audio.play('jump');
};
```

Modelo seguido: Godot (`Node2D`/`Node3D` sibling).

## Asset pipeline

```
Assets/
  3D_Models/      ← .glb, .fbx — só usado por runtime 3D
  Sprites/        ← .png, atlases — só usado por runtime 2D
  Tilemaps/       ← .tilemap.json — só usado por runtime 2D
  Textures/       ← .png, .jpg, .hdr — qualquer runtime
  Audio/          ← .ogg, .mp3 — qualquer runtime
  VFX/            ← qualquer runtime
  Materials/      ← .pixlmat.json — qualquer runtime
  Prefabs/        ← .pixlprefab.json — kind-typed
Scenes/           ← *.pixlscene.json — kind-typed
Scripts/          ← *.pixlscript.ts — agnostic
ProjectSettings/  ← config
Builds/           ← output do exporter (gitignored)
```

Pastas já declaradas em `DEFAULT_PROJECT_FOLDERS`. Exporter ignora o que não pertence ao runtime selecionado.

## CLI / automação

A engine expõe operações estruturadas via [`@pixlland/engine-cli`](./packages/cli) (binário `pixl-engine`):

```
pixl-engine validate  <project>           # schema + 2D/3D coherence
pixl-engine outdated  <project>           # diff vs engine.versions.json
pixl-engine migrate   <project> [--dry]   # alinha project com manifest

# Planejados:
pixl-engine import-level3d  <level3d>    <out>   # legacy importer extraido
pixl-engine export-three    <project>    <out>   # bundle Three+Rapier+DOM
pixl-engine export-phaser   <project>    <out>   # bundle Phaser 4+DOM
pixl-engine export-pixlland <project>    <out>   # bundle pro upload no Pixlland
pixl-engine new             <name> --kind 2d|3d  # scaffold de projeto
```

CLI é a única superfície estável que agents (Codex, Claude, futuro MCP) usam pra mexer no projeto sem editar JSON cego.

## Editor desktop (planejado)

Hoje a engine roda em browser (`pnpm engine:dev`). Pro objetivo "engine desktop que atualiza projetos quando atualiza a engine", a roadmap é:

1. Build empacotado via Electron ou Tauri (Tauri preferido: bundle menor, sem Chromium embutido).
2. Auto-update do binário desktop via repo GitHub (Tauri tem suporte nativo).
3. Ao abrir um projeto, desktop chama `pixl-engine outdated` internamente, mostra diff e oferece `pixl-engine migrate`.
4. Backup automático do projeto antes de migrate (cópia `.pre-migrate.<timestamp>.json`).

Pré-requisito real: as deps de runtime no `engine/apps/studio` precisam estar alinhadas com o manifesto. Hoje não estão — o bump pra Three 0.184 / R3F 9.6.1 / Phaser 4.1.0 fica pro próximo Mac session (precisa typecheck + QA visual).

## Boundary Enable3D

Enable3D **não está mais no roadmap padrão**. É Phaser 3 only, complica o stack, traz Ammo (regressão vs Rapier), e o caso de uso ("Phaser 2D com Three.js dentro") é raro. A dep `@enable3d/phaser-extension` e a pasta `tools/vendor/enable3d/` saem do repositório no próximo PR.

Se um jogo específico precisar do caso raro de "shell Phaser + 3D Three dentro", entra como adapter opt-in num projeto isolado, não como caminho first-class da engine.

## Boundary segurança

- Credenciais do editor em env vars; nunca em `project.pixlproject.json`.
- Assets importados são input não-confiável — sanitização nos importers.
- `pixl-engine validate` antes de save/export; falhar fechado.
- `pixl-engine migrate` faz backup antes de escrever.
- Output do exporter (`Builds/`) separado da pasta autora.
