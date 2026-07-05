import React from 'react'
import { Bell, Trash2, Pencil, Check } from 'lucide-react'
import { parseMaterialName, normalize } from '../hooks/useWarehouseComputed'

export const ConsumablesQueue = ({
  groupedRequests,
  tasks,
  orders,
  purchaseRequests,
  receptionDocs,
  inventory,
  nomenclatures,
  currentUser,
  editingQty,
  setEditingQty,
  savingQty,
  handleSaveConsumableQty,
  handleDeleteRequest,
  handleDeleteEntireRequest,
  processingTasks,
  setShowReception,
  approveWarehouse,
  handleReserveOrder
}) => {
  if (Object.keys(groupedRequests).length === 0) return null

  return (
    <div className="content-card glass-panel" style={{ borderLeft: '4px solid #ff9000', marginBottom: '30px', padding: '20px' }}>
      <h3 style={{ fontSize: '0.8rem', color: '#ff9000', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Bell size={16} /> ЗАЯВКИ НА КОМПЛЕКТАЦІЮ
      </h3>
      <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
        {Object.entries(groupedRequests).map(([key, reqList]) => {
          const firstReq = reqList[0]
          const orderId = firstReq.order_id
          const taskId = firstReq.task_id
          
          const task = (tasks || []).find(t => t.id === taskId)
          const order = (orders || []).find(o => String(o.id) === String(orderId))
          const orderNum = order?.order_num || '???'
          const displayNum = task?.batch_index ? `${orderNum}/${task.batch_index}` : orderNum

          const activePR = (purchaseRequests || []).find(pr =>
            (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'pending'
          )
          const acceptedPR = (purchaseRequests || []).find(pr =>
            (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'accepted'
          )
          const orderedPR = (purchaseRequests || []).find(pr =>
            (pr.task_id ? String(pr.task_id) === String(taskId) : String(pr.order_id) === String(orderId)) && pr.status === 'ordered'
          )
          const orderedReception = (receptionDocs || []).find(rd =>
            (rd.task_id ? String(rd.task_id) === String(taskId) : String(rd.order_id) === String(orderId)) && rd.status === 'ordered'
          )
          const pendingReception = (receptionDocs || []).find(rd =>
            (rd.task_id ? String(rd.task_id) === String(taskId) : String(rd.order_id) === String(orderId)) && (rd.status === 'pending' || rd.status === 'shipped')
          )

          const missingItems = []
          reqList.forEach(req => {
            const parsedName = parseMaterialName(req.details)
            const nameLower = parsedName.toLowerCase()
            
            const matchingInv = (inventory || []).filter(i => {
              if (i.warehouse !== 'operational' && i.warehouse) return false
              if (i.id === req.inventory_id) return true
              if (req.nomenclature_id && String(i.nomenclature_id) === String(req.nomenclature_id)) return true
              if (parsedName) {
                const normName = normalize(i.name)
                const normParsed = normalize(parsedName)
                if (normName === normParsed) return true
                if (normName.includes('[підготовлений]') && normName.replace(' [підготовлений]', '').replace('[підготовлений]', '').trim() === normParsed) return true
                const normNameNoParens = normalize(i.name.replace(/\s*\([^)]*\)$/, ''))
                if (normNameNoParens === normParsed) return true
              }
              return false
            })
            
            const totalOnWh = matchingInv.reduce((sum, i) => sum + (Number(i.total_qty) || 0) - (Number(i.reserved_qty) || 0), 0)
            
            const nom = req.nomenclature_id ? nomenclatures.find(n => String(n.id) === String(req.nomenclature_id)) : null
            const isSgp = (
              nom?.type === 'part' || 
              nom?.type === 'product' || 
              nameLower.startsWith('іп-') || 
              nameLower.startsWith('ip-') || 
              nameLower.startsWith('kr-') || 
              nameLower.startsWith('kh-') || 
              (nameLower.includes('іп') && !nameLower.includes('кріплення') && !nameLower.includes('друк') && !nameLower.includes('3д')) ||
              nameLower.includes('ip') ||
              matchingInv.some(i => i.type === 'finished' || i.type === 'semi' || i.type === 'part')
            )
            if (isSgp) return
            
            const alreadyIssuedForThis = (reqList || []).filter(r => r.id === req.id && r.status === 'issued')
              .reduce((sum, r) => sum + Number(r.quantity), 0)
            
            const effectiveAvailable = totalOnWh + alreadyIssuedForThis

            if (effectiveAvailable < Number(req.quantity)) missingItems.push(req)
          })

          const isAllIssued = reqList.every(r => r.status === 'issued')
          const isPartiallyIssued = task?.warehouse_conf === 'partial'

          const allRemainingArePreparedSheets = reqList.length > 0 && reqList.every(r => {
            const nameLower = (parseMaterialName(r.details) || '').toLowerCase()
            return nameLower.includes('лист') && nameLower.includes('підготовлений')
          })

          const allMissingArePreparedSheets = missingItems.length > 0 && missingItems.every(item => {
            const parsedName = parseMaterialName(item.details)
            const nameLower = (parsedName || '').toLowerCase()
            return nameLower.includes('лист') && nameLower.includes('підготовлений')
          })

          let btnLabel = ''
          let isAwaiting = false

          if (missingItems.length === 0) {
            btnLabel = isAllIssued ? 'ПІДТВЕРДИТИ ВИДАЧУ' : 'ВИДАТИ'
            isAwaiting = false 
          } else if ((isPartiallyIssued || allRemainingArePreparedSheets) && allMissingArePreparedSheets) {
            btnLabel = 'ОЧІКУЄМО ЛИСТИ'
            isAwaiting = true
          } else if (activePR) {
            btnLabel = 'ЗАПИТ НАДІСЛАНО'
            isAwaiting = true
          } else if (acceptedPR) {
            btnLabel = 'ЗАПИТ ПРИЙНЯТО'
            isAwaiting = true
          } else if (orderedPR || orderedReception) {
            btnLabel = 'ОЧІКУЄ ПРИЙОМКИ'
            isAwaiting = true
          } else if (pendingReception) {
            btnLabel = 'ПРИЙОМКА'
            isAwaiting = false
          } else {
            btnLabel = 'ЗІБРАТИ ТА ЗАБРОНЮВАТИ'
            isAwaiting = false
          }

          const btnColor = isAwaiting ? '#1a1a1a' : (btnLabel === 'ПРИЙОМКА' ? '#0ea5e9' : '#ff9000')
          const textColor = isAwaiting ? '#444' : '#000'

          return (
            <div key={key} style={{ minWidth: '300px', background: '#111', padding: '15px', borderRadius: '15px', border: '1px solid #222' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ fontSize: '0.75rem' }}>НАРЯД #{displayNum}</strong>
                {currentUser?.login === 'admin@workshop.local' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteEntireRequest(reqList, displayNum)}
                    style={{ background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', transition: '0.15s' }}
                    title="Видалити весь запит для наряду"
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#888'}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '15px' }}>
                {(() => {
                  const displayedRequests = []
                  reqList.forEach(r => {
                    const parsedName = parseMaterialName(r.details)
                    const key = r.nomenclature_id || parsedName
                    const existing = displayedRequests.find(dr => 
                      (dr.nomenclature_id && dr.nomenclature_id === r.nomenclature_id) || 
                      parseMaterialName(dr.details) === parsedName
                    )
                    if (existing) {
                      existing.quantity = (Number(existing.quantity) || 0) + (Number(r.quantity) || 0)
                    } else {
                      displayedRequests.push({ ...r })
                    }
                  })
                  
                  return displayedRequests.map(r => {
                    const parsedName = parseMaterialName(r.details)
                    const nom = r.nomenclature_id ? (nomenclatures || []).find(n => String(n.id) === String(r.nomenclature_id)) : null
                    const isConsumable = nom?.type === 'consumable' || (parsedName || '').toLowerCase().includes('фреза')
                    const isEditing = editingQty.hasOwnProperty(r.id)
                    const isSaving = savingQty.has(r.id)
                    return (
                      <li key={r.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: '0.78rem', color: '#888', padding: '4px 0',
                        borderBottom: '1px solid #1a1a1a'
                      }}>
                        <span style={{ flex: 1, marginRight: '8px' }}>
                          {parsedName || r.details}
                          {nom?.description && (
                            <span style={{ color: '#06b6d4', fontSize: '0.72rem', marginLeft: '6px', fontWeight: 'bold' }}>
                              ({nom.description})
                            </span>
                          )}
                        </span>
                        {isEditing ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="0"
                              value={editingQty[r.id]}
                              onChange={e => setEditingQty(prev => ({ ...prev, [r.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveConsumableQty(r.id); if (e.key === 'Escape') setEditingQty(prev => { const n={...prev}; delete n[r.id]; return n }) }}
                              autoFocus
                              style={{
                                width: '60px', background: '#000', border: '1px solid #ff9000',
                                color: '#fff', borderRadius: '5px', padding: '3px 6px',
                                fontSize: '0.78rem', outline: 'none'
                              }}
                            />
                            <button
                              onClick={() => handleSaveConsumableQty(r.id)}
                              disabled={isSaving}
                              style={{ background: '#10b981', border: 'none', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', color: '#000', display: 'flex', alignItems: 'center' }}
                              title="Зберегти"
                            >
                              {isSaving ? '...' : <Check size={12} />}
                            </button>
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: isConsumable ? '#f59e0b' : '#aaa' }}>{r.quantity} од.</strong>
                            {isConsumable && currentUser?.position === 'Адмін' && (
                              <button
                                onClick={() => setEditingQty(prev => ({ ...prev, [r.id]: String(r.quantity) }))}
                                style={{ background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', transition: '0.15s' }}
                                title="Редагувати кількість"
                                onMouseEnter={e => e.currentTarget.style.color = '#ff9000'}
                                onMouseLeave={e => e.currentTarget.style.color = '#555'}
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                            {currentUser?.login === 'admin@workshop.local' && (
                              <button
                                onClick={() => handleDeleteRequest(r.id)}
                                style={{ background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center', transition: '0.15s' }}
                                title="Видалити запит"
                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.color = '#888'}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </span>
                        )}
                      </li>
                    )
                  })
                })()}
              </ul>
              <button
                disabled={isAwaiting || processingTasks.has(taskId)}
                onClick={async () => {
                  if (isAwaiting || processingTasks.has(taskId)) return
                  
                  if (btnLabel === 'ПРИЙОМКА') {
                    setShowReception(true)
                    return
                  }

                  if (isAllIssued && missingItems.length === 0) {
                    await approveWarehouse(taskId)
                  } else {
                    handleReserveOrder(taskId, orderId, displayNum, reqList)
                  }
                }}
                style={{
                  width: '100%', padding: '12px',
                  background: btnColor, color: textColor,
                  border: isAwaiting ? '1px solid #222' : 'none',
                  borderRadius: '10px', fontWeight: 900,
                  cursor: (isAwaiting || processingTasks.has(taskId)) ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem', textTransform: 'uppercase',
                  opacity: processingTasks.has(taskId) ? 0.5 : 1
                }}
              >
                {processingTasks.has(taskId) ? 'ОБРОБКА...' : btnLabel}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
