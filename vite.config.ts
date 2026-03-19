import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bolhadevgrounds/',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
});
