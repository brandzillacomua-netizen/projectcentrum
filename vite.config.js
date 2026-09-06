import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl()
  ],
  server: {
    proxy: {
      '/fortnet-api': {
        target: 'http://192.168.1.100:8090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fortnet-api/, ''),
        secure: false
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react'],
          'vendor-qrcode': ['qrcode.react'],
          'vendor-utils': ['date-fns'],
          'vendor-virtual': ['@tanstack/react-virtual'],
          'vendor-excel': ['xlsx'],
          'vendor-emoji': ['emoji-picker-react']
        }
      }
    }
  }
})

