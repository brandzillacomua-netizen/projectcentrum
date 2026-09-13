import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'node:fs'
import path from 'node:path'

const tsFileResolverPlugin = () => ({
  name: 'vite-plugin-ts-file-resolver',
  resolveId(source, importer) {
    if (importer && source.startsWith('.') && source.endsWith('.js')) {
      const dir = path.dirname(importer)
      const absolutePathWithoutExt = path.resolve(dir, source.slice(0, -3))

      if (!fs.existsSync(absolutePathWithoutExt + '.js')) {
        if (fs.existsSync(absolutePathWithoutExt + '.ts')) {
          return absolutePathWithoutExt + '.ts'
        }
        if (fs.existsSync(absolutePathWithoutExt + '.tsx')) {
          return absolutePathWithoutExt + '.tsx'
        }
      }
    }
    return null
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tsFileResolverPlugin(),
    react(),
    basicSsl()
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_VERCEL_DEV_URL || 'https://centrumbox.vercel.app',
        changeOrigin: true,
        secure: false
      },
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
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/')

          if (!moduleId.includes('/node_modules/')) return undefined

          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(moduleId)) {
            return 'vendor-react'
          }
          if (moduleId.includes('/node_modules/@supabase/')) return 'vendor-supabase'
          if (moduleId.includes('/node_modules/@sentry/')) return 'vendor-observability'
          if (moduleId.includes('/node_modules/lucide-react/')) return 'vendor-ui'
          if (moduleId.includes('/node_modules/qrcode.react/')) return 'vendor-qrcode'
          if (moduleId.includes('/node_modules/html5-qrcode/')) return 'vendor-scanner'
          if (moduleId.includes('/node_modules/@tanstack/react-virtual/')) return 'vendor-virtual'
          if (moduleId.includes('/node_modules/xlsx/')) return 'vendor-excel'
          if (moduleId.includes('/node_modules/emoji-picker-react/')) return 'vendor-emoji'

          return undefined
        }
      }
    }
  }
})
