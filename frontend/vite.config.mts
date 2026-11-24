import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const cwd = process.cwd()

export default defineConfig({
  root: path.resolve(cwd, 'frontend'),
  publicDir: false,
  plugins: [vue()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: path.resolve(cwd, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
})
