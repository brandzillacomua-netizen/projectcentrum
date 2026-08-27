import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers, X, RefreshCw } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'

export const ReserveAnalysisModal = ({
  item,
  onClose,
  requests = [],
  orders = [],
  tasks = [],
  nomenclatures = []
}) => {
  if (!item) return null

  const { refreshTable } = useMES()
  const [isSyncing, setIsSyncing] = useState(false)

  const safeRequests = Array.isArray(requests) ? requests : (requests && typeof requests === 'object' ? Object.values(requests) : [])
  const safeOrders = Array.isArray(orders) ? orders : (orders && typeof orders === 'object' ? Object.values(orders) : [])
  const safeTasks = Array.isArray(tasks) ? tasks : (tasks && typeof tasks === 'object' ? Object.values(tasks) : [])
  const safeNomenclatures = Array.isArray(nomenclatures) ? nomenclatures : (nomenclatures && typeof nomenclatures === 'object' ? Object.values(nomenclatures) : [])

  // Find all requests matching this inventory item or nomenclature with status 'approved', 'reserved', or 'issued'
  const matchedRequests = safeRequests.filter(r => 
    r && (String(r.inventory_id) === String(item.id) || (r.nomenclature_id && String(r.nomenclature_id) === String(item.nomenclature_id))) && 
    (r.status === 'approved' || r.status === 'reserved' || r.status === 'issued')
  )

  const reserveDetails = (Array.isArray(matchedRequests) ? matchedRequests : []).map(req => {
    let orderNum = '—'
    if (req.order_id) {
      const order = safeOrders.find(o => String(o.id) === String(req.order_id))
      if (order) orderNum = order.order_num
    }
    if (orderNum === '—' && req.task_id) {
      const task = safeTasks.find(t => String(t.id) === String(req.task_id))
      if (task) {
        const order = safeOrders.find(o => String(o.id) === String(task.order_id))
        if (order) orderNum = order.order_num
      }
    }
    
    let productName = '—'
    if (req.task_id) {
      const task = safeTasks.find(t => String(t.id) === String(req.task_id))
      if (task && task.nomenclature_id) {
        const nom = safeNomenclatures.find(n => String(n.id) === String(task.nomenclature_id))
        if (nom) productName = nom.name
      }
    }
    if (productName === '—' && req.order_id) {
      const order = safeOrders.find(o => String(o.id) === String(req.order_id))
      if (order && order.nomenclature_id) {
        const nom = safeNomenclatures.find(n => String(n.id) === String(order.nomenclature_id))
        if (nom) productName = nom.name
      }
    }

    return {
      id: `req-${req.id}`,
      orderNum: orderNum || 'Запит боксу',
      productName,
      quantity: Number(req.quantity) || 0,
      date: req.created_at ? new Date(req.created_at).toLocaleDateString('uk-UA') : '—',
      taskId: req.task_id,
      orderId: req.order_id
    }
  })

  // Also include active unstarted preparation tasks for production warehouse
  safeTasks.filter(t => t && t.step === 'Підготовка' && t.status === 'pending' && t.warehouse_conf === 'true').forEach(t => {
    if (t.plan_snapshot) {
      let snapshot = t.plan_snapshot
      if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot) } catch (e) { snapshot = {} }
      }
      if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        Object.values(snapshot).forEach(part => {
          if (!part || typeof part !== 'object') return
          const nomId = String(part.id || part.nomenclature_id || '')
          const pName = (part.name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim()
          const iName = (item.name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim()

          if ((nomId && String(nomId) === String(item.nomenclature_id)) || pName === iName) {
            const qty = Number(part.sheets || part.plan || part.need || 0)
            if (qty > 0) {
              reserveDetails.push({
                id: `prep-${t.id}-${part.id}`,
                orderNum: t.naryad_number || t.plan_snapshot?._prep_num || 'Наряд Підготовка',
                productName: 'Підготовка листа',
                quantity: qty,
                date: t.created_at ? new Date(t.created_at).toLocaleDateString('uk-UA') : '—',
                taskId: t.id
              })
            }
          }
        })
      }
    }
  })

  const totalCalculated = reserveDetails.reduce((sum, d) => sum + d.quantity, 0)
  const dbReserved = Number(item.reserved_qty) || 0
  const hasMismatch = totalCalculated !== dbReserved

  const handleSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ reserved_qty: totalCalculated })
        .eq('id', item.id)
      
      if (error) throw error
      alert('Резерв успішно синхронізовано з реальними накладними!')
      if (typeof refreshTable === 'function') {
        refreshTable('inventory')
      }
      onClose()
    } catch (err) {
      alert('Помилка синхронізації: ' + err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '650px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: '#3b82f6', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 900 }}>
              <Layers size={22} /> АНАЛІЗ РЕЗЕРВУ
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#ff9000', margin: '4px 0 0', fontWeight: 700 }}>
              {item.name}
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ background: '#222', border: 'none', color: '#888', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#888' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '5px' }}>
          {reserveDetails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666', background: '#0a0a0a', border: '1px dashed #222', borderRadius: '16px' }}>
              Не знайдено активних запитів резервування в системі.
              <br />
              <span style={{ fontSize: '0.75rem', color: '#444' }}>Можливо, резерв був відредагований адміністратором вручну.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #222', color: '#555', fontWeight: 800 }}>
                  <th style={{ padding: '10px' }}>НАРЯД</th>
                  <th style={{ padding: '10px' }}>ВИРІБ (ПРОДУКЦІЯ)</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>ДАТА</th>
                </tr>
              </thead>
              <tbody>
                {reserveDetails.map((detail, idx) => (
                  <tr key={detail.id || idx} style={{ borderBottom: '1px solid #1a1a1a', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 800 }}>
                      {detail.taskId ? (
                        <Link
                          to={`/master?task=${detail.taskId}`}
                          style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
                          onClick={onClose}
                        >
                          {detail.orderNum}
                        </Link>
                      ) : detail.orderId ? (
                        <Link
                          to={`/master?order=${detail.orderId}`}
                          style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
                          onClick={onClose}
                        >
                          {detail.orderNum}
                        </Link>
                      ) : (
                        <span style={{ color: '#888' }}>{detail.orderNum}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 10px', color: '#ddd', fontWeight: 700 }}>
                      {detail.productName}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 900, color: '#ff9000', fontSize: '0.9rem' }}>
                      {detail.quantity} <span style={{ fontSize: '0.7rem', color: '#555', fontWeight: 400 }}>{item.unit || 'шт'}</span>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: '#666' }}>
                      {detail.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info & close button */}
        <div style={{ borderTop: '1px solid #222', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>За розписом: <strong style={{ color: '#fff' }}>{totalCalculated} {item.unit || 'шт'}</strong></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Зафіксовано в БД: <strong style={{ color: hasMismatch ? '#ef4444' : '#3b82f6' }}>{dbReserved} {item.unit || 'шт'}</strong></span>
              {hasMismatch && (
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Синхронізувати число резерву в БД з реальними накладними"
                >
                  <RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''} />
                  <span>Виправити лічильник</span>
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#3b82f6', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
            onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
          >
            ЗАКРИТИ
          </button>
        </div>

      </div>
    </div>
  )
}
