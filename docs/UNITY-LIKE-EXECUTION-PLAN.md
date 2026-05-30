# Unity-like Execution Plan (Three.js + Phaser)

Data: 2026-05-30
Escopo: Studio standalone (cloud opcional), runtime 3D (Three) e 2D (Phaser), fluxo autoria->build->preview.

## Meta
Entregar comportamento de editor no nivel "Unity-like" para iteracao diaria:
- selecao/hierarquia/gizmo consistentes
- transform persistente com undo/redo por gesto
- round-trip de projeto sem perdas
- build e preview reproduziveis

## Ordem de execucao (obrigatoria)

### Fase 1 - Base 3D editor/runtime (prioridade maxima)
1. Conectar gizmo nativo ao estado do editor em tempo real.
2. Persistir transform no fim do gesto com unico checkpoint de historico.
3. Remover estado global compartilhado no adapter Pixl->Wes.
4. Validar com typecheck + testes focados + smoke browser interno (engine=native).

Aceite:
- transform no Inspector acompanha movimento do gizmo.
- alteracao final gera persistencia sem flood de historico.
- adapter sem variavel global mutavel.

### Fase 2 - Consolidacao de caminho unico 3D
1. Reduzir dual-path EditorCanvas vs runtime nativo no fluxo principal.
2. Garantir selecao por Hierarchy e por viewport com paridade.
3. Fechar regressao de assets/paths do sample Harvest no editor nativo.
4. Smoke browser: selecionar, mover, rotacionar, escalar, frame selected.

Aceite:
- sem fallback inesperado para caminho legado no fluxo nativo.
- sem overlay de erro por path de asset no caso principal.

### Fase 3 - Editor 2D Phaser (paridade de autoria)
1. Snap translate/rotate/scale no 2D.
2. History commit no fim do drag 2D.
3. Pivot/origin correto para sprites.
4. Tilemap MVP render/edit.
5. Smoke browser 2D: drag, rotate, scale, undo/redo.

Aceite:
- fluxo 2D usavel para edicao real sem regressao de input/hierarchy.

### Fase 4 - Pipeline de build e round-trip
1. Export 3D e 2D com assets corretos.
2. Build target unificado Pixlland.
3. Round-trip Harvest (editar->salvar->exportar->rodar->ver mudanca).
4. Smoke browser runtime exportado.

Aceite:
- pipeline completo reprodutivel por CLI e por Build Settings.

### Fase 5 - Desktop/update/migracao
1. Integrar outdated/migrate no fluxo de abertura de projeto.
2. Definir trilha de auto-update desktop.
3. Teste de migracao com backup e rollback.

Aceite:
- abrir projeto antigo, migrar com seguranca e continuar editando.

## Execucao realizada nesta sessao

Status: Fase 1 em andamento avancado.

Implementado:
1. `apps/studio/src/components/canvas/useSelectionGizmo.ts`
- Adicionado callback `onTransformChange` para sincronizacao live durante `objectChange`.
- Mantido `onTransformCommit` no fim do drag (`dragging-changed=false`).

2. `apps/studio/src/components/canvas/ThreeRuntimeMount.tsx`
- Separada logica em:
  - `syncNativeGizmoTransform` (update sem historico)
  - `persistNativeGizmoTransform` (saveToHistory no commit)
- Mantida selecao nativa conectada ao store.

3. `packages/three-runtime/src/adapter/pixlSchemaAdapter.ts`
- Removida variavel global `allSceneObjects`.
- `buildGameObjectJSON` agora recebe `sceneObjects` por argumento (funcao pura/thread-safe).

4. `apps/studio/src/pages/EditorPage.tsx`
- Fluxo 3D agora prefere viewport nativo por padrao quando `engine` nao e informado.
- Caminho legado continua acessivel via `?engine=legacy` durante a migracao.

5. Porta estrutural da engine 3D do Wes no runtime
- `packages/three-runtime/src/Settings.ts`
- `packages/three-runtime/src/VR/VRMode.ts`
- `packages/three-runtime/src/assets/CubeTextureAsset.ts`
- `packages/three-runtime/src/components/UserInterfaceComponent.ts`
- `packages/three-runtime/src/physics/PhysicsHelpers.ts`
- `packages/three-runtime/src/ui/UIHelpers.ts`
- `packages/three-runtime/src/GameObject.ts` agora registra `userInterface`.
- `packages/three-runtime/src/Renderer.ts` agora chama update de ThreeMeshUI quando carregado.
- `packages/three-runtime/src/index.ts` exporta os modulos 3D completos (incluindo THREE e RAPIER).
- `packages/three-runtime/package.json` inclui `three-mesh-ui@5.5.1`.

## Validacao executada

1. Typecheck studio
- `pnpm --filter pixlplaygroundstudio typecheck` -> OK.

2. Testes studio focados
- `pnpm --filter pixlplaygroundstudio test -- useSelectionGizmo ThreeRuntimeMount` -> OK (37 arquivos, 229 testes).

3. Testes package three-runtime
- `pnpm --filter @pixlland/three-runtime test` -> OK (7 arquivos, 20 testes).

4. Smoke browser interno (humano)
- URL: `http://127.0.0.1:8080/editor?sampleProject=harvest-rush-3d&kind=3d&engine=native`
- Resultado:
  - editor carrega com runtime nativo
  - selecao por hierarchy funcionando (objeto Apiary selecionado)
  - inspector renderiza dados do objeto selecionado
  - viewport em runtime nativo ativo

5. Smoke browser interno sem flag engine
- URL: `http://127.0.0.1:8080/editor?sampleProject=harvest-rush-3d&kind=3d`
- Resultado:
  - fallback para runtime nativo confirmado (label "Carregando projeto no @pixlland/three-runtime")
  - sem erro de carregamento do caminho legado no fluxo padrao

6. Smoke de selecao apos porta do fluxo Wes
- URL: `http://127.0.0.1:8080/editor?sampleProject=harvest-rush-3d&kind=3d&engine=native`
- Resultado:
  - selecao por hierarchy permanece apos clique no viewport (nao perde foco em clique vazio)
  - inspector permanece com objeto ativo apos interacao de mouse no canvas

## Proximo passo imediato (ordem)
1. Fase 2, item 1: consolidar caminho principal no runtime nativo 3D.
2. Fase 2, item 2: validar paridade de selecao/hierarchy/viewport em smoke browser guiado.
3. Fase 2, item 3: corrigir caso de path de asset no sample Harvest para eliminar erro no caminho legado.

## Atualizacao desta rodada (itens 1, 2 e 3)

Implementado:
1. Paridade de hotkeys de ferramenta no viewport 3D nativo
- `apps/studio/src/components/canvas/ThreeRuntimeMount.tsx`
- Atalhos MainArea do Wes no editor nativo:
  - `R` => rotate
  - `S` => scale
  - `T` e `P` => translate
  - `Delete` => remove objeto selecionado
- Mantida protecao para nao capturar atalhos quando foco esta em input/textarea/select/contenteditable.

2. Precisao de selecao no canvas
- `apps/studio/src/components/canvas/useSelectionGizmo.ts`
- `resolveSelectableObject` deixa de aceitar fallback para mesh arbitraria sem id de objeto runtime.
- Agora apenas objetos ligados ao fluxo Pixl/GameObject (via `userData.pixlObjectId`/parent chain) sao selecionaveis.

3. Fluxo GameObjectType no runtime 3D
- `packages/three-runtime/src/Game.ts`
- Adicionados registries com paridade Wes:
  - `gameObjectTypes`
  - `gameObjectClasses`
- `_init` agora pre-carrega `gameObjectTypes` declarados em `game.json`.
- Novas APIs:
  - `registerGameObjectClasses(...)`
  - `getGameObjectTypeJSON(...)`
  - `getGameObjectClass(...)`

Testes e validacao:
1. Runtime 3D
- `pnpm --filter @pixlland/three-runtime typecheck` -> OK
- `pnpm --filter @pixlland/three-runtime test` -> OK (7 arquivos, 20 testes)

2. Studio
- `pnpm --filter pixlplaygroundstudio typecheck` -> OK
- `pnpm --filter pixlplaygroundstudio test -- useSelectionGizmo ThreeRuntimeMount` -> OK (37 arquivos, 230 testes)

3. Browser interno (smoke humano)
- Criado projeto 3D local e aberto no editor nativo.
- Insercao de `Cube` confirmada no Hierarchy/Inspector.
- `Delete` removeu objeto selecionado e atualizou contadores/inspector corretamente.

## Atualizacao Wes MainArea/Renderer parity

Implementado:
1. Viewport 3D nativo sem atalhos numericos inventados
- `apps/studio/src/components/canvas/ThreeRuntimeMount.tsx`
- `Digit1`/`Numpad1`/`Numpad3`/`Numpad7` nao mudam mais a camera; o keymap fica alinhado ao `scene_editor/MainArea.jsx` do Wes.

2. Selecao por raycast via runtime GameObject
- `apps/studio/src/components/canvas/useSelectionGizmo.ts`
- `apps/studio/src/components/canvas/ThreeRuntimeMount.tsx`
- Raycast agora filtra `TransformControlsPlane`, usa `game.scene.getGameObjectWithThreeJSObject(...)` e so aplica selecao se o id existe no store do editor.
- IDs internos/runtime-only e objetos de sample fora do store nao substituem a selecao atual.
- Clique vazio em cena 3D nao limpa a selecao ativa, seguindo o fluxo do Wes.

3. Renderer direto sem pos-processamento customizado
- `packages/three-runtime/src/Renderer.ts`
- `apps/studio/src/components/canvas/ThreeRuntimeMount.tsx`
- Post-processing nativo forcado para `off`; renderer usa `NoToneMapping`, exposure `1` e render direto `threeJSRenderer.render(scene.threeJSScene, camera)` como no Wes.

Testes e validacao:
1. Studio
- `pnpm --filter pixlplaygroundstudio typecheck` -> OK
- `pnpm --filter pixlplaygroundstudio test -- ThreeRuntimeMount editorStore.hierarchy useSelectionGizmo` -> OK (37 arquivos, 235 testes)

2. Browser interno
- URL: `http://127.0.0.1:8080/editor?localProject=proj_1780140946796_846b5mgp6&kind=3d`
- Resultado final:
  - antes/depois de clique vazio: `storeSelected` permaneceu no mesmo cubo (`6w081bz`)
  - Inspector nao ficou vazio
  - `data-scene-axis-view` permaneceu `free` apos `Digit1` e `Numpad3`
  - `data-three-postprocessing=off`
  - `data-three-postprocessing-effects=off`
