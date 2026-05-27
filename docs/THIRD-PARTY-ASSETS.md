# Third-party assets — atribuição

Arquivos de terceiros embutidos no studio (`apps/studio/public/`) com suas licenças e atribuições obrigatórias.

## MANEQUIN

- **Caminho no repo**: `apps/studio/public/models/manequin/`
- **Uso**: modelo default do player object em projetos 3D novos (`createPlayerObject` em `apps/studio/src/stores/editorStore.ts`). Renderizado por `<PlayerGltfModel>` em `EditableObject.tsx`.
- **Fonte**: https://sketchfab.com/3d-models/manequin-3087ff2a167241ae997291667dc9f079
- **Autor**: rato biônico games (https://sketchfab.com/felip32pppp)
- **Licença**: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- **Requisito**: crédito obrigatório ao autor; uso comercial permitido.

### Atribuição (copiar tal-qual onde o jogo for distribuído)

> This work is based on "MANEQUIN" (https://sketchfab.com/3d-models/manequin-3087ff2a167241ae997291667dc9f079) by rato biônico games (https://sketchfab.com/felip32pppp) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

A licença original também vive em `apps/studio/public/models/manequin/license.txt` e é embarcada nos builds — quem servir o studio ou um export do projeto também serve essa atribuição automaticamente.

## Unreal Engine 4 Sky

- **Caminho no repo**: `apps/studio/public/models/skybox/ue4-sky.glb`
- **Uso**: skybox padrão dos projetos 3D, renderizado por `<Skybox>` (em `apps/studio/src/components/canvas/primitives/Skybox.tsx`) — montado pelo `AtmosphericLighting` quando o projeto está em 3D mode.
- **Fonte**: https://sketchfab.com/3d-models/unreal-engine-4-sky-be1fae4d5c6e43bbb4970bde465304d0
- **Autor**: irons3th (https://sketchfab.com/irons3th)
- **Licença**: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- **Requisito**: crédito obrigatório ao autor; uso comercial permitido.

### Atribuição

> This work is based on "Unreal Engine 4 Sky" (https://sketchfab.com/3d-models/unreal-engine-4-sky-be1fae4d5c6e43bbb4970bde465304d0) by irons3th (https://sketchfab.com/irons3th) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)

A atribuição também vive como `gltf.asset.extras.author/license/source` dentro do próprio `ue4-sky.glb` — qualquer viewer GLTF a exibe.

