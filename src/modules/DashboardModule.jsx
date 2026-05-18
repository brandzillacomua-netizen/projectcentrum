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
      // 1. Розкрій (Робота) - status: in-progress
      const qCut = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     (c.operation === 'Розкрій' || c.operation === 'Лазерний розкрій') && 
                     c.status === 'in-progress')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 2. Буфер Розкрою - status: at-buffer
      const qCutBuf = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     (c.operation === 'Розкрій' || c.operation === 'Лазерний розкрій') && 
                     c.status === 'at-buffer')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 3. Галтовка (Робота) - status: in-progress
      const qGalt = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Галтовка' && 
                     c.status === 'in-progress')
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

      // 5b. Сортування (Робота) - status: in-progress or at-buffer (not yet sent to Shop 2)
      const qSortAct = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Сортування' && 
                     (c.status === 'in-progress' || c.status === 'at-buffer'))
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 6. Буфер Цеху №2 - only cards actually dispatched to Shop 2 buffer
      const qSortCards = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.status === 'at-shop2-buffer')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      const qSortInv = (inventory || [])
        .filter(i => String(i.nomenclature_id) === String(nom.id) && 
                     ['semi', 'semi_shop2', 'bz_shop2'].includes(i.type))
        .reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

      const qSort = qSortCards + qSortInv

      // 7. Малярка (Робота) - status: in-progress
      const qMal = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     (c.operation === 'Фарбування' || c.operation === 'Малярка') && 
                     c.status === 'in-progress')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 8. Пресування (Робота) - status: in-progress
      const qPres = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Пресування' && 
                     c.status === 'in-progress')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 9. Доопрацювання (Робота) - status: in-progress
      const qDoop = (workCards || [])
        .filter(c => String(c.nomenclature_id) === String(nom.id) && 
                     c.operation === 'Доопрацювання' && 
                     c.status === 'in-progress')
        .reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

      // 10. Склад (СГП)
      const qSgp = (inventory || [])
        .filter(i => String(i.nomenclature_id) === String(nom.id) && 
                     (i.type === 'finished' || i.warehouse === 'sgp'))
        .reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0)

      const sum = qCut + qCutBuf + qGalt + qGaltBuf + qPriy + qSortAct + qSort + qMal + qPres + qDoop + qSgp

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
    const res = { qCut: 0, qCutBuf: 0, qGalt: 0, qGaltBuf: 0, qPriy: 0, qSortAct: 0, qSort: 0, qMal: 0, qPres: 0, qDoop: 0, qSgp: 0, sum: 0 }
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
        const qtyPerProduct = Number(b.qty) || 1
        
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
    const res = { qCut: 0, qCutBuf: 0, qGalt: 0, qGaltBuf: 0, qPriy: 0, qSortAct: 0, qSort: 0, qMal: 0, qPres: 0, qDoop: 0, qSgp: 0, sum: 0 }
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
      res.sum += row.sum
    })
    return res
  }

  const renderValue = (val, isSum = false, isSpreadsheet = true) => {
    if (val === 0) {
      return <span style={{ color: isSpreadsheet ? '#b3b3b3' : '#333', fontWeight: 300 }}>0</span>
    }
    return <span style={{ fontWeight: 800, color: isSum ? '#000' : (isSpreadsheet ? '#000' : '#ff9000') }}>{val}</span>
  }

  return (
    <div className="dashboard-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation bar matching look and feel of other modules */}
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: '0 20px', 
        height: '70px', 
        background: '#000', 
        borderBottom: '1px solid #1a1a1a', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutDashboard className="text-secondary" size={24} color="#ff9000" />
            <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Дашборд Виробництва (WIP)</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1 }} className="hide-mobile">
            <div style={{ fontSize: '0.85rem', fontWeight: 900 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 800, textTransform: 'uppercase' }}>{currentUser?.position}</div>
          </div>
        </div>
      </nav>

      {/* Module Content Area */}
      <div className="module-content" style={{ padding: '30px', overflowY: 'auto', flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        <section className="glass-panel" style={{ padding: '30px', borderRadius: '32px', border: '1px solid #1a1a1a', background: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '25px' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 950, margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LayoutDashboard style={{ color: '#ff9000' }} size={24} /> ДАШБОРД ВИРОБНИЦТВА (WIP)
              </h2>
              <p style={{ color: '#666', fontSize: '0.78rem', margin: 0 }}>Розподіл деталей та напівфабрикатів за етапами технологічного ланцюжка</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Refresh Button */}
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{ background: '#111', border: '1px solid #222', color: '#fff', padding: '10px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <RefreshCw className={isRefreshing ? 'anim-spin' : ''} size={16} />
              </button>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', background: '#00000040', padding: '15px 20px', borderRadius: '18px', marginBottom: '20px', border: '1px solid #151515' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
              <input 
                type="text"
                placeholder="Пошук деталі за назвою або кодом..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 15px 12px 42px', background: '#000', border: '1px solid #222', borderRadius: '12px', color: '#fff', fontSize: '0.85rem' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#aaa', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
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
                    <div key={id} style={{ background: 'rgba(20, 20, 20, 0.6)', border: '1px solid rgba(255,255,255,0.05)', padding: '18px 22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.6rem', background: 'rgba(255, 144, 0, 0.1)', color: '#ff9000', padding: '3px 8px', borderRadius: '6px', fontWeight: 900, textTransform: 'uppercase', marginRight: '6px', letterSpacing: '0.5px' }}>Готовий виріб</span>
                          <h4 style={{ margin: '5px 0 0 0', fontSize: '1rem', fontWeight: 900, color: '#fff' }}>{trend.name}</h4>
                          {trend.code && <span style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>КОД: {trend.code}</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Комплектів зібрано</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 950, color: '#ff9000', marginTop: '2px' }}>
                            {trend.potential} <span style={{ fontSize: '0.78rem', color: '#555', fontWeight: 500 }}>/ {trend.demand || 0} шт.</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar to target */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666', fontWeight: 800 }}>
                          <span>Виконання потреби замовлень</span>
                          <span style={{ color: '#ff9000', fontWeight: 900 }}>{pct}%</span>
                        </div>
                        <div style={{ height: '8px', background: '#000', borderRadius: '4px', overflow: 'hidden', border: '1px solid #1a1a1a' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #ff9000, #ffb700)', borderRadius: '4px', transition: '0.3s' }} />
                        </div>
                      </div>

                      {/* Bottleneck and SGP stats */}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', gap: '10px' }}>
                        <div style={{ color: '#888', fontWeight: 600 }}>
                          На СГП зараз: <strong style={{ color: '#10b981', fontWeight: 900 }}>{trend.actual} шт.</strong>
                        </div>
                        {trend.bottleneck && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f87171', fontWeight: 700 }}>
                            <span title="Вузьке місце (деталь з найменшою кількістю)">⚠️ Вузьке:</span>
                            <span style={{ textDecoration: 'underline', color: '#ef4444' }} title={trend.bottleneck}>
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
          <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #333', background: '#fff', padding: '1px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Arial", sans-serif', fontSize: '0.85rem', color: '#333' }}>
              <thead>
                <tr style={{ background: '#1e4d2b', color: '#fff', textAlign: 'center' }}>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #2a643b' }}>Номенклатура</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'bold', border: '1px solid #2a643b', background: '#fff2cc', color: '#000', minWidth: '70px' }}>Сума</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b' }}>Розкрій (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b', background: '#e2f0d9', color: '#000' }}>Буфер Розкрою</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b' }}>Галтовка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b', background: '#e2f0d9', color: '#000' }}>Буфер Галтовки</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b' }}>Прийомка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b', background: '#e2f0d9', color: '#000' }}>Сортування (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b', background: '#fce4d6', color: '#000' }}>Буфер Цеху №2</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b' }}>Малярка (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b' }}>Пресування (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b' }}>Доопрацювання (Робота)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 'normal', border: '1px solid #2a643b', background: '#fff2cc', color: '#000' }}>Склад (СГП)</th>
                </tr>
              </thead>
              <tbody>
                {groupedDashboardData.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ padding: '40px', textAlign: 'center', color: '#999', fontStyle: 'italic', background: '#fff' }}>
                      Немає активних деталей за обраними фільтрами
                    </td>
                  </tr>
                ) : (
                  groupedDashboardData.map(group => {
                    const groupTotals = getGroupTotals(group.rows)

                    return (
                      <React.Fragment key={group.id}>
                        {/* Group Header Row */}
                        <tr style={{ background: '#2d3748', color: '#fff' }}>
                          <td colSpan={13} style={{ padding: '10px 18px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #4a5568' }}>
                            <span style={{ color: '#ecc94b', marginRight: '8px' }}>📦</span> 
                            {group.name} 
                            {group.code ? ` (${group.code})` : ''}
                            {group.trend && (
                              <span style={{ marginLeft: '15px', color: '#a0aec0', fontSize: '0.78rem', fontWeight: 'normal' }}>
                                (Потенційний тренд: <strong style={{ color: '#fff' }}>{group.trend.potential}</strong> / {group.trend.demand || 0} шт. | На СГП: <strong style={{ color: '#48bb78' }}>{group.trend.actual} шт.</strong>)
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Group Row Items */}
                        {group.rows.map((row, idx) => (
                          <tr key={row.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9f9f9', borderBottom: '1px solid #e0e0e0', transition: 'background 0.2s' }}>
                            <td style={{ padding: '10px 18px', fontWeight: 'bold', color: '#111', borderRight: '1px solid #e0e0e0', paddingLeft: '30px' }}>
                              {row.name}
                              {row.code && <span style={{ display: 'block', fontSize: '0.72rem', color: '#777', fontWeight: 'normal', marginTop: '2px' }}>Код: {row.code}</span>}
                            </td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', background: '#fff2cc', borderRight: '1px solid #e0e0e0', fontWeight: 'bold' }}>
                              {renderValue(row.sum, true, true)}
                            </td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{renderValue(row.qCut, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0', background: '#e2f0d9' }}>{renderValue(row.qCutBuf, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{renderValue(row.qGalt, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0', background: '#e2f0d9' }}>{renderValue(row.qGaltBuf, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{renderValue(row.qPriy, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0', background: '#e2f0d9' }}>{renderValue(row.qSortAct, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0', background: '#fce4d6' }}>{renderValue(row.qSort, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{renderValue(row.qMal, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{renderValue(row.qPres, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e0e0e0' }}>{renderValue(row.qDoop, false, true)}</td>
                            <td style={{ padding: '10px 18px', textAlign: 'center', background: '#fff2cc' }}>{renderValue(row.qSgp, false, true)}</td>
                          </tr>
                        ))}

                        {/* Group Subtotals */}
                        <tr style={{ background: '#edf2f7', fontWeight: 'bold', borderTop: '1px solid #cbd5e0', color: '#4a5568', fontSize: '0.8rem' }}>
                          <td style={{ padding: '10px 18px', borderRight: '1px solid #cbd5e0', fontStyle: 'italic', paddingLeft: '30px' }}>
                            Підсумок по виробу:
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', background: '#ffe699', borderRight: '1px solid #cbd5e0' }}>{groupTotals.sum}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0' }}>{groupTotals.qCut}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0', background: '#c6f6d5' }}>{groupTotals.qCutBuf}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0' }}>{groupTotals.qGalt}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0', background: '#c6f6d5' }}>{groupTotals.qGaltBuf}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0' }}>{groupTotals.qPriy}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0', background: '#c6f6d5' }}>{groupTotals.qSortAct}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0', background: '#fed7d7' }}>{groupTotals.qSort}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0' }}>{groupTotals.qMal}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0' }}>{groupTotals.qPres}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #cbd5e0' }}>{groupTotals.qDoop}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'center', background: '#ffe699' }}>{groupTotals.qSgp}</td>
                        </tr>
                      </React.Fragment>
                    )
                  })
                )}
                
                {/* Grand Total Row */}
                {groupedDashboardData.length > 0 && (
                  <tr style={{ background: '#cbd5e0', fontWeight: 'bold', borderTop: '3px double #4a5568', color: '#000', fontSize: '0.85rem' }}>
                    <td style={{ padding: '14px 18px', borderRight: '1px solid #a0aec0' }}>ЗАГАЛЬНИЙ WIP РАЗОМ:</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', background: '#ffd8a8', borderRight: '1px solid #a0aec0' }}>{totals.sum}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0' }}>{totals.qCut}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0', background: '#b2f2bb' }}>{totals.qCutBuf}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0' }}>{totals.qGalt}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0', background: '#b2f2bb' }}>{totals.qGaltBuf}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0' }}>{totals.qPriy}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0', background: '#b2f2bb' }}>{totals.qSortAct}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0', background: '#ffc9c9' }}>{totals.qSort}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0' }}>{totals.qMal}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0' }}>{totals.qPres}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', borderRight: '1px solid #a0aec0' }}>{totals.qDoop}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', background: '#ffd8a8' }}>{totals.qSgp}</td>
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
      `}} />
    </div>
  )
}

export default DashboardModule
