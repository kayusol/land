import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'buffer': 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    proxy: {
      '/evo-api': {
        target: 'https://backend.evolution.land',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/evo-api/, ''),
        secure: false,
      },
    },
  },
})
