# Avaliação — shaders/efeitos de "alto realismo" para a engine 3D

**Contexto:** o usuário pediu integração de `0beqz/enhance-shader-lighting`. Esse repo está **abandonado desde 30/Mar/2023** com `peerDependencies.three: <0.151.0`. Nosso projeto roda Three.js **0.184.0** → incompatível direto. Antes de implementar, comparo três caminhos possíveis.

## TL;DR

| Critério | enhance-shader-lighting (pedido) | **realism-effects** (sucessor 0beqz) | drei + postprocessing puros |
|---|---|---|---|
| Último update | Mar/2023 ❌ | Fev/2024 ✅ | Out/2024 ✅ |
| Three.js compat | `<0.151.0` ❌ | `>=0.148.0` ✅ | `>=0.156.0` ✅ |
| Já temos a dep do peer? | Não usado | **Sim — postprocessing@6.38.2 instalado** ✅ | Sim — já usamos |
| Bundle (minified) | ~20KB | ~540KB unpacked / ~150KB gzip | já no projeto |
| API | `material.onBeforeCompile = enhanceShaderLighting(...)` | EffectComposer + pass chain | drei JSX components |
| Stars | 321 | 1676 | (parte de drei) |
| **Tipo de melhoria** | Patches material shaders (Standard) — tunes IBL/AO/lightmap | **SSGI** (global illum), MotionBlur, TRAA, HBAO, SSR | Bloom, SSAO, ChromaticAberration, DepthOfField, Vignette |

## Opção A — `realism-effects` (recomendada)

### Features
- **SSGI** (Screen-Space Global Illumination) — luz bouncing realista em tempo real, é o que dá "olhar AAA" pra qualquer cena
- **TRAA** (Temporal Reprojection Anti-Aliasing) — anti-alias temporal que cai bem com SSGI
- **HBAO** (Horizon-Based Ambient Occlusion) — sombras de contato suaves
- **SSAO** — fallback mais barato, mantido pelo `N8programs`
- **Motion Blur** — blur de movimento por velocity
- **SSR** (Screen-Space Reflections) — reflexos em superfícies brilhantes

### Custo / integração
- **+1 dependência npm** (`realism-effects@1.1.2`) — peer `postprocessing@6.38.2` já temos
- **Requer EffectComposer** — substitui o caminho de render direto do R3F por um composer pass chain
- **Não tem React wrappers oficiais** — é vanilla three.js. Precisa montar via `useEffect` no Canvas
- **OrthographicCamera ainda não suportado** (só PerspectiveCamera — o que usamos, OK)
- **v2 branch em desenvolvimento** com qualidade/performance melhores; main funciona

### Risco
- **Performance**: SSGI é caro (3-8ms por frame em GPU integrada). Aceitável para editor/desktop, pesado para mobile
- **WebGL2 only**: WebGPU não suportado direto (mas Three.js usa WebGL2 por default)
- **Dual-path renderer**: o `EditorCanvas` usa `<Canvas>` do R3F que tem seu próprio loop; integrar EffectComposer requer wrapper que substitui o render

## Opção B — Fork de `enhance-shader-lighting` adaptado

### Trabalho técnico estimado
- **Atualizar para Three.js 0.184 chunks**: o lib patcheia shader chunks via `onBeforeCompile`. Entre 0.151 e 0.184 vários chunks mudaram:
  - `lights_physical_fragment` reescrito (uniform names diferentes)
  - `aomap_fragment` continua mas valores normalizados diferentes
  - `lightmap_pars_fragment` removido em favor de `lightmap_fragment_only`
  - `envmap_*_fragment` rearranjado para suportar PBR no IBL
- **Estimativa**: 8-16h de port + debug. Sem garantia de paridade — algumas opções podem precisar ser refeitas
- **Resultado**: features mais modestas (tweaks IBL/AO) vs realism-effects (SSGI inteiro)

### Quando valeria a pena
- Cena já com lightmaps bakedos onde só precisa de fine-tuning de exposure/saturation
- Mobile target onde SSGI é proibitivo

## Opção C — drei + @react-three/postprocessing

### Features disponíveis (já no projeto)
- `<Bloom>` — glow em pixels brilhantes
- `<SSAO>` — sombras de contato (versão postprocessing.js, mais barata que HBAO do realism-effects)
- `<ChromaticAberration>`, `<Vignette>`, `<DepthOfField>` — cinematic touches
- `<ToneMapping>` — ACES Filmic, Cineon, etc (já usamos via renderer config)
- `<N8AO>` (via lib separada) — AO de boa qualidade

### Custo
- **Zero deps novas** — `@react-three/postprocessing` já estaria coberto pelo `postprocessing@6.38.2` que temos. Confirmar se foi instalado direto ou peer
- **API React-friendly** — `<EffectComposer><Bloom/><SSAO/></EffectComposer>` dentro de `<Canvas>`
- **Compatível com R3F lifecycle** — sem hack de wrapper

### O que NÃO tem
- **SSGI** (luz indireta) — buraco grande para "alto realismo"
- **TRAA** — apenas FXAA/SMAA disponível
- **SSR** — disponível mas qualidade inferior à do realism-effects

## Comparação final — qual escolher?

| Se você quer… | Vá com |
|---|---|
| O lookbook AAA com GI realtime e TRAA | **realism-effects** (Opção A) |
| Compromise: AO bom + bloom + tonemapping bem aplicado, sem mexer no render loop | drei/postprocessing (Opção C) |
| Mexer ao mínimo no projeto e ter exatamente o repo que pediu | Forkar enhance-shader-lighting (Opção B) — alta dor por baixa recompensa |

## Recomendação técnica

**Adotar `realism-effects` em um commit isolado** com config conservadora:
- SSGI: **off por default** (caro), toggle via engineSettings
- HBAO: **on por default** (~1-2ms, ganho visual grande)
- TRAA: **on por default** (melhora alias significativamente)
- SSR: **off por default** (só ligar quando cena tem superfícies espelhadas)
- Motion Blur: **off por default** (gosto pessoal, alguns acham nauseante)

Integração:
1. `pnpm add realism-effects` em `apps/studio`
2. Criar `components/canvas/RealismEffects.tsx` (novo) que monta o composer com os passes nos defaults conservadores
3. Substituir `<PostProcessingEffects/>` (que já existe em Play Mode) por uma versão expandida que inclui realism-effects
4. Adicionar toggles em `engineSettings`: `ssgi: boolean`, `hbao: boolean`, `traa: boolean`, `motionBlur: boolean`, `ssr: boolean`

Trabalho estimado: **2-4h** (vs 8-16h da Opção B com resultado inferior).

## Próximo passo

Aguardando decisão do usuário entre as 3 opções. Se for A (realism-effects), implemento em uma sessão. Se for C (só drei/postprocessing), implemento mais rápido. Se for B (forkar), preciso outra sessão dedicada.

---

## Update 2026-05-26 — Opção A FALHOU EM PROD

Tentei adotar `realism-effects@1.1.2` conforme recomendado. **Não funciona** com Three.js 0.184: o build falha porque a lib importa `WebGLMultipleRenderTargets`, que foi **removido do Three.js em ~v0.162** (substituído por `WebGLRenderTarget` com `count` param). Erro do Vite:

```
No matching export in "three.module.js" for import "WebGLMultipleRenderTargets"
```

O `peerDependencies.three: ">=0.148.0"` no `package.json` da lib é **mentiroso** — diz que aceita 0.148+, mas o código quebra em 0.162+.

### Caminhos disponíveis daqui

**B (forkar realism-effects):**
1. Patch substituindo `import { WebGLMultipleRenderTargets }` por `WebGLRenderTarget` com `count` em todos os passes
2. Verificar se o shader code de SSGI/SSR/TRAA usa `gl_FragData[0..n]` que também mudou para `texture2DArray` em Three.js novo
3. Trabalho estimado: 4-8h sem garantia de paridade visual com o original

**C (drei/postprocessing puros) — caminho mais realista agora:**
- Instalar `@react-three/postprocessing` (compat com nosso stack)
- Usar `<Bloom>`, `<Vignette>`, `<Noise>`, `<SSAO>` (limitado), `<ToneMapping>`
- Sem SSGI, sem TRAA real (só FXAA/SMAA), sem MotionBlur real
- Trabalho: 1-2h, alta probabilidade de funcionar

**Reverter status atual**: a tentativa A foi revertida (deletado RealismEffects.tsx, `pnpm remove realism-effects @react-three/postprocessing`, restaurado RTXPostProcessing). EngineSettings restaurado para o shape original.

Aguardando direção do usuário entre forkar (B) ou aceitar limites (C).

