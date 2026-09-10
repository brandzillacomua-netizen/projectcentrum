import { handleCreateOrder } from '../controllers/orderController.js'

export async function handleOrderRoute(reqUrl, payload, res) {
  if (reqUrl === '/api/v1/orders/create') {
    return handleCreateOrder(payload, res)
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  return res.end(JSON.stringify({ error: 'Order route not found' }))
}
