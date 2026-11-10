import { defineConfig } from 'vite';

export default defineConfig({
  root: 'admin',
  base: './',
  server: { port: 5174, host: '127.0.0.1' },
  build: {
    outDir: '../dist-admin',
    emptyOutDir: true,
    sourcemap: false,
  },
});
