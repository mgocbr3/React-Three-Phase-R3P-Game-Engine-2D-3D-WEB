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

## Kloofendal 43d Clear (Pure Sky) — HDRI Haven / Polyhaven

- **Caminho no repo**: `apps/studio/public/models/skybox/clear-sky.hdr`
- **Uso**: skybox padrão dos projetos 3D, renderizado por `<Skybox>` (em `apps/studio/src/components/canvas/primitives/Skybox.tsx`) — montado pelo `AtmosphericLighting` quando o projeto está em 3D mode (durante o dia / nascer do sol / pôr do sol; à noite o componente é desmontado e as `Stars` da drei assumem o céu).
- **Fonte**: https://polyhaven.com/a/kloofendal_43d_clear_puresky
- **Autor**: Greg Zaal (Poly Haven / HDRI Haven)
- **Licença**: CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/)
- **Requisito**: nenhum — domínio público equivalente. Atribuição é opcional mas educada (mantida aqui pra dar suporte ao Polyhaven).

### Sobre CC0

CC0 dispensa qualquer atribuição obrigatória; o crédito acima existe apenas como cortesia ao Polyhaven, que mantém o repositório de HDRIs livres usado por studios pelo mundo todo. Se você quiser dar uma contribuição, https://www.patreon.com/polyhaven.

### Por que HDR e não GLB?

A versão anterior (Unreal Engine 4 Sky em GLB, CC-BY-4.0) tinha textura 1:1 (1024×1024) ao invés do equirect 2:1 canônico que o Three.js espera, e o GLTF perdia metadados de orientação no caminho do PMREM — o resultado eram nuvens projetadas no chão. Standard HDR/EXR equirect 2:1 do Polyhaven evita o problema por completo.

## realism-effects (0beqz) — **NÃO integrado** (incompatibilidade técnica)

- **Repo**: https://github.com/0beqz/realism-effects
- **Autor**: 0beqz (Felix Mariotto), MIT
- **Sponsor**: https://buymeacoffee.com/0beqz

Tentamos adotar nesta engine (SSGI/HBAO/SSR/TRAA/MotionBlur). A versão npm `1.1.2` declara peer dep `three >= 0.148` mas internamente importa `WebGLMultipleRenderTargets`, removida do Three.js em ~0.162. Nosso `three@0.184` rejeita o import e o build quebra. A entrada está aqui como **referência de crédito** caso futuramente seja forkado/portado — quem fizer o port deve preservar o crédito ao autor original. Veja `docs/REALISM-SHADERS-EVAL.md` para a história completa e o caminho de port.


