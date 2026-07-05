import React from 'react'
import { Bell, Trash2, Check, X } from 'lucide-react'
import { useMES } from '../../../MESContext'

export function WarehouseRequestsList({
  groupedRequests,
  processingTasks,
  handleReserveOrder,
  handleSaveConsumableQty,
  handleDeleteRequest,
  handleDeleteEntireRequest,
  editingQty,
  setEditingQty,
  savingQty
}) {
  const { nomenclatures, tasks, orders, currentUser } = useMES()

  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

  return (
    <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
      {Object.entries(groupedRequests).map(([key, reqList]) => {
        if (reqList.length === 0) return null
        const firstReq = reqList[0]
        const orderId = firstReq.order_id
        const taskId = firstReq.task_id
        
        const task = (tasks || []).find(t => t.id === taskId)
        const order = (orders || []).find(o => String(o.id) === String(orderId))
        const orderNum = order?.order_num || '???'
        const displayNum = task?.batch_index ? `${orderNum}/${task.batch_index}` : orderNum

        return (
          <div key={key} style={{ minWidth: '320px', background: '#111', padding: '18px', borderRadius: '16px', border: '1px solid #222', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>НАРЯД #{displayNum}</span>
              {currentUser?.login === 'admin@workshop.local' && (
                <button onClick={() => handleDeleteEntireRequest(reqList, displayNum)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><Trash2 size={13} /></button>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
              {reqList.map(r => {
                const parsedName = parseMaterialName(r.details)
                const isEditing = editingQty.hasOwnProperty(r.id)
                return (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', borderBottom: '1px solid #1a1a1a', paddingBottom: '6px' }}>
                    <span style={{ flex: 1 }}>{parsedName || r.details}</span>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          value={editingQty[r.id]}
                          onChange={e => setEditingQty(prev => ({ ...prev, [r.id]: e.target.value }))}
                          style={{ width: '50px', background: '#000', border: '1px solid #333', color: '#fff', textAlign: 'center', padding: '2px' }}
                        />
                        <button onClick={() => handleSaveConsumableQty(r.id)} style={{ background: '#10b981', border: 'none', color: '#000', cursor: 'pointer' }}><Check size={12} /></button>
                        <button onClick={() => setEditingQty(prev => { const n = { ...prev }; delete n[r.id]; return n })} style={{ background: '#333', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={12} /></button>
                      </div>
                    ) : (
                      <span onClick={() => setEditingQty(prev => ({ ...prev, [r.id]: String(r.quantity) }))} style={{ cursor: 'pointer', borderBottom: '1px dotted #555', color: '#fff', fontWeight: 800 }}>
                        {r.quantity} шт
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => handleReserveOrder(taskId, orderId, orderNum, reqList)}
              disabled={processingTasks.has(taskId)}
              style={{ width: '100%', padding: '10px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
            >
              {processingTasks.has(taskId) ? 'ОБРОБКА...' : 'ВИДАТИ'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
