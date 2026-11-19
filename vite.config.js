import { defineConfig } from 'vite';
// base './' so the site works from any GitHub Pages sub-path (https://<user>.github.io/<repo>/)
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
