# realism-effects vendor patch

Origem: https://github.com/0beqz/realism-effects (MIT) — commit do clone em `--depth 1`.
Autor: Felix Mariotto (0beqz). Sponsor: https://buymeacoffee.com/0beqz

## Por que vendorizamos

A versão npm `realism-effects@1.1.2` declara `peerDependencies.three: ">=0.148.0"` mas internamente importa `WebGLMultipleRenderTargets`, símbolo **removido do Three.js em ~0.162** (substituído por `WebGLRenderTarget` com option `count`). Nosso projeto usa Three.js 0.184; o build falha com:

```
No matching export in "three.module.js" for import "WebGLMultipleRenderTargets"
```

## Patch aplicado

Substituições mecânicas em 4 arquivos do `src/`:

| Arquivo | Mudanças |
|---|---|
| `src/denoise/pass/PoissonDenoisePass.js` | `import { WebGLMultipleRenderTargets }` → `WebGLRenderTarget`; `new WebGLMultipleRenderTargets(w,h,n,opts)` → `new WebGLRenderTarget(w,h,{...opts, count:n})`; `.texture[i]` → `.textures[i]` (3 sítios) |
| `src/temporal-reproject/TemporalReprojectPass.js` | mesmas substituições (2 sítios) |
| `src/ssgi/pass/CopyPass.js` | mesmas substituições; `renderTarget.texture.push()` → `renderTarget.textures.push()` |
| `src/denoise/Denoiser.js` | `temporalReprojectPass.renderTarget.texture.slice()` → `.textures.slice()` |

## Como consumimos

`apps/studio/vite.config.ts` adiciona um alias:

```ts
"realism-effects": path.resolve(__dirname, "../../tools/vendor/realism-effects/src/index.js"),
```

Assim qualquer `import x from "realism-effects"` no studio resolve aqui e bypass o pacote npm bugado em `node_modules`. O alias só é aplicado pelo studio; o resto do monorepo continua livre pra usar (ou não) o pacote upstream.

## TODO

- [ ] Confirmar que SSGI / SSR / TRAA / MotionBlur funcionam após o patch (estamos só montando HBAO no studio por enquanto, ver `effects/RealismEffects.tsx`)
- [ ] Considerar abrir PR no upstream com o patch — o repo está parado desde Fev/2024 mas issue/PR pode ajudar outros usuários
- [ ] Substituir o clone --depth 1 por um pin de commit hash para reprodutibilidade
