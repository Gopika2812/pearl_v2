import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Exclude Node.js-only packages that are never used in the browser
    rollupOptions: {
      external: ['puppeteer', 'puppeteer-core'],
    },
    // Increase chunk size warning limit (large project is expected)
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    exclude: ['puppeteer', 'puppeteer-core'],
  },
})

