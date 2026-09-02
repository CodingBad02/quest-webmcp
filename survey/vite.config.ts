import { defineConfig } from 'vite';

export default defineConfig({
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { main: 'index.html', id: 'id.html' } } },
});
