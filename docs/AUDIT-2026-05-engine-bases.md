# Auditoria — Bases adotadas (PhaserEditor2D-v3 + three-game-engine)

**Data:** 2026-05-26
**Branch:** `claude/engine-simples-three-phaser`
**Escopo:** verificar o estado da adoção das duas engines de referência e listar gaps a terminar.

## Resultado em uma linha

Ambas as adoções **funcionam**, com atribuição MIT preservada, mas têm gaps significativos. **Editor 2D** depende inteiramente de um único arquivo de 1307 linhas; **runtime 3D** já foi compartimentado em um package e tem uma camada de adapter sólida — porém o caminho R3F antigo do `EditorCanvas` ainda coexiste e não foi consolidado.

---

## 1. Editor 2D — PhaserEditor2D-v3

**Local da porta**: `apps/studio/src/components/canvas/PhaserRuntimeMount.tsx` (~430 linhas portadas dentro de 1307 totais)
**Atribuição MIT**: presente nos blocos correspondentes (linhas 451-457, 642-645, 663-668, 773-777)
**Commit-chave**: `3bbc359` (Round 3.75)

### Funcional end-to-end
- Click-select via raycast `setInteractive` + `gameobjectdown`
- Drag-to-translate (Round 1.5)
- 4 handles de scale (NW/NE/SW/SE) com hit area 38px, hover/cursor feedback, math em local-space
- 1 handle de rotate + anel visual com ticks; math `atan2` portada
- Toolbar dita quais handles aparecem (select/translate/rotate/scale)
- Inspector ↔ scene live sync (Round 2)
- Play/Stop com `scene.pause/resume` + `keyboard.enabled` toggle
- Arrow-key nudge (Shift=10×, Alt=0.1×)
- Sprite/image/text/rectangle/circle rendering com tint, alpha, flip, depth

### Gaps prioritários (impacto ↓)
1. **`saveToHistory()` não é chamado no fim do drag** — undo após movimentar não desfaz. Solução: emitir um único `saveToHistory` por gesto no `dragend`.
2. **Snap não é aplicado no 2D** — store carrega `snapEnabled/snapTranslate/snapRotate/snapScale` (editorStore.ts:390-393), 3D usa via `TransformGizmo.tsx`, mas o drag handler em `PhaserRuntimeMount` escreve `position` direto sem arredondar.
3. **`setOrigin` nunca chamado em `drawObject`** (PhaserRuntimeMount.tsx:145-180) — sprites com pivot custom renderizam centrados; rotação ao redor do pivot quebra.
4. **Tilemap não renderiza** — `TilemapComponent` existe no package; `drawObject` cai no fallback magenta `unsupported`. Sem editor de tilemap.
5. **Atlas/Animation loader ausente** — `Animation2DComponent` existe mas `queueSpriteLoads` nunca invoca `scene.load.atlas`.

### Bugs suspeitos
- Convenção de eixo Y/Z divergente: `PhaserRuntimeMount` escreve `position[1]` (Y); `PhaserViewport2D` lê `position[2]` (Z). Se o esquemático voltar, divergem silenciosamente. **Recomendação: deletar `PhaserViewport2D.tsx` (dead-code, 506 linhas).**
- `gameObjects` Map keyed por `name` — dois objetos com mesmo nome sobrescrevem-se no Map.
- `scene.children.list.find` em hot paths (linhas 547, 1153) — O(n) por evento.
- `input.keyboard.addKey(SHIFT)` dentro do `drag` handler (linha 829-832) chamado a cada frame.
- `requestAnimationFrame` infinito em `Viewport2DRulers.draw` (PhaserViewport2D.tsx:378-391), continua rodando mesmo invisible.

### Não portado
- Tile editor avançado (palette, brush, fill, autotile)
- Atlas packer / animation editor
- Prefab system
- Scene-graph parenting visual (`Phaser.Container` nesting)
- Multi-select e marquee

---

## 2. Runtime 3D — three-game-engine

**Local da porta**: `packages/three-runtime/src/` (~1.8k LOC efetivos)
**Atribuição**: header `// Adapted from tools/vendor/three-game-engine/...` em cada arquivo; fonte original em `tools/vendor/three-game-engine/`
**ADR**: `docs/ADR-003-adopt-three-game-engine.md` (Accepted)

### Inventário portado

| Módulo | Função | LOC | Fonte |
|---|---|---|---|
| `Game.ts` | Boot/loop; `loadFromPixlProject` (extensão Pixl) | 211 | Wes + ext |
| `Scene.ts` | THREE.Scene + RAPIER.World, lifecycle | 225 | Wes (podado) |
| `GameObject.ts` | THREE.Group + Components + hierarquia | 270 | Wes |
| `Component.ts` | Lifecycle base | 52 | Wes |
| `Renderer.ts` | WebGLRenderer + camera + audio | 133 | Wes |
| `assets/` (AssetStore, GLTFAsset, etc.) | Cache por path | ~270 | Wes (rebinded) |
| `components/RigidBodyComponent.ts` | Rapier wrapper (15 colliders) | 178 | Wes |
| `components/LightComponent.ts` | 6 tipos de luz | 54 | Wes |
| `components/SoundComponent.ts` | PositionalAudio | 81 | Wes |
| `components/ModelComponent.ts` | GLTF clone (SkeletonUtils) | 37 | Wes |
| `components/GltfNodeComponent.ts` | **Pixl-only**: nó de GLB compartilhado | 84 | novo |
| `components/PrimitiveComponent.ts` | **Pixl-only**: box/sphere/etc | 142 | novo |
| `input/` | Keyboard + Mouse + Gamepad | ~290 | Wes (+ bugfix em `getButton`) |
| `util/CharacterController.ts` (+ Kinematic + Dynamic) | Capsule + ground raycast | ~340 | Wes |
| `adapter/pixlSchemaAdapter.ts` | **Pixl-only**: pixl⇄wes scene | 440 | novo |

### Funcional end-to-end
- Asset loading: GLTF (DRACO opt-in), Texture, Sound, JSON (`.pixlscene`, `.pixlproject`)
- Cache por path em `AssetStore.loadedAssets`; `setData()` para repopulação em memória
- Input: keyboard, mouse (pointer-lock opt-in), gamepad (16 botões + 2 eixos)
- Physics: Rapier 3D async, 15 colliders, kinematic/dynamic/fixed, KinematicCharacterController completo
- Editor R3F: gizmo + FlyCamera + selection (paralelo ao runtime nativo)

### Gaps prioritários
1. **Persistência editor↔runtime via gizmo nativo não conectada** (comentado: "Phase 6B step 5b — persistência via `engine-ops.object.setTransform`"). `TransformControls` do `useSelectionGizmo` não despacha `updateObject` ao store. No path R3F antigo (`EditorCanvas.tsx`) funciona; no path nativo (`ThreeRuntimeMount`) é cosmético.
2. **AnimationComponent inexistente** no runtime. `pixl.animation` é descartado no adapter; mixer existe no R3F path mas não no runtime nativo. Bloqueia personagens animados via path nativo.
3. **Dual-path R3F vs nativo** — `EditorCanvas.tsx` (R3F, ~9k LOC entre canvas/) coexiste com `ThreeRuntimeMount` (363 LOC). ADR-003 visava consolidação; precisa decisão: terminar migração ou aceitar split permanente.
4. **`allSceneObjects` global no adapter** (`pixlSchemaAdapter.ts:301`) — `let` exportado de módulo lido via closure por `buildGameObjectJSON`. Chamadas concorrentes podem colidir.
5. **`PrimitiveComponent` e `GltfNodeComponent` não reexportados** em `index.ts` — código externo não consegue importar pra subclassar.

### Bugs e dívidas
- `window.__pixlGame`, `__pixlOrbitControls`, `__pixlGizmo` — 3 debug globals marcados "Strip later", atualmente exigidos para seleção funcionar.
- `disablePhysics` no `GameOptions` não silencia `RigidBodyComponent.load` (joga erro se physics desligado).
- WS hot-reload comentado em `ThreeRuntimeMount.tsx` é aspiracional — não há listener WS instalado, e o comentário promete "<500ms reload" que não acontece.
- **Networking: zero.** Comentário em `ThreeRuntimeMount.tsx` ("bridges engine-api WS broadcasts") é stub não implementado. Já removemos `packages/api` neste branch (PR #2), então o stub deve ser removido junto.

### Não portado
- Prefab system data-driven (atual: JSX em `EditableObject.tsx` mapeando strings)
- Behavior tree / scripting estruturado
- Save/load do estado físico (linvel, angvel) em runtime
- Cascaded shadows, light probes, IBL no runtime nativo

---

## 3. O que entregamos nesta sessão (commits desta refatoração)

| # | Commit | Escopo |
|---|---|---|
| 1 | `c1ef012` | Remove cloud layer inteiro (auth + Pixlland + Supabase + autosave cloud + version history) |
| 2 | `03fd9c9` | Deleta `config/engineMode.ts` |
| 3 | `232772a` | Deleta `packages/api/` (backend HTTP+WS) |
| 4 | `6311190` | Drop deps cloud do `package.json` |
| 5 | (próximo) | **Lock kind 2D/3D pelo projeto** + filtro de keydown no FlyCamera contra TEXTAREA/contenteditable |

### Lock kind 2D/3D — detalhes
- Adicionado `lockedKind: ViewportMode \| null` + `setLockedKind` em `viewportStore.ts`
- Quando projeto carrega (`applyProjectDocumentToEditor` em `localProjectFiles.ts`): chama `setLockedKind(scene.kind)` e força `viewportMode` ao kind do projeto
- `EditorToolbar` mostra badge fixo "2D" ou "3D" quando lockado; toggle só aparece quando não há projeto (boot/dev)
- `Index.tsx` (Hub) limpa `setLockedKind(null)` no mount, garantindo que voltar pro Hub libera o toggle

### FlyCamera WASD
- **Já funcionava** (confirmado visualmente — câmera moveu ao pressionar W)
- Pequena melhoria: filter de keydown agora ignora também `TEXTAREA`, `SELECT`, `[contenteditable]` além de `INPUT`. Antes, digitar "wasd" em script editor inline poderia mexer câmera.

---

## 4. Roadmap sugerido (próximas sessões)

### Editor 2D — terminar a base PhaserEditor2D-v3
1. `dragend` → `saveToHistory()` (undo funciona após drag)
2. Aplicar `snapEnabled/snapTranslate/snapRotate` no drag handler 2D
3. `setOrigin` em `drawObject` para sprites com pivot custom
4. Tilemap MVP — render via `scene.add.tilemap`/`createLayer` (sem brush)
5. Deletar `PhaserViewport2D.tsx` (506 linhas dead-code) **OU** restaurar e harmonizar convenção de eixo

### Runtime 3D — terminar a base three-game-engine
1. Conectar `TransformControls.object-changed` → `editorStore.updateObject` em `useSelectionGizmo.ts` (Phase 6B step 5)
2. `AnimationComponent` no runtime (encapsula `AnimationMixer`)
3. Eliminar `allSceneObjects` global em `pixlSchemaAdapter.ts`; passar flat list por argumento
4. Reexportar `PrimitiveComponent`/`GltfNodeComponent` no `index.ts` do package
5. Decidir: consolidar R3F+nativo OU documentar split permanente em ADR-005
6. Remover stub WS hot-reload de `ThreeRuntimeMount.tsx` (junto com `packages/api` já deletado)
7. Tirar `window.__pixl*` globals — refatorar pra passar refs via context/store
