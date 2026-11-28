import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained index.html into the repo's size-up/ folder.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../../size-up', emptyOutDir: true, target: 'es2020' },
});
