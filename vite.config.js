import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/fortnet-api': {
        target: 'http://192.168.1.100:8090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fortnet-api/, ''),
        secure: false
      }
    }
  }
})
