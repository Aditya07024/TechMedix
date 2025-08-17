import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [], // ensure axios isn't accidentally externalized
    },
  },
  optimizeDeps: {
    include: ["axios"], // force Vite to bundle axios
  },
})