import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained index.html into the repo's trot-dash/ folder.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: '../../trot-dash', emptyOutDir: true, target: 'es2020' },
});

