import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Search, 
  RefreshCw 
} from 'lucide-react'
import { useMES } from '../MESContext'

const DashboardModule = () => {
  const { currentUser, workCards, inventory, nomenclatures, fetchData, orders, bomItems } = useMES()
  const [wipOnly, setWipOnly] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Refetch data on mount and provide manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetchData()
    } catch (e) {
      console.error(e)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Aggregated WIP dashboard data
  const dashboardData = useMemo(() => {
    if (!nomenclatures) return []
    // Filter only parts (ДЕТАЛІ) to keep the dashboard focused exclusively on production details
    const filteredNoms = nomenclatures.filter(n => n.type === 'part')

    return filteredNoms.map(nom => {
      // 1. Розкрій (Робота) - status: in-progress or new
      const qCut = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     (c.operation === 'Розкрій' || c.operation === 'Лазерний розкрій') && 
                     (c.status === 'in-progress' || c.status === 'new'))
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 2. Буфер Розкрою - status: at-buffer
      const qCutBuf = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     (c.operation === 'Розкрій' || c.operation === 'Лазерний розкрій') && 
                     c.status === 'at-buffer')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 3. Галтовка (Робота) - status: in-progress or new
      const qGalt = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Галтовка' && 
                     (c.status === 'in-progress' || c.status === 'new'))
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 4. Буфер Галтовки - status: at-buffer
      const qGaltBuf = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Галтовка' && 
                     c.status === 'at-buffer')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 5. Прийомка (Робота) - status: at-buffer (waiting for sorting)
      const qPriy = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Прийомка')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 5b. Сортування (Робота) - status: in-progress, at-buffer, or new (not yet sent to Shop 2)
      const qSortAct = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Сортування' && 
                     (c.status === 'in-progress' || c.status === 'at-buffer' || c.status === 'new'))
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 6. Буфер Цеху №2 - only cards actually dispatched to Shop 2 buffer
      const qSortCards = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.status === 'at-shop2-buffer')
        .reduce((sum, c) => sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)

      const qSortInv = (inventory || [])
        .filter(i => String(i.nomenclature_id) === String(nom.id) && 
                     ['semi', 'semi_shop2'].includes(i.type))
        .reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

      const qSort = qSortCards + qSortInv

      // 7. Малярка (Робота) - status: in-progress or new
      const qMal = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     (c.operation === 'Фарбування' || c.operation === 'Малярка') && 
                     (c.status === 'in-progress' || c.status === 'new'))
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 8. Пресування (Робота) - status: in-progress or new
      const qPres = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Пресування' && 
                     (c.status === 'in-progress' || c.status === 'new'))
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 9. Доопрацювання (Робота) - status: in-progress, new, or pending
      const qDoop = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Доопрацювання' && 
                     (c.status === 'in-progress' || c.status === 'new' || c.status === 'pending'))
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 10. Склад (СГП)
      const qSgp = (inventory || [])
        .filter(i => String(i.nomenclature_id) === String(nom.id) && 
                     (i.type === 'finished' || i.warehouse === 'sgp'))
        .reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

      // 10b. Склад БЗ
      const qBz = (inventory || [])
        .filter(i => String(i.nomenclature_id) === String(nom.id) && 
                     ['bz', 'wip_bz', 'bz_shop2'].includes(i.type))
        .reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

      const sum = qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qMal + qPres + qDoop + qSgp + qBz

      return {
        id: nom.id,
        name: nom.name,
        code: nom.code || '',
        type: nom.type,
        qCut,
        qCutBuf,
        qGalt,
        qGaltBuf,
        qPriy,
        qSortAct,
        qSort,
        qMal,
        qPres,
        qDoop,
        qSgp,
        qBz,
        sum
      }
    })
  }, [nomenclatures, workCards, inventory])

  // Filter based on search and WIP toggles
  const filteredDashboardData = useMemo(() => {
    return dashboardData.filter(row => {
      const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            row.code.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (!matchesSearch) return false
      if (wipOnly) {
        // WIP only checks if there is any quantity in active stage or buffers
        const hasWip = (row.qCut + row.qCutBuf + row.qGalt + row.qGaltBuf + row.qPriy + row.qSortAct + row.qSort + row.qMal + row.qPres + row.qDoop) > 0
        return hasWip
      }
      return true
    })
  }, [dashboardData, searchQuery, wipOnly])

  // Column Totals over all filtered rows
  const totals = useMemo(() => {
    const res = { qCut: 0, qCutBuf: 0, qGalt: 0, qGaltBuf: 0, qPriy: 0, qSortAct: 0, qSort: 0, qMal: 0, qPres: 0, qDoop: 0, qSgp: 0, qBz: 0, sum: 0 }
    filteredDashboardData.forEach(row => {
      res.qCut += row.qCut
      res.qCutBuf += row.qCutBuf
      res.qGalt += row.qGalt
      res.qGaltBuf += row.qGaltBuf
      res.qPriy += row.qPriy
      res.qSortAct += row.qSortAct
      res.qSort += row.qSort
      res.qMal += row.qMal
      res.qPres += row.qPres
      res.qDoop += row.qDoop
      res.qSgp += row.qSgp
      res.qBz += row.qBz
      res.sum += row.sum
    })
    return res
  }, [filteredDashboardData])

  // ── GROUPING & TRENDS CALCULATIONS ──
  // Calculate completed sets, active demand, and bottlenecks for each parent product
  const productTrends = useMemo(() => {
    if (!nomenclatures || !bomItems || !orders) return {}
    
    // Find all parents of type 'product'
    const parentProducts = nomenclatures.filter(n => n.type === 'product')
    const trends = {}

    parentProducts.forEach(prod => {
      // Find all BOM items for this parent
      const boms = bomItems.filter(b => String(b.parent_id) === String(prod.id))
      if (boms.length === 0) return

      let minPotential = Infinity
      let minActual = Infinity
      let bottleneckPartName = null
      let bottleneckPartCode = null
      let bottleneckQty = Infinity
      let hasValidDetail = false

      boms.forEach(b => {
        // Find if the child nomenclature is an actual manufactured part/detail (type === 'part')
        const childNom = nomenclatures.find(n => String(n.id) === String(b.child_id))
        if (!childNom || childNom.type !== 'part') {
          // Skip buy-in parts, hardware (screws/bolts), raw materials, etc.
          return
        }

        hasValidDetail = true

        // Find child part's aggregated WIP row in dashboardData
        const row = dashboardData.find(r => String(r.id) === String(b.child_id))
        const qtyPerProduct = Number(b.quantity_per_parent) || 1
        
        const sumVal = row ? row.sum : 0
        const sgpVal = row ? row.qSgp : 0

        const pot = Math.floor(sumVal / qtyPerProduct)
        const act = Math.floor(sgpVal / qtyPerProduct)

        if (pot < minPotential) {
          minPotential = pot
          bottleneckPartName = row ? row.name : childNom.name
          bottleneckPartCode = row ? (row.code || '') : (childNom.code || '')
          bottleneckQty = sumVal
        }
        if (act < minActual) {
          minActual = act
        }
      })

      if (!hasValidDetail) return // Skip if no details are present in BOM

      if (minPotential === Infinity) minPotential = 0
      if (minActual === Infinity) minActual = 0

      // Direct calculation of completed parent product sets on SGP
      const sgpInventory = (inventory || [])
        .filter(i => String(i.nomenclature_id) === String(prod.id) && 
                     (i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP'))
        .reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

      // Get active orders demand (status is not completed and not shipped)
      const activeOrders = (orders || []).filter(o => o.status !== 'completed' && o.status !== 'shipped')
      const totalDemand = activeOrders.reduce((acc, o) => {
        let qty = 0
        if (o.order_items && o.order_items.length > 0) {
          const items = o.order_items.filter(it => String(it.nomenclature_id) === String(prod.id))
          qty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
        } else if (String(o.nomenclature_id) === String(prod.id)) {
          qty = Number(o.quantity) || 0
        }
        return acc + qty
      }, 0)

      trends[prod.id] = {
        name: prod.name,
        code: prod.code || '',
        potential: minPotential,
        actual: sgpInventory, // Show true sets physically completed on SGP warehouse
        demand: totalDemand,
        bottleneck: bottleneckPartName ? `${bottleneckPartName}${bottleneckPartCode ? ` (${bottleneckPartCode})` : ''}` : null,
        bottleneckQty
      }
    })

    return trends
  }, [nomenclatures, bomItems, orders, dashboardData, inventory])

  // Group filtered data by parent product
  const groupedDashboardData = useMemo(() => {
    const groups = {}

    // Pre-populate groups for all products that have BOM items to keep a consistent layout
    if (nomenclatures && bomItems) {
      const parentProducts = nomenclatures.filter(n => n.type === 'product')
      parentProducts.forEach(prod => {
        const hasBOM = bomItems.some(b => String(b.parent_id) === String(prod.id))
        if (hasBOM) {
          groups[prod.id] = {
            id: prod.id,
            name: prod.name,
            code: prod.code || '',
            rows: [],
            trend: productTrends[prod.id] || null
          }
        }
      })
    }

    // "Other" group for parts without parent product
    groups['other'] = {
      id: 'other',
      name: 'Інші деталі / Комплектуючі',
      code: '',
      rows: [],
      trend: null
    }

    // Distribute rows into groups based on search filter
    dashboardData.forEach(row => {
      // Search query filter
      const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            row.code.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (!matchesSearch) return
      
      // WIP checkbox filter
      if (wipOnly) {
        const hasWip = (row.qCut + row.qCutBuf + row.qGalt + row.qGaltBuf + row.qPriy + row.qSortAct + row.qSort + row.qMal + row.qPres + row.qDoop) > 0
        if (!hasWip) return
      }

      // Find if this child belongs to a parent
      const bomItem = (bomItems || []).find(b => String(b.child_id) === String(row.id))
      const parentId = bomItem?.parent_id

      if (parentId && groups[parentId]) {
        groups[parentId].rows.push(row)
      } else {
        groups['other'].rows.push(row)
      }
    })

    // Filter out groups that have no rows
    return Object.values(groups).filter(g => g.rows.length > 0)
  }, [dashboardData, bomItems, nomenclatures, productTrends, searchQuery, wipOnly])

  const getGroupTotals = (rows) => {
    const res = { qCut: 0, qCutBuf: 0, qGalt: 0, qGaltBuf: 0, qPriy: 0, qSortAct: 0, qSort: 0, qMal: 0, qPres: 0, qDoop: 0, qSgp: 0, qBz: 0, sum: 0 }
    rows.forEach(row => {
      res.qCut += row.qCut
      res.qCutBuf += row.qCutBuf
      res.qGalt += row.qGalt
      res.qGaltBuf += row.qGaltBuf
      res.qPriy += row.qPriy
      res.qSortAct += row.qSortAct
      res.qSort += row.qSort
      res.qMal += row.qMal
      res.qPres += row.qPres
      res.qDoop += row.qDoop
      res.qSgp += row.qSgp
      res.qBz += row.qBz
      res.sum += row.sum
    })
    return res
  }

  const renderValue = (val, type = 'normal') => {
    if (val === 0) {
      return <span style={{ color: '#4b5563', fontWeight: 400, opacity: 0.5 }}>0</span>
    }
    let color = '#f3f4f6'
    let bg = 'transparent'
    let border = 'none'
    let padding = '2px 6px'
    let borderRadius = '4px'
    
    if (type === 'sum') {
      color = '#ff9000'
      bg = 'rgba(255, 144, 0, 0.08)'
      border = '1px solid rgba(255, 144, 0, 0.2)'
    } else if (type === 'sgp' || type === 'bz') {
      color = '#10b981'
      bg = 'rgba(16, 185, 129, 0.08)'
      border = '1px solid rgba(16, 185, 129, 0.2)'
    } else {
      bg = 'rgba(255, 255, 255, 0.04)'
      border = '1px solid rgba(255, 255, 255, 0.08)'
    }

    return (
      <span style={{ 
        fontWeight: 'bold', 
        color, 
        background: bg, 
        border, 
        padding, 
        borderRadius,
        display: 'inline-block',
        minWidth: '24px',
        textAlign: 'center'
      }}>
        {val}
      </span>
    )
  }

  return (
    <div className="dashboard-module-v2" style={{ background: '#09090b', minHeight: '100vh', color: '#f4f4f5', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation bar matching look and feel of other modules */}
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: '0 24px', 
        height: '70px', 
        background: '#09090b', 
        borderBottom: '1px solid #27272a', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#a1a1aa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', transition: 'color 0.2s' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutDashboard className="text-secondary" size={24} color="#ff9000" />
            <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, letterSpacing: '0.5px' }}>Дашборд Виробництва (WIP)</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }} className="hide-mobile">
            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#f4f4f5' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentUser?.position}</div>
          </div>
        </div>
      </nav>

      {/* Module Content Area */}
      <div className="module-content" style={{ padding: '30px', overflowY: 'auto', flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        <section className="glass-panel" style={{ padding: '30px', borderRadius: '32px', border: '1px solid #27272a', background: 'rgba(15,15,18,0.7)', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '25px' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 950, margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', letterSpacing: '0.5px' }}>
                <LayoutDashboard style={{ color: '#ff9000' }} size={24} /> ДАШБОРД ВИРОБНИЦТВА (WIP)
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '0.78rem', margin: 0 }}>Розподіл деталей та напівфабрикатів за етапами технологічного ланцюжка</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Refresh Button */}
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{ background: '#18181b', border: '1px solid #27272a', color: '#fff', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', fontSize: '0.85rem' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#27272a'; e.currentTarget.style.borderColor = '#ff9000'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#18181b'; e.currentTarget.style.borderColor = '#27272a'; }}
              >
                <RefreshCw className={isRefreshing ? 'anim-spin' : ''} size={16} />
                <span>Оновити дані</span>
              </button>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', background: '#09090b', padding: '15px 20px', borderRadius: '18px', marginBottom: '20px', border: '1px solid #27272a' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
              <input 
                type="text"
                placeholder="Пошук деталі за назвою або кодом..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 15px 12px 42px', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', fontSize: '0.85rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#ff9000'}
                onBlur={e => e.target.style.borderColor = '#27272a'}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#a1a1aa', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox"
                checked={wipOnly}
                onChange={e => setWipOnly(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#ff9000', cursor: 'pointer' }}
              />
              <span>Тільки з деталями в роботі (WIP)</span>
            </label>
          </div>

          {/* Finished Product Trends Summary Panel */}
          {Object.keys(productTrends).length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', color: '#ff9000', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '1px' }}>
                📈 Тренди готових виробів з замовлень
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '15px' }}>
                {Object.entries(productTrends).map(([id, trend]) => {
                  const hasGroup = groupedDashboardData.some(g => String(g.id) === String(id))
                  if (!hasGroup) return null

                  const pct = trend.demand > 0 ? Math.min(100, Math.round((trend.potential / trend.demand) * 100)) : 0

                  return (
                    <div key={id} style={{ background: 'rgba(24, 24, 27, 0.7)', border: '1px solid #27272a', padding: '18px 22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.6rem', background: 'rgba(255, 144, 0, 0.1)', color: '#ff9000', padding: '3px 8px', borderRadius: '6px', fontWeight: 900, textTransform: 'uppercase', marginRight: '6px', letterSpacing: '0.5px' }}>Готовий виріб</span>
                          <h4 style={{ margin: '5px 0 0 0', fontSize: '1rem', fontWeight: 900, color: '#ffffff' }}>{trend.name}</h4>
                          {trend.code && <span style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 800 }}>КОД: {trend.code}</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.55rem', color: '#71717a', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Комплектів зібрано</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#ff9000', marginTop: '2px' }}>
                            {trend.potential} <span style={{ fontSize: '0.78rem', color: '#71717a', fontWeight: 500 }}>/ {trend.demand || 0} шт.</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar to target */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#a1a1aa', fontWeight: 800 }}>
                          <span>Виконання потреби замовлень</span>
                          <span style={{ color: '#ff9000', fontWeight: 900 }}>{pct}%</span>
                        </div>
                        <div style={{ height: '8px', background: '#09090b', borderRadius: '4px', overflow: 'hidden', border: '1px solid #27272a' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ff9000, #ffb700)', borderRadius: '4px', transition: '0.3s' }} />
                        </div>
                      </div>

                      {/* Bottleneck and SGP stats */}
                      <div style={{ borderTop: '1px solid #27272a', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', gap: '10px' }}>
                        <div style={{ color: '#a1a1aa', fontWeight: 600 }}>
                          На СГП зараз: <strong style={{ color: '#10b981', fontWeight: 900 }}>{trend.actual} шт.</strong>
                        </div>
                        {trend.bottleneck && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 700 }}>
                            <span title="Вузьке місце (деталь з найменшою кількістю)">⚠️ Вузьке:</span>
                            <span style={{ textDecoration: 'underline', color: '#f87171' }} title={trend.bottleneck}>
                              {trend.bottleneck.length > 20 ? trend.bottleneck.substring(0, 17) + '...' : trend.bottleneck} ({trend.bottleneckQty} од.)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/*        SPREADSHEET REPLICA (GROUPED)       */}
          {/* ========================================== */}
          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #27272a', background: '#09090b', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', padding: '1px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit', fontSize: '0.8rem', color: '#f4f4f5' }}>
              <thead>
                <tr style={{ background: '#18181b', color: '#a1a1aa', textAlign: 'center', borderBottom: '2px solid #27272a' }}>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #27272a', color: '#f4f4f5' }}>Номенклатура</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'bold', borderRight: '1px solid #27272a', background: 'rgba(255, 144, 0, 0.08)', color: '#ff9000', minWidth: '70px' }}>Сума</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a' }}>Розкрій (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)', color: '#a1a1aa' }}>Буфер Розкрою</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a' }}>Галтовка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)', color: '#a1a1aa' }}>Буфер Галтовки</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a' }}>Прийомка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)', color: '#a1a1aa' }}>Сортування (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)', color: '#a1a1aa' }}>Буфер Цеху №2</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a' }}>Малярка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a' }}>Пресування (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: '500', borderRight: '1px solid #27272a' }}>Доопрацювання (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'bold', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>Склад (СГП)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>Склад БЗ</th>
                </tr>
              </thead>
              <tbody>
                {groupedDashboardData.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: '40px', textAlign: 'center', color: '#71717a', fontStyle: 'italic', background: 'transparent' }}>
                      Немає активних деталей за обраними фільтрами
                    </td>
                  </tr>
                ) : (
                  groupedDashboardData.map(group => {
                    const groupTotals = getGroupTotals(group.rows)

                    return (
                      <React.Fragment key={group.id}>
                        {/* Group Header Row */}
                        <tr style={{ background: '#1c1917', color: '#fff', borderBottom: '2px solid #27272a' }}>
                          <td colSpan={14} style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 'bold', borderBottom: '1px solid #27272a' }}>
                            <span style={{ color: '#ff9000', marginRight: '8px' }}>📦</span> 
                            {group.name} 
                            {group.code ? ` (${group.code})` : ''}
                            {group.trend && (
                              <span style={{ marginLeft: '15px', color: '#a1a1aa', fontSize: '0.78rem', fontWeight: 'normal' }}>
                                (Потенційний тренд: <strong style={{ color: '#fff' }}>{group.trend.potential}</strong> / {group.trend.demand || 0} шт. | На СГП: <strong style={{ color: '#10b981' }}>{group.trend.actual} шт.</strong>)
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Group Row Items */}
                        {group.rows.map((row, idx) => (
                          <tr key={row.id} className="wip-row">
                            <td style={{ padding: '12px 18px', fontWeight: 'bold', color: '#f4f4f5', borderRight: '1px solid #27272a', paddingLeft: '30px' }}>
                              {row.name}
                              {row.code && <span style={{ display: 'block', fontSize: '0.72rem', color: '#71717a', fontWeight: 'normal', marginTop: '2px' }}>Код: {row.code}</span>}
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(255, 144, 0, 0.02)', borderRight: '1px solid #27272a', fontWeight: 'bold' }}>
                              {renderValue(row.sum, 'sum')}
                            </td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qCut, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qCutBuf, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qGalt, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qGaltBuf, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qPriy, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qSortAct, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(row.qSort, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qMal, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qPres, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(row.qDoop, 'normal')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.02)' }}>{renderValue(row.qSgp, 'sgp')}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.02)' }}>{renderValue(row.qBz, 'bz')}</td>
                          </tr>
                        ))}

                        {/* Group Subtotals */}
                        <tr style={{ background: '#121214', fontWeight: 'bold', borderTop: '1px solid #27272a', borderBottom: '1px solid #27272a', color: '#a1a1aa', fontSize: '0.78rem' }}>
                          <td style={{ padding: '12px 18px', borderRight: '1px solid #27272a', fontStyle: 'italic', paddingLeft: '30px' }}>
                            Підсумок по виробу:
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(255, 144, 0, 0.08)', borderRight: '1px solid #27272a', color: '#ff9000' }}>
                            {renderValue(groupTotals.sum, 'sum')}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qCut, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qCutBuf, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qGalt, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qGaltBuf, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qPriy, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qSortAct, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.01)' }}>{renderValue(groupTotals.qSort, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qMal, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qPres, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(groupTotals.qDoop, 'normal')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>{renderValue(groupTotals.qSgp, 'sgp')}</td>
                          <td style={{ padding: '12px 18px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>{renderValue(groupTotals.qBz, 'bz')}</td>
                        </tr>
                      </React.Fragment>
                    )
                  })
                )}
                
                {/* Grand Total Row */}
                {groupedDashboardData.length > 0 && (
                  <tr style={{ background: '#18181b', fontWeight: 'bold', borderTop: '2px solid #ff9000', color: '#fff', fontSize: '0.8rem' }}>
                    <td style={{ padding: '14px 18px', borderRight: '1px solid #27272a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ЗАГАЛЬНИЙ WIP РАЗОМ:</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', background: 'rgba(255, 144, 0, 0.12)', borderRight: '1px solid #27272a', color: '#ff9000' }}>
                      {renderValue(totals.sum, 'sum')}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qCut, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qCutBuf, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qGalt, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qGaltBuf, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qPriy, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qSortAct, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(255, 255, 255, 0.02)' }}>{renderValue(totals.qSort, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qMal, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qPres, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a' }}>{renderValue(totals.qDoop, 'normal')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #27272a', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>{renderValue(totals.qSgp, 'sgp')}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>{renderValue(totals.qBz, 'bz')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .anim-spin { animation: spin 1.2s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .wip-row {
          background: #09090b;
          border-bottom: 1px solid #27272a;
          transition: all 0.2s ease;
        }
        .wip-row:hover {
          background: #18181b !important;
          box-shadow: inset 4px 0 0 0 #ff9000;
        }
      `}} />
    </div>
  )
}

export default DashboardModule
