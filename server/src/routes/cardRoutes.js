import { handleCreateWorkCardsBatch } from '../controllers/cardController.js'

export async function handleCardRoute(reqUrl, payload, res) {
  if (reqUrl === '/api/v1/cards/batch-create') {
    return handleCreateWorkCardsBatch(payload, res)
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  return res.end(JSON.stringify({ error: 'Card route not found' }))
}
