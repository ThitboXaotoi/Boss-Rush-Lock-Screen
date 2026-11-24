import preact from '@preact/preset-vite';
import { artSavePlugin } from '@boss-rush/tools/atlas/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works under any GitHub Pages sub-path.
  base: './',
  // artSavePlugin: dev-only endpoint the Art bench uses to save into art/export/ (brief E).
  plugins: [preact(), artSavePlugin()],
  build: { outDir: 'dist' },
});
