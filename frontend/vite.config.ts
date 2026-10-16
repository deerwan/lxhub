import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const BACKEND = process.env.VITE_BACKEND || 'http://127.0.0.1:8787'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [vue()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': BACKEND,
      '/export.json': BACKEND,
    },
  },
  build: {
    target: 'es2015',
    chunkSizeWarningLimit: 4000,
    // 保持默认的 assets/ 输出目录：后端 server.py 只挂载了 `/assets`
  },
})
