import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — сборку можно положить в любую папку киоска или отдать любым статик-сервером.
export default defineConfig({
  plugins: [react()],
  base: './',
  // fs.allow: dev-сервер читает базу знаний из ../data/knowledge (вне папки frontend).
  server: { port: 5173, host: true, fs: { allow: ['..'] }, proxy: { '/qwen-api': { target: 'http://127.0.0.1:8789', changeOrigin: true, rewrite: (path) => path.replace(/^\/qwen-api/, '/api'), timeout: 100000, proxyTimeout: 100000 } } },
  preview: { port: 4173, host: true },
});
