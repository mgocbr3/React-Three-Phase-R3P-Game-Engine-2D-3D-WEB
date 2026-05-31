import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import glsl from "vite-plugin-glsl";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..").replace(/\\/g, "/");
const studioNodeModules = path.resolve(__dirname, "node_modules");

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: [
        repoRoot,
      ],
    },
    hmr: {
      overlay: false,
    },
  },
  define: {
    "import.meta.env.VITE_PIXL_REPO_ROOT": JSON.stringify(repoRoot),
  },
  plugins: [
    react(),
    // GLSL transform — required because the vendored realism-effects fork
    // (tools/vendor/realism-effects/src/) imports raw .frag/.vert/.glsl
    // files. Without this plugin Vite tries to parse them as JS modules
    // and throws "Unexpected identifier 'vec2'". The plugin inlines them
    // as string exports, matching what rollup-plugin-glslify does for
    // the upstream package's pre-built dist.
    glsl({
      include: ['**/*.glsl', '**/*.frag', '**/*.vert', '**/*.fs', '**/*.vs'],
      compress: false,
    }),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: "@pixlland/engine-core",
        replacement: path.resolve(__dirname, "../../packages/core/src/index.ts"),
      },
      {
        find: "@pixlland/phaser-runtime",
        replacement: path.resolve(__dirname, "../../packages/phaser-runtime/src/index.ts"),
      },
      {
        find: "@pixlland/three-runtime",
        replacement: path.resolve(__dirname, "../../packages/three-runtime/src/index.ts"),
      },
      // realism-effects: o pacote upstream 1.1.2 importa
      // `WebGLMultipleRenderTargets` que foi removida do Three.js em
      // ~0.162 — nossa versao 0.184 quebra o build. Substituimos o
      // resolve pela copia em `tools/vendor/realism-effects/src` que
      // tem o patch aplicado (WebGLRenderTarget + count). Veja
      // tools/vendor/realism-effects/PATCH-NOTES.md.
      {
        find: "realism-effects",
        replacement: path.resolve(__dirname, "../../tools/vendor/realism-effects/src/index.js"),
      },
      // The vendored source lives outside apps/studio, so Rollup resolves
      // bare peer imports from the vendor folder unless we anchor them
      // back to the Studio package graph. Keep these exact so `three/addons`
      // still flows through Three's package exports.
      { find: /^postprocessing$/, replacement: path.resolve(studioNodeModules, "postprocessing") },
      { find: /^three$/, replacement: path.resolve(studioNodeModules, "three") },
    ],
    dedupe: [
      'react', 
      'react-dom', 
      'react/jsx-runtime',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
    ],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@radix-ui/react-tooltip',
    ],
    // Exclude realism-effects from esbuild's pre-bundling — esbuild does
    // not respect the `resolve.alias` above for already-installed npm
    // packages and would pull in the broken upstream
    // `realism-effects/dist/index.js` (which imports the removed
    // `WebGLMultipleRenderTargets`). Excluding it forces Vite's full
    // resolver, which honors the alias to the patched vendor src.
    exclude: [
      'realism-effects',
      '@pixlland/engine-core',
      '@pixlland/phaser-runtime',
      '@pixlland/three-runtime',
    ],
    force: true,
  },
}));
