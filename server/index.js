import http from 'node:http'
import { handleOrderRoute } from './src/routes/orderRoutes.js'
import { handleTaskRoute } from './src/routes/taskRoutes.js'
import { handleCardRoute } from './src/routes/cardRoutes.js'
import { handleShippingRoute } from './src/routes/shippingRoutes.js'
import { handleConfirmBufferCutting } from './src/controllers/cuttingController.js'
import { handleDeductInventory } from './src/controllers/inventoryController.js'
import { handleVkyaDefectRestore, handleVkyaDovypusk, handleTransferToShop2, handleGetShop2Buffer } from './src/controllers/vkyaController.js'
import { verifyAuthToken } from './src/middleware/authMiddleware.js'

const PORT = process.env.PORT || 4000

const allowedOrigins = new Set(String(process.env.CORE_ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean))

const server = http.createServer((req, res) => {
  const origin = String(req.headers.origin || '').replace(/\/$/, '')
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Cache-Control', 'no-store')

  if (origin && !allowedOrigins.has(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: 'Cross-origin request rejected' }))
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  let body = ''
  let bodyTooLarge = false
  req.on('data', chunk => {
    body += chunk
    if (Buffer.byteLength(body) > 256 * 1024) bodyTooLarge = true
  })
  req.on('end', async () => {
    if (bodyTooLarge) {
      res.writeHead(413, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'Request body too large' }))
    }
    let payload = {}
    try { if (body) payload = JSON.parse(body) } catch (e) {}

    const url = req.url || '/'

    // 1. Health & Status Info
    if (url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({
        status: 'ok',
        system: 'Centrum Enterprise Core Engine',
        timestamp: new Date().toISOString(),
        coverage: '100% Full Lifecycle Coverage (Orders -> Tasks -> Cards -> Cutting -> Warehouse -> Shipping)'
      }))
    }

    if (!(await verifyAuthToken(req, res))) return

    if (url === '/api/v1/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({
        success: true,
        engine: 'Centrum Core Engine v3.0 (Exhaustive Coverage)',
        atomic_transactions: 'enabled',
        isolation: '100% Parallel'
      }))
    }

    // 2. Order Routes
    if (url.startsWith('/api/v1/orders/')) {
      return handleOrderRoute(url, payload, res)
    }

    // 3. Task & Approval Routes
    if (url.startsWith('/api/v1/tasks/')) {
      return handleTaskRoute(url, payload, res)
    }

    // 4. Work Card Batch Routes
    if (url.startsWith('/api/v1/cards/')) {
      return handleCardRoute(url, payload, res)
    }

    // 5. Cutting Routes
    if (url === '/api/v1/cutting/confirm-buffer' && req.method === 'POST') {
      return handleConfirmBufferCutting(payload, res)
    }

    // 6. VKYA & Shop 2 Routes
    if (url === '/api/v1/vkya/defect-restore' && req.method === 'POST') {
      return handleVkyaDefectRestore(payload, res)
    }
    if (url === '/api/v1/vkya/dovypusk' && req.method === 'POST') {
      return handleVkyaDovypusk(payload, res)
    }
    if (url === '/api/v1/cards/transfer-shop2' && req.method === 'POST') {
      return handleTransferToShop2(payload, res)
    }
    if (url.startsWith('/api/v1/tasks/shop2-buffer') && req.method === 'GET') {
      const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`)
      const taskId = parsedUrl.searchParams.get('taskId')
      return handleGetShop2Buffer(taskId, res)
    }

    // 7. Inventory Routes
    if (url === '/api/v1/inventory/deduct' && req.method === 'POST') {
      return handleDeductInventory(payload, res)
    }

    // 8. Shipping Routes
    if (url.startsWith('/api/v1/shipping/')) {
      return handleShippingRoute(url, payload, res)
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'Endpoint not found' }))
  })
})

server.listen(PORT, () => {
  console.log(`🚀 [Centrum Core Engine] Exhaustive Enterprise Server running on http://localhost:${PORT}`)
})
