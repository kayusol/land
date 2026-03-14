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
      // RainbowKit 依赖 buffer
      'buffer': 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
})
