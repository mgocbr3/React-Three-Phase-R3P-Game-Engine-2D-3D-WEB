import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..").replace(/\\/g, "/");

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
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // realism-effects: o pacote upstream 1.1.2 importa
      // `WebGLMultipleRenderTargets` que foi removida do Three.js em
      // ~0.162 — nossa versao 0.184 quebra o build. Substituimos o
      // resolve pela copia em `tools/vendor/realism-effects/src` que
      // tem o patch aplicado (WebGLRenderTarget + count). Veja
      // tools/vendor/realism-effects/PATCH-NOTES.md.
      "realism-effects": path.resolve(__dirname, "../../tools/vendor/realism-effects/src/index.js"),
    },
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
    force: true,
  },
}));
