import React, { useState, useEffect } from 'react'
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

  const { refreshTable, theme } = useMES()
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.body.classList.contains('light-theme'))
  const [isSyncing, setIsSyncing] = useState(false)
  const [bzReservations, setBzReservations] = useState([])

  useEffect(() => {
    if (!item?.nomenclature_id) return
    supabase
      .from('bz_inventory_reservations')
      .select('*')
      .eq('nomenclature_id', item.nomenclature_id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!error && Array.isArray(data)) {
          setBzReservations(data)
        }
      })
  }, [item?.nomenclature_id])

  const safeRequests = Array.isArray(requests) ? requests : (requests && typeof requests === 'object' ? Object.values(requests) : [])
  const safeOrders = Array.isArray(orders) ? orders : (orders && typeof orders === 'object' ? Object.values(orders) : [])
  const safeTasks = Array.isArray(tasks) ? tasks : (tasks && typeof tasks === 'object' ? Object.values(tasks) : [])
  const safeNomenclatures = Array.isArray(nomenclatures) ? nomenclatures : (nomenclatures && typeof nomenclatures === 'object' ? Object.values(nomenclatures) : [])

  // Find all requests matching this inventory item or nomenclature with status 'approved', 'reserved', 'issued' or 'pending'
  const matchedRequests = safeRequests.filter(r => 
    r && (String(r.inventory_id) === String(item.id) || (r.nomenclature_id && String(r.nomenclature_id) === String(item.nomenclature_id))) && 
    (r.status === 'approved' || r.status === 'reserved' || r.status === 'issued' || r.status === 'pending')
  )

  const reserveDetails = (Array.isArray(matchedRequests) ? matchedRequests : []).map(req => {
    let orderNum = '—'
    let isPrep = false
    const task = req.task_id ? safeTasks.find(t => String(t.id) === String(req.task_id)) : null

    if (req.order_id) {
      const order = safeOrders.find(o => String(o.id) === String(req.order_id))
      if (order) orderNum = order.order_num
    }
    if (orderNum === '—' && task) {
      if (task.order_id) {
        const order = safeOrders.find(o => String(o.id) === String(task.order_id))
        if (order) orderNum = order.order_num
      }
      if (task.step === 'Підготовка' || task.plan_snapshot?._prep_num) {
        isPrep = true
        orderNum = task.plan_snapshot?._prep_num || 'Наряд Підготовка'
      }
    }

    // Fallback extraction from req.details if orderNum is still '—'
    if (orderNum === '—' && req.details) {
      const prepMatch = req.details.match(/ЗАПИТ НА ПІДГОТОВКУ\s*\(([^)]+)\)/i)
      const orderMatch = req.details.match(/для наряду\s+([^\s)]+)/i)
      const packagingMatch = req.details.match(/ЗАПИТ НА КОМПЛЕКТУВАННЯ\s*\(([^)]+)\)/i)
      if (prepMatch) {
        orderNum = prepMatch[1]
        isPrep = true
      } else if (orderMatch) {
        orderNum = orderMatch[1]
      } else if (packagingMatch) {
        orderNum = packagingMatch[1]
      }
    }
    
    let productName = '—'
    if (task && task.nomenclature_id) {
      const nom = safeNomenclatures.find(n => String(n.id) === String(task.nomenclature_id))
      if (nom) productName = nom.name
    }
    if (productName === '—' && req.order_id) {
      const order = safeOrders.find(o => String(o.id) === String(req.order_id))
      if (order && order.nomenclature_id) {
        const nom = safeNomenclatures.find(n => String(n.id) === String(order.nomenclature_id))
        if (nom) productName = nom.name
      }
    }

    // Fallback product name for preparation or from details
    if (productName === '—') {
      if (isPrep || (req.details && req.details.includes('ПІДГОТОВК'))) {
        if (req.details) {
          const detailParts = req.details.split(':')
          if (detailParts[1]) {
            const rawName = detailParts[1].split('—')[0].trim()
            if (rawName) productName = `Підготовка: ${rawName}`
          }
        }
        if (productName === '—') {
          productName = `Підготовка (${item.name})`
        }
      } else if (req.details) {
        const detailParts = req.details.split(':')
        if (detailParts[1]) {
          productName = detailParts[1].split('—')[0].trim()
        }
      }
    }

    return {
      id: `req-${req.id}`,
      rawReqId: req.id,
      orderNum: orderNum || 'Запит боксу',
      productName,
      quantity: Number(req.quantity) || 0,
      date: req.created_at ? new Date(req.created_at).toLocaleDateString('uk-UA') : '—',
      taskId: req.task_id,
      orderId: req.order_id,
      isPrep
    }
  })

  // Include active unstarted preparation tasks for production warehouse
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

  // Include BZ reservations from database (only active, allocated reservations for existing tasks/orders)
  bzReservations.filter(res => res && res.status === 'allocated').forEach(res => {
    const qty = Number(res.allocated_qty || 0)
    if (qty > 0) {
      const task = res.task_id ? safeTasks.find(t => String(t.id) === String(res.task_id)) : null
      const order = res.order_id ? safeOrders.find(o => String(o.id) === String(res.order_id)) : null

      // Ignore reservations whose task or order was deleted/completed
      if (res.task_id && (!task || ['completed', 'cancelled'].includes(task.status))) return
      if (res.order_id && (!order || ['completed', 'delivered', 'shipped', 'cancelled'].includes(order.status))) return
      if (!task && !order) return

      const alreadyListed = reserveDetails.some(d => (d.orderId && String(d.orderId) === String(res.order_id)) || (d.taskId && String(d.taskId) === String(res.task_id)))
      if (!alreadyListed) {
        reserveDetails.push({
          id: `bz-res-${res.id}`,
          orderNum: order?.order_num || task?.order_num || `Бронь #${String(res.order_id || res.id).slice(-6)}`,
          productName: item.name || 'Готова деталь',
          quantity: qty,
          date: res.created_at ? new Date(res.created_at).toLocaleDateString('uk-UA') : '—',
          orderId: res.order_id,
          taskId: res.task_id
        })
      }
    }
  })

  // Include tasks where plan_snapshot recorded stock deduction for this part
  safeTasks.filter(t => t && t.status !== 'completed' && t.status !== 'cancelled').forEach(t => {
    let snapshot = t.plan_snapshot
    if (typeof snapshot === 'string') {
      try { snapshot = JSON.parse(snapshot) } catch (e) { snapshot = {} }
    }
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      const partKey = String(item.nomenclature_id || '')
      const partData = snapshot[partKey] || Object.values(snapshot).find(p => p && (String(p.id) === partKey || p.name === item.name))
      if (partData && Number(partData.stock || 0) > 0) {
        const alreadyListed = reserveDetails.some(d => (d.taskId && String(d.taskId) === String(t.id)) || (d.orderId && String(d.orderId) === String(t.order_id)))
        if (!alreadyListed) {
          const order = safeOrders.find(o => String(o.id) === String(t.order_id))
          reserveDetails.push({
            id: `task-stock-${t.id}-${partKey}`,
            orderNum: order?.order_num || t.naryad_number || `Наряд #${String(t.id).slice(-6)}`,
            productName: partData.name || item.name,
            quantity: Number(partData.stock),
            date: t.created_at ? new Date(t.created_at).toLocaleDateString('uk-UA') : '—',
            taskId: t.id,
            orderId: t.order_id
          })
        }
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

  const handleCancelRequest = async (reqId, qty) => {
    if (!window.confirm(`Скасувати цей запит на резервування (${qty} ${item.unit || 'шт'}) та звільнити залишок?`)) return
    try {
      const { error: reqErr } = await supabase
        .from('material_requests')
        .update({ status: 'cancelled' })
        .eq('id', reqId)
      if (reqErr) throw reqErr

      const newReserved = Math.max(0, (Number(item.reserved_qty) || 0) - qty)
      await supabase
        .from('inventory')
        .update({ reserved_qty: newReserved })
        .eq('id', item.id)

      alert('Запит успішно скасовано, резерв звільнено!')
      if (typeof refreshTable === 'function') {
        refreshTable('inventory')
        refreshTable('material_requests')
      }
      onClose()
    } catch (err) {
      alert('Помилка: ' + err.message)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: isLight ? '#ffffff' : '#12141c', border: `1.5px solid ${isLight ? '#cbd5e1' : '#232938'}`, borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '750px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: isLight ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)' : '0 10px 30px rgba(0,0,0,0.6)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: isLight ? '#0284c7' : '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', fontWeight: 950 }}>
              <Layers size={22} /> АНАЛІЗ РЕЗЕРВУ
            </h3>
            <p style={{ fontSize: '0.9rem', color: isLight ? '#b45309' : '#fbbf24', margin: '6px 0 0', fontWeight: 800 }}>
              {item.name}
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ background: isLight ? '#f1f5f9' : '#1a1e2b', border: `1px solid ${isLight ? '#cbd5e1' : '#2d3748'}`, color: isLight ? '#475569' : '#94a3b8', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = isLight ? '#e2e8f0' : '#2d3748'; e.currentTarget.style.color = isLight ? '#0f172a' : '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#f1f5f9' : '#1a1e2b'; e.currentTarget.style.color = isLight ? '#475569' : '#94a3b8' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '5px' }}>
          {reserveDetails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: isLight ? '#64748b' : '#94a3b8', background: isLight ? '#f8fafc' : '#161924', border: `1px dashed ${isLight ? '#cbd5e1' : '#2a3245'}`, borderRadius: '16px' }}>
              Не знайдено активних запитів резервування в системі.
              <br />
              <span style={{ fontSize: '0.75rem', color: isLight ? '#94a3b8' : '#64748b' }}>Можливо, резерв був відредагований адміністратором вручну.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${isLight ? '#e2e8f0' : '#1f2430'}`, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 800 }}>
                  <th style={{ padding: '10px' }}>НАРЯД</th>
                  <th style={{ padding: '10px' }}>ВИРІБ (ПРОДУКЦІЯ)</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>ДАТА</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '80px' }}>ДІЯ</th>
                </tr>
              </thead>
              <tbody>
                {reserveDetails.map((detail, idx) => (
                  <tr key={detail.id || idx} style={{ borderBottom: `1px solid ${isLight ? '#f1f5f9' : '#1a1e2a'}`, background: idx % 2 === 0 ? 'transparent' : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.015)') }}>
                    <td style={{ padding: '12px 10px', fontWeight: 800 }}>
                      {detail.isPrep ? (
                        <span style={{ color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>{detail.orderNum}</span>
                          <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: isLight ? '#e0f2fe' : 'rgba(56, 189, 248, 0.15)', color: isLight ? '#0284c7' : '#38bdf8', fontWeight: 700 }}>Підготовка</span>
                        </span>
                      ) : detail.taskId ? (
                        <Link
                          to={`/master?task=${detail.taskId}`}
                          style={{ color: isLight ? '#0284c7' : '#38bdf8', textDecoration: 'underline', cursor: 'pointer', fontWeight: 900 }}
                          onClick={onClose}
                        >
                          {detail.orderNum}
                        </Link>
                      ) : detail.orderId ? (
                        <Link
                          to={`/master?order=${detail.orderId}`}
                          style={{ color: isLight ? '#0284c7' : '#38bdf8', textDecoration: 'underline', cursor: 'pointer', fontWeight: 900 }}
                          onClick={onClose}
                        >
                          {detail.orderNum}
                        </Link>
                      ) : (
                        <span style={{ color: isLight ? '#475569' : '#cbd5e1', fontWeight: 800 }}>{detail.orderNum}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 10px', color: isLight ? '#0f172a' : '#f8fafc', fontWeight: 700 }}>
                      {detail.productName}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.12)',
                        color: isLight ? '#b45309' : '#fbbf24',
                        fontWeight: 950,
                        fontSize: '0.9rem'
                      }}>
                        {Number(detail.quantity || 0).toLocaleString('uk-UA')} <small style={{ fontSize: '0.7rem', opacity: 0.8 }}>{item.unit || 'шт'}</small>
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', color: isLight ? '#64748b' : '#94a3b8' }}>
                      {detail.date}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      {detail.rawReqId && (
                        <button
                          onClick={() => handleCancelRequest(detail.rawReqId, detail.quantity)}
                          style={{
                            background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)',
                            border: `1px solid ${isLight ? '#fecaca' : 'rgba(239, 68, 68, 0.3)'}`,
                            color: '#ef4444',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: '0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
                          onMouseLeave={e => { e.currentTarget.style.background = isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)'; e.currentTarget.style.color = '#ef4444' }}
                          title="Скасувати запит та звільнити цей резерв"
                        >
                          Звільнити
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info & close button */}
        <div style={{ borderTop: `1.5px solid ${isLight ? '#e2e8f0' : '#1f2430'}`, paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: isLight ? '#64748b' : '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>За розписом: <strong style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{totalCalculated.toLocaleString('uk-UA')} {item.unit || 'шт'}</strong></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Зафіксовано в БД: <strong style={{ color: hasMismatch ? '#ef4444' : (isLight ? '#0284c7' : '#38bdf8') }}>{dbReserved.toLocaleString('uk-UA')} {item.unit || 'шт'}</strong></span>
              {hasMismatch && (
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  style={{
                    background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${isLight ? '#fecaca' : 'rgba(239, 68, 68, 0.3)'}`,
                    color: '#ef4444',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.68rem',
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
            style={{ background: isLight ? '#0284c7' : '#3b82f6', color: '#ffffff', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)' }}
            onMouseEnter={e => e.currentTarget.style.background = '#0369a1'}
            onMouseLeave={e => e.currentTarget.style.background = isLight ? '#0284c7' : '#3b82f6'}
          >
            ЗАКРИТИ
          </button>
        </div>

      </div>
    </div>
  )
}
