import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://8ff5-37-248-226-236.ngrok-free.app',
        changeOrigin: true,
        secure: false,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
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
