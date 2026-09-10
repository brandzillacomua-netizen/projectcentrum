import { handleShipOrder } from '../controllers/shippingController.js'

export async function handleShippingRoute(reqUrl, payload, res) {
  if (reqUrl === '/api/v1/shipping/ship-order') {
    return handleShipOrder(payload, res)
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  return res.end(JSON.stringify({ error: 'Shipping route not found' }))
}
