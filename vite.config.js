import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'node:fs'
import path from 'node:path'

const tsFileResolverPlugin = () => ({
  name: 'vite-plugin-ts-file-resolver',
  resolveId(source, importer) {
    const cleanSource = source.split('?')[0]
    if (cleanSource.endsWith('.js') || cleanSource.endsWith('.jsx')) {
      const extLength = cleanSource.endsWith('.jsx') ? 4 : 3
      let absolutePathWithoutExt = ''

      if (cleanSource.startsWith('.')) {
        if (!importer) return null
        const dir = path.dirname(importer)
        absolutePathWithoutExt = path.resolve(dir, cleanSource.slice(0, -extLength))
      } else if (cleanSource.startsWith('/src/')) {
        absolutePathWithoutExt = path.resolve(process.cwd(), cleanSource.slice(1, -extLength))
      } else if (path.isAbsolute(cleanSource)) {
        absolutePathWithoutExt = cleanSource.slice(0, -extLength)
      } else {
        return null
      }

      if (!fs.existsSync(absolutePathWithoutExt + '.js') && !fs.existsSync(absolutePathWithoutExt + '.jsx')) {
        if (fs.existsSync(absolutePathWithoutExt + '.tsx')) {
          return absolutePathWithoutExt + '.tsx'
        }
        if (fs.existsSync(absolutePathWithoutExt + '.ts')) {
          return absolutePathWithoutExt + '.ts'
        }
      }
    }
    return null
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url) {
        const [pathname, query] = req.url.split('?')
        if (pathname.endsWith('.jsx') || pathname.endsWith('.js')) {
          const extLength = pathname.endsWith('.jsx') ? 4 : 3
          const absolutePathWithoutExt = path.join(process.cwd(), pathname.slice(0, -extLength))
          if (!fs.existsSync(absolutePathWithoutExt + '.jsx') && !fs.existsSync(absolutePathWithoutExt + '.js')) {
            if (fs.existsSync(absolutePathWithoutExt + '.tsx')) {
              req.url = pathname.slice(0, -extLength) + '.tsx' + (query ? '?' + query : '')
            } else if (fs.existsSync(absolutePathWithoutExt + '.ts')) {
              req.url = pathname.slice(0, -extLength) + '.ts' + (query ? '?' + query : '')
            }
          }
        }
      }
      next()
    })
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
