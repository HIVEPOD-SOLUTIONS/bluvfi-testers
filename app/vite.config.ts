import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INVALID_ANNOTATION' || warning.code === 'EVAL') return
        warn(warning)
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
