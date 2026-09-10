import { handleCreateTask, handleApproveTask } from '../controllers/taskController.js'
import { handleGetShop2Buffer } from '../controllers/vkyaController.js'

export async function handleTaskRoute(reqUrl, payload, res) {
  if (reqUrl === '/api/v1/tasks/create') {
    return handleCreateTask(payload, res)
  }
  if (reqUrl === '/api/v1/tasks/approve-engineer') {
    return handleApproveTask(payload, res, 'engineer')
  }
  if (reqUrl === '/api/v1/tasks/approve-director') {
    return handleApproveTask(payload, res, 'director')
  }
  if (reqUrl === '/api/v1/tasks/approve-warehouse') {
    return handleApproveTask(payload, res, 'warehouse')
  }
  if (reqUrl.startsWith('/api/v1/tasks/shop2-buffer')) {
    const parsedUrl = new URL(reqUrl, 'http://localhost:4000')
    const taskId = parsedUrl.searchParams.get('taskId')
    return handleGetShop2Buffer(taskId, res)
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  return res.end(JSON.stringify({ error: 'Task route not found' }))
}
