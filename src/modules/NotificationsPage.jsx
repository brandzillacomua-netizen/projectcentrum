import React, { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Monitor,
  KanbanSquare,
  ClipboardList,
  Tablet,
  ShoppingBag,
  Warehouse,
  AlertTriangle
} from 'lucide-react'
import { useMES } from '../MESContext'

const NotificationsPage = () => {
  const navigate = useNavigate()
  const {
    currentUser,
    managementTasks,
    requests,
    workCards,
    purchaseRequests,
    receptionDocs,
    nomenclatures,
    machineCalls,
    machines,
    tasks,
    orders
  } = useMES()

  const [activeFilter, setActiveFilter] = useState('all')

  const [readNotifIds, setReadNotifIds] = useState(() => {
    if (!currentUser) return []
    try {
      const saved = localStorage.getItem(`MES_READ_NOTIF_${currentUser.id}`)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`MES_READ_NOTIF_${currentUser.id}`, JSON.stringify(readNotifIds))
    }
  }, [readNotifIds, currentUser])

  const notifications = useMemo(() => {
    const list = []
    if (!currentUser) return list

    // 0. New Orders awaiting Batch/Task
    if (orders) {
      orders.forEach(order => {
        if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return
        const orderTasks = (tasks || []).filter(t => t.order_id === order.id)
        if (orderTasks.length === 0 && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'shipped') {
          const productNames = (order.order_items || [])
            .map(it => nomenclatures?.find(n => n.id === it.nomenclature_id)?.name)
            .filter(Boolean)
            .join(', ') || '—'

          list.push({
            id: `order-new-${order.id}`,
            category: 'orders',
            title: `Нове замовлення № ${order.order_num}`,
            description: `Очікує на створення наряду. Виріб: ${productNames}`,
            createdAt: order.created_at,
            path: '/master',
            color: '#3b82f6',
            icon: <Monitor size={18} />
          })
        }
      })
    }

    // 1. Kanban Tasks
    if (managementTasks) {
      managementTasks.forEach(t => {
        if (t.status !== 'done' && (t.assigned_to === currentUser.login || t.created_by === currentUser.login)) {
          list.push({
            id: `task-${t.id}`,
            category: 'tasks',
            title: `Задача: ${t.title || 'Без назви'}`,
            description: t.description || 'Немає опису',
            createdAt: t.created_at,
            path: '/tasks',
            color: '#8b5cf6',
            icon: <KanbanSquare size={18} />
          })
        }
      })
    }

    // 2. Material Requests
    if (requests) {
      const groups = {}
      requests.forEach(r => {
        if (r.status === 'pending') {
          const order = orders?.find(o => o.id === r.order_id)
          const orderNum = order?.order_num || ''
          let batchIndex = ''
          if (r.details) {
            const batchMatch = r.details.match(/\(([^)]+\/\d+)\)/)
            if (batchMatch) {
              const parts = batchMatch[1].split('/')
              batchIndex = parts[parts.length - 1]
            }
          }
          if (!batchIndex && r.task_id && tasks) {
            const task = tasks.find(t => t.id === r.task_id)
            if (task?.batch_index) batchIndex = task.batch_index
          }

          const groupKey = `${r.order_id}_${r.task_id || 'null'}_${batchIndex || 'no-batch'}`
          if (!groups[groupKey]) {
            groups[groupKey] = { orderId: r.order_id, orderNum, batchIndex, taskId: r.task_id, count: 0, items: [], latestCreatedAt: r.created_at }
          }
          groups[groupKey].count += 1
          if (r.created_at > groups[groupKey].latestCreatedAt) groups[groupKey].latestCreatedAt = r.created_at
          let itemName = ''
          if (r.details) {
            const splitCol = r.details.split(': ')
            itemName = splitCol.length > 1 ? splitCol[1].split(' — ')[0] : r.details
          }
          if (itemName) groups[groupKey].items.push(itemName)
        }
      })

      Object.entries(groups).forEach(([key, g]) => {
        const batchStr = g.batchIndex ? `/${g.batchIndex}` : ''
        const orderPart = g.orderNum ? ` (№ ${g.orderNum}${batchStr})` : ''
        const desc = g.count === 1 ? (g.items[0] || 'Новий запит матеріалу') : `Запит на ${g.count} позицій: ${g.items.slice(0, 3).join(', ')}${g.items.length > 3 ? '...' : ''}`

        list.push({
          id: `req-group-${key}`,
          category: 'materials',
          title: `Запит матеріалів${orderPart}`,
          description: desc,
          createdAt: g.latestCreatedAt,
          path: '/warehouse',
          color: '#10b981',
          icon: <ClipboardList size={18} />,
          state: { highlightTaskId: g.taskId }
        })
      })
    }

    // 3. Work Cards
    if (workCards) {
      workCards.forEach(w => {
        if (w.status === 'new') {
          list.push({
            id: `wc-${w.id}`,
            category: 'tasks',
            title: `Нова картка: ${w.operation || 'Операція'}`,
            description: w.card_info || `Кількість: ${w.quantity}`,
            createdAt: w.created_at,
            path: '/shop1',
            color: '#eab308',
            icon: <Tablet size={18} />
          })
        }
      })
    }

    // 4. Machine Calls
    if (machineCalls) {
      machineCalls.forEach(c => {
        if (c.status === 'pending') {
          const mach = machines?.find(m => m.id === c.machine_id)
          const machName = mach ? mach.name : 'Верстат'
          list.push({
            id: `call-${c.id}`,
            category: 'machines',
            title: `Виклик до ${machName}`,
            description: c.reason || 'Аварійна зупинка / Наналагодження',
            createdAt: c.created_at,
            path: '/machines',
            color: '#ef4444',
            icon: <AlertTriangle size={18} />
          })
        }
      })
    }

    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines, tasks, orders])

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications
    return notifications.filter(n => n.category === activeFilter)
  }, [notifications, activeFilter])

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readNotifIds.includes(n.id)).length
  }, [notifications, readNotifIds])

  const markNotifAsRead = (id) => {
    setReadNotifIds(prev => prev.includes(id) ? prev : [...prev, id])
  }

  const markAllNotifsAsRead = () => {
    setReadNotifIds(notifications.map(n => n.id))
  }

  const handleNotificationClick = (item) => {
    markNotifAsRead(item.id)
    if (item.path) {
      navigate(item.path, { state: item.state })
    }
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffSec = Math.floor((now - date) / 1000)
      if (diffSec < 60) return 'щойно'
      const diffMin = Math.floor(diffSec / 60)
      if (diffMin < 60) return `${diffMin} хв. тому`
      const diffHours = Math.floor(diffMin / 60)
      if (diffHours < 24) return `${diffHours} год. тому`
      const diffDays = Math.floor(diffHours / 24)
      if (diffDays === 1) return 'вчора'
      return `${diffDays} дн. тому`
    } catch {
      return ''
    }
  }

  return (
    <div className="notif-page-root" style={{ background: 'var(--bg, #090a0f)', minHeight: '100vh', color: 'var(--text, #fff)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header className="notif-page-header" style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
        background: 'var(--card-bg, #0b0d14)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
          {/* Left: Back button + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(255,144,0,0.08)',
                border: '1px solid rgba(255,144,0,0.25)',
                color: '#ff9000',
                fontWeight: 800,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '10px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <ArrowLeft size={16} /> Назад
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 950, letterSpacing: '-0.3px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                Сповіщення
              </h1>
              {unreadCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 950,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
          </div>

          {/* Right: Mark all as read button */}
          {unreadCount > 0 && (
            <button
              onClick={markAllNotifsAsRead}
              style={{
                background: 'linear-gradient(135deg, rgba(255,144,0,0.15), rgba(255,144,0,0.08))',
                border: '1px solid rgba(255, 144, 0, 0.3)',
                color: '#ff9000',
                padding: '6px 12px',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Check size={14} /> Прочитати все
            </button>
          )}
        </div>
      </header>

      {/* Filter Tabs Bar */}
      <div className="notif-page-filters" style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 18px',
        overflowX: 'auto',
        borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
        background: 'var(--card-bg, #0b0d14)'
      }}>
        {[
          { id: 'all', label: 'Усі сповіщення' },
          { id: 'orders', label: '📦 Замовлення' },
          { id: 'tasks', label: '📋 Задачі' },
          { id: 'materials', label: '🧱 Матеріали' },
          { id: 'machines', label: '⚠️ Виклики верстатів' }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveFilter(cat.id)}
            style={{
              padding: '8px 14px',
              borderRadius: '12px',
              border: activeFilter === cat.id ? '1px solid #ff9000' : '1px solid var(--glass-border, rgba(255,255,255,0.08))',
              background: activeFilter === cat.id ? 'rgba(255,144,0,0.12)' : 'rgba(255,255,255,0.03)',
              color: activeFilter === cat.id ? '#ff9000' : 'var(--text-muted, #94a3b8)',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Page Content List */}
      <div style={{ flex: 1, maxWidth: '720px', width: '100%', margin: '0 auto', padding: '20px 18px 60px' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <BellOff size={30} />
            </div>
            <div>
              <div style={{ fontWeight: 950, fontSize: '1.05rem' }}>Сповіщень немає</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                У цій категорії немає нових подій
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredNotifications.map(item => {
              const isUnread = !readNotifIds.includes(item.id)
              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    padding: '16px 18px',
                    borderRadius: '18px',
                    background: isUnread ? 'rgba(255,144,0,0.06)' : 'rgba(22, 24, 34, 0.6)',
                    border: `1px solid ${isUnread ? 'rgba(255,144,0,0.35)' : 'var(--glass-border, rgba(255,255,255,0.08))'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    transition: 'all 0.2s ease',
                    boxShadow: isUnread ? '0 4px 20px rgba(255,144,0,0.08)' : 'none'
                  }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: '13px', background: `${item.color}20`, border: `1px solid ${item.color}40`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ fontWeight: isUnread ? 950 : 700, fontSize: '0.92rem', color: isUnread ? 'var(--text, #fff)' : 'var(--text-muted, #cbd5e1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)', flexShrink: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px', lineHeight: 1.45 }}>
                      {item.description}
                    </div>
                  </div>
                  {isUnread && (
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff9000', boxShadow: '0 0 8px #ff9000', marginTop: '6px', flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationsPage
