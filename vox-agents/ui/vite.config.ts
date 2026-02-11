import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@vox': fileURLToPath(new URL('../src', import.meta.url))
    },
  },
  build: {
    outDir: '../dist-ui',
    emptyOutDir: true,
    minify: false,
  },
  server: {
    port: 5173,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5555',
        changeOrigin: true,
      },
    },
  },
})
