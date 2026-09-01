import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Terminal.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Add helper function before renderStorageExplorer
const helperFunctionCode = `
  const calculateTotalBufferParts = () => {
    const taskGroups = {}
    const bufferCards = (workCards || []).filter(c =>
      c.status === 'at-shop2-buffer' || (c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'new' || c.status === 'at-buffer'))
    )

    bufferCards.forEach(card => {
      const taskId = card.task_id || 'unassigned'
      if (!taskGroups[taskId]) taskGroups[taskId] = {}
      const nomId = card.nomenclature_id
      if (!taskGroups[taskId][nomId]) taskGroups[taskId][nomId] = 0
      taskGroups[taskId][nomId] += Number(card.quantity) || 0
    })

    const shop2Inventory = (inventory || []).filter(i => (i.type === 'semi_shop2' || i.type === 'bz_shop2') && Number(i.total_qty) > 0)

    shop2Inventory.forEach(inv => {
      const nomId = inv.nomenclature_id
      let targetTaskId = Object.keys(taskGroups).find(tid => taskGroups[tid][nomId] !== undefined)

      if (!targetTaskId) {
        const cardMatch = (workCards || []).find(c => String(c.nomenclature_id) === String(nomId) && (c.task_id || c.card_info?.includes('Наряд №')))
        let matchedTask = null
        if (cardMatch?.task_id) {
          matchedTask = (tasks || []).find(t => String(t.id) === String(cardMatch.task_id))
        }

        if (!matchedTask) {
          matchedTask = (tasks || []).find(t => {
            const parts = t.plan_snapshot?.parts || []
            return parts.some(p => String(p.nomenclature_id || p.id) === String(nomId))
          })
        }

        if (!matchedTask) {
          const matchedOrder = (orders || []).find(o => (o.order_items || []).some(it => String(it.nomenclature_id) === String(matchedOrder.id)))
          if (matchedOrder) {
            matchedTask = (tasks || []).find(t => String(t.order_id) === String(matchedOrder.id))
          }
        }

        targetTaskId = matchedTask ? matchedTask.id : 'unassigned'
        if (!taskGroups[targetTaskId]) taskGroups[targetTaskId] = {}
      }

      const currentQty = taskGroups[targetTaskId][nomId] || 0
      if (Number(inv.total_qty) > currentQty) {
        taskGroups[targetTaskId][nomId] = Number(inv.total_qty)
      }
    })

    let totalBufferPartsCount = 0
    Object.values(taskGroups).forEach(group => {
      Object.values(group).forEach(qty => {
        if (qty > 0) totalBufferPartsCount += qty
      })
    })

    return totalBufferPartsCount
  }
`

if (!content.includes('const calculateTotalBufferParts = () =>')) {
  content = content.replace('const renderStorageExplorer = () => {', `${helperFunctionCode}\n  const renderStorageExplorer = () => {`)
}

// Now replace widget card computation in Shop2Terminal.jsx:
const oldWidgetCode = `{/* ───── КАРТКА ВХІДНОГО БУФЕРА ───── */}
                {(() => {
                  const streamingIncoming = (workCards || [])
                    .filter(c => c.status === 'at-shop2-buffer')
                    .reduce((a, c) => a + (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0), 0)

                  const totalIncoming = (inventory || [])
                    .filter(i => i.type === 'semi_shop2' || i.type === 'bz_shop2')
                    .reduce((a, i) => a + (Number(i.total_qty) || 0), 0)

                  const totalTaken = workCards
                    .filter(c => c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'in-progress' || c.status === 'at-buffer' || c.status === 'waiting-buffer'))
                    .reduce((a, c) => a + (c.quantity || 0), 0)

                  const bufferQty = Math.max(streamingIncoming, Math.max(0, totalIncoming - totalTaken))

                  return (
                    <div onClick={() => setShowStorageExplorer(true)} style={{ background: '#111', border: '1px solid #8b5cf644', borderRadius: '24px', padding: '20px', cursor: 'pointer', transition: '0.3s', boxShadow: '0 10px 30px -10px rgba(139, 92, 246, 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: '#8b5cf6', fontSize: '0.7rem', fontWeight: 950, textTransform: 'uppercase' }}>ВХІДНИЙ БУФЕР</span>
                        <Package size={14} color="#8b5cf6" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: '#8b5cf6', fontWeight: 800 }}>ВІЛЬНІ ДЕТАЛІ</div>
                          <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{bufferQty}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px', gridColumn: 'span 2' }}>
                          <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 800 }}>СТАН БУФЕРА</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: bufferQty > 0 ? '#8b5cf6' : '#444', marginTop: '4px' }}>
                            {bufferQty > 0 ? 'Вільні для нових карток' : 'Буфер порожній'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}`

const newWidgetCode = `{/* ───── КАРТКА ВХІДНОГО БУФЕРА ───── */}
                {(() => {
                  const bufferQty = calculateTotalBufferParts()

                  return (
                    <div onClick={() => setShowStorageExplorer(true)} style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, rgba(139, 92, 246, 0.3))', borderRadius: '24px', padding: '20px', cursor: 'pointer', transition: '0.3s', boxShadow: '0 10px 30px -10px rgba(139, 92, 246, 0.15)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: '#8b5cf6', fontSize: '0.7rem', fontWeight: 950, textTransform: 'uppercase' }}>ВХІДНИЙ БУФЕР</span>
                        <Package size={14} color="#8b5cf6" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: '#8b5cf6', fontWeight: 800 }}>ВІЛЬНІ ДЕТАЛІ</div>
                          <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: 'var(--text-primary, #0f172a)', lineHeight: 1 }}>{bufferQty.toLocaleString('uk-UA')}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid var(--border-color, #e2e8f0)', paddingLeft: '8px', gridColumn: 'span 2' }}>
                          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted, #64748b)', fontWeight: 800 }}>СТАН БУФЕРА</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: bufferQty > 0 ? '#8b5cf6' : 'var(--text-muted, #64748b)', marginTop: '4px' }}>
                            {bufferQty > 0 ? 'Вільні для нових карток' : 'Буфер порожній'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}`

content = content.replace(/\r\n/g, '\n')
const oldNorm = oldWidgetCode.replace(/\r\n/g, '\n')
const newNorm = newWidgetCode.replace(/\r\n/g, '\n')

if (content.includes(oldNorm)) {
  content = content.replace(oldNorm, newNorm)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Successfully updated widget buffer calculation!')
} else {
  console.log('Old widget code not matched exactly, replacing using regex fallback...')
  content = content.replace(/\{\/\* ───── КАРТКА ВХІДНОГО БУФЕРА ───── \*\/\}[\s\S]*?\}\)\(\)\}/, newNorm)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Successfully replaced widget buffer calculation with regex!')
}
