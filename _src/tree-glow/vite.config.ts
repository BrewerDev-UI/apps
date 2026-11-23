import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained index.html into the repo's tree-glow/ folder.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../../tree-glow', emptyOutDir: true, target: 'es2020' },
});
