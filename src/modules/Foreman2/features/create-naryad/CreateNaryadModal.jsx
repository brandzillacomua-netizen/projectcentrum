import React, { useState, useMemo, useEffect } from 'react'
import { X, Calendar, CheckSquare, Square, Package, Wrench, Layers, AlertCircle, Copy } from 'lucide-react'
import { apiService } from '../../../../services/apiDispatcher.js'
import { getNomUnitsPerSheet } from '../../../../utils/unitsHelper.js'

export default function CreateNaryadModal({
  isOpen,
  onClose,
  orders = [],
  tasks = [],
  nomenclatures = [],
  bomItems = [],
  inventory = [],
  machines = [],
  createNaryad,
  onNaryadCreated
}) {
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [naryadQtys, setNaryadQtys] = useState({})
  const [naryadDeadline, setNaryadDeadline] = useState('')
  const [useStockBZ, setUseStockBZ] = useState(true)
  const [rowMachines, setRowMachines] = useState({})
  const [materialSplits, setMaterialSplits] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getPlannedQtyForItem = (orderItemId, nomenclatureId, orderTasks) => {
    if (!orderTasks || orderTasks.length === 0) return 0

    // Filter to primary cutting tasks to avoid double-counting downstream tasks (e.g. Shop 2 Pressing)
    const cuttingTasks = orderTasks.filter(t => !t.step || t.step === 'Розкрій' || String(t.step).toLowerCase().includes('розкр'))
    const targetTasks = cuttingTasks.length > 0 ? cuttingTasks : orderTasks

    const batches = {}
    targetTasks.forEach(t => {
      const key = t.batch_index || `task_${t.id}`
      let qty = 0
      if (t.plan_snapshot) {
        const snapEntries = Object.values(t.plan_snapshot).filter(s => s && typeof s === 'object')
        const matchedSnap = snapEntries.find(s => String(s.order_item_id) === String(orderItemId)) ||
                            snapEntries.find(s => String(s.id) === String(nomenclatureId))
        if (matchedSnap) {
          qty = Number(matchedSnap.need || (matchedSnap.plan + (matchedSnap.stock || 0))) || 0
        } else {
          const snapPartNeeds = snapEntries
            .filter(s => s.need !== undefined || s.plan !== undefined)
            .map(s => Number(s.need || (s.plan + (s.stock || 0))) || 0)
          if (snapPartNeeds.length > 0) {
            qty = Math.max(...snapPartNeeds)
          }
        }
      }
      if (qty <= 0) {
        qty = Number(t.planned_sets) || 0
      }
      if (!batches[key] || qty > batches[key]) {
        batches[key] = qty
      }
    })
    return Object.values(batches).reduce((acc, q) => acc + q, 0)
  }

  // Filter available orders that have unfulfilled quantities
  const pendingOrders = useMemo(() => {
    return orders.filter(o => {
      if (['completed', 'shipped', 'cancelled', 'closed'].includes(o.status)) return false

      const items = (o.order_items && o.order_items.length > 0)
        ? o.order_items
        : (o.nomenclature_id ? [{ id: o.id, nomenclature_id: o.nomenclature_id, quantity: o.quantity || 1 }] : [])

      if (items.length === 0) return false

      const orderTasks = tasks.filter(t => String(t.order_id) === String(o.id))
      if (orderTasks.length > 0 && orderTasks.every(t => t.status === 'completed')) return false

      return items.some(it => {
        const planned = getPlannedQtyForItem(it.id, it.nomenclature_id, orderTasks)
        return planned < (Number(it.quantity) || 0)
      })
    })
  }, [orders, tasks])

  // Select first order by default if not set
  useEffect(() => {
    if (isOpen && !selectedOrderId && pendingOrders.length > 0) {
      setSelectedOrderId(String(pendingOrders[0].id))
    }
  }, [isOpen, selectedOrderId, pendingOrders])

  const selectedOrder = useMemo(() => {
    if (selectedOrderId === 'internal_vb') {
      return {
        id: 'internal_vb',
        order_num: 'ВБ-НАКОПИЧЕННЯ',
        customer: 'Власні потреби (Накопичення)',
        deadline: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
        order_items: nomenclatures
          .filter(n => n.type === 'part' || n.type === 'raw' || !n.type)
          .map(n => ({
            id: n.id,
            nomenclature_id: n.id,
            quantity: 0
          }))
      }
    }
    return orders.find(o => String(o.id) === String(selectedOrderId)) || null
  }, [orders, selectedOrderId, nomenclatures])

  const selectedOrderItems = useMemo(() => {
    if (!selectedOrder) return []
    if (selectedOrder.order_items && selectedOrder.order_items.length > 0) return selectedOrder.order_items
    if (selectedOrder.nomenclature_id) {
      return [{ id: selectedOrder.id, nomenclature_id: selectedOrder.nomenclature_id, quantity: selectedOrder.quantity || 1 }]
    }
    return []
  }, [selectedOrder])

  // Initialize quantities and default values when order changes
  useEffect(() => {
    if (!selectedOrder) {
      setNaryadQtys({})
      setRowMachines({})
      setMaterialSplits({})
      setNaryadDeadline('')
      return
    }

    setNaryadDeadline(selectedOrder.deadline || '')

    const orderTasks = tasks.filter(t => String(t.order_id) === String(selectedOrder.id))
    const initialQtys = {}
    const initialMachines = {}

    selectedOrderItems.forEach(it => {
      const planned = getPlannedQtyForItem(it.id, it.nomenclature_id, orderTasks)
      const remaining = Math.max(0, Number(it.quantity) - planned)
      initialQtys[it.id] = remaining

      const nom = nomenclatures.find(n => String(n.id) === String(it.nomenclature_id))
      if (nom?.default_machine) {
        initialMachines[it.id] = nom.default_machine
      }
    })

    setNaryadQtys(initialQtys)
    setRowMachines(initialMachines)
    setMaterialSplits({})
  }, [selectedOrder, selectedOrderItems, tasks, nomenclatures])

  const getBOMParts = (nomenclatureId) => {
    const parts = bomItems.filter(b => String(b.parent_id) === String(nomenclatureId))
    if (parts.length > 0) {
      return parts.map(b => ({
        nom: nomenclatures.find(n => String(n.id) === String(b.child_id)),
        quantity_per_parent: Number(b.quantity_per_parent) || 1
      }))
    }
    const directNom = nomenclatures.find(n => String(n.id) === String(nomenclatureId))
    return directNom ? [{ nom: directNom, quantity_per_parent: 1 }] : []
  }

  // Calculate breakdown for details, sheets, and materials
  const orderDetailsBreakdown = useMemo(() => {
    if (!selectedOrder) return []

    const rows = []
    selectedOrderItems.forEach(item => {
      const parts = getBOMParts(item.nomenclature_id)
      const requestedQty = Number(naryadQtys[item.id]) || 0

      parts.forEach(part => {
        if (!part.nom) return
        if (part.nom.type === 'hardware' || part.nom.type === 'fastener') return

        const totalNeeded = requestedQty * part.quantity_per_parent
        const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
        const inStockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0

        const planQty = useStockBZ ? Math.max(0, totalNeeded - inStockBZ) : totalNeeded
        const unitsPerSheet = getNomUnitsPerSheet(part.nom)
        const totalSheets = Math.ceil(planQty / unitsPerSheet)

        const isDefaultT700 = (part.nom.material_type || part.nom.name || '').toLowerCase().includes('т700') || (part.nom.material_type || part.nom.name || '').toLowerCase().includes('t700')
        const split = materialSplits[part.nom.id] || {}
        const sheetsT300 = split.t300 !== undefined ? split.t300 : (isDefaultT700 ? 0 : totalSheets)
        const sheetsT700 = split.t700 !== undefined ? split.t700 : (isDefaultT700 ? totalSheets : 0)

        rows.push({
          itemId: item.id,
          nomId: part.nom.id,
          name: part.nom.name,
          code: part.nom.nomenclature_code,
          material: part.nom.material_type || 'Лист (3мм)',
          unitsPerSheet,
          totalNeeded,
          inStockBZ,
          planQty,
          totalSheets,
          sheetsT300,
          sheetsT700,
          bzSurplus: Math.max(0, (totalSheets * unitsPerSheet) - planQty),
          selectedMachine: 'Різні верстати'
        })
      })
    })

    return rows
  }, [selectedOrder, selectedOrderItems, naryadQtys, useStockBZ, materialSplits, inventory, nomenclatures, bomItems])

  const totals = useMemo(() => {
    return orderDetailsBreakdown.reduce((acc, row) => {
      acc.totalNeeded += row.totalNeeded
      acc.totalPlan += row.planQty
      acc.totalSheets += row.totalSheets
      acc.sheetsT300 += row.sheetsT300
      acc.sheetsT700 += row.sheetsT700
      acc.bzSurplus += row.bzSurplus
      return acc
    }, { totalNeeded: 0, totalPlan: 0, totalSheets: 0, sheetsT300: 0, sheetsT700: 0, bzSurplus: 0 })
  }, [orderDetailsBreakdown])

  // Material summary (sheets needed)
  const materialSummary = useMemo(() => {
    const map = {}
    orderDetailsBreakdown.forEach(row => {
      if (row.totalSheets <= 0) return
      const matKey = row.material
      if (!map[matKey]) map[matKey] = { name: matKey, sheets: 0 }
      map[matKey].sheets += row.totalSheets
    })
    return Object.values(map)
  }, [orderDetailsBreakdown])

  const handleCreate = async () => {
    if (!selectedOrder || isSubmitting) return

    const hasAnyQty = Object.values(naryadQtys).some(v => Number(v) > 0)
    if (!hasAnyQty) {
      alert('Будь ласка, вкажіть кількість для випуску хоча б однієї деталі.')
      return
    }

    setIsSubmitting(true)
    try {
      const taskMachineName = 'Різні верстати'

      const createdTask = await apiService.submitCreateTask(selectedOrder.id, taskMachineName, (oid, m) =>
        createNaryad(
          oid,
          m,
          naryadQtys,
          naryadDeadline,
          {},
          materialSplits,
          {}, // cutters
          null, // customBOM
          null, // cutterOverrides
          null, // rowMachinesSplits
          useStockBZ,
          null
        )
      )

      if (createdTask && typeof onNaryadCreated === 'function') {
        onNaryadCreated(createdTask)
      }

      onClose()
    } catch (e) {
      console.error('Naryad creation failed:', e)
      alert('Помилка створення наряду: ' + e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0d0d0d',
          width: '100%',
          maxWidth: '1200px',
          borderRadius: '24px',
          padding: '30px',
          position: 'relative',
          border: '1px solid #222',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          maxHeight: '92vh',
          overflowY: 'auto',
          color: '#fff'
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '25px',
            right: '25px',
            background: '#222',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            width: '35px',
            height: '35px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 950, margin: 0, letterSpacing: '0.5px' }}>
              Створити Наряд {selectedOrder ? `№ ${selectedOrder.order_num}` : ''}
            </h2>
            {selectedOrder && (
              <span style={{ fontSize: '0.75rem', background: '#eab30820', color: '#eab308', border: '1px solid #eab30840', padding: '4px 10px', borderRadius: '8px', fontWeight: 900 }}>
                В РОБОТІ
              </span>
            )}
          </div>

          {/* Select Order Dropdown if multiple exist */}
          <div style={{ marginTop: '15px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '250px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>
                Оберіть замовлення зі списку:
              </label>
              <select
                value={selectedOrderId}
                onChange={e => setSelectedOrderId(e.target.value)}
                style={{
                  width: '100%',
                  background: '#000',
                  border: '1px solid #333',
                  color: '#fff',
                  padding: '12px 15px',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  outline: 'none'
                }}
              >
                <option value="internal_vb">📦 Власні потреби (Накопичення деталей без замовлення)</option>
                {pendingOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    Замовлення №{o.order_num} ({o.customer || 'Без клієнта'})
                  </option>
                ))}
              </select>
            </div>

            {selectedOrder && (
              <>
                <div style={{ background: '#141414', padding: '10px 15px', borderRadius: '12px', border: '1px solid #222' }}>
                  <div style={{ fontSize: '0.6rem', color: '#666', fontWeight: 800 }}>ВИРІБ / ЗАМОВНИК:</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 950, color: '#ff9000' }}>
                    {selectedOrder.customer || 'Замовник не вказаний'}
                  </div>
                </div>

                <div style={{ background: '#141414', padding: '10px 15px', borderRadius: '12px', border: '1px solid #222' }}>
                  <div style={{ fontSize: '0.6rem', color: '#666', fontWeight: 800 }}>ДАТА ФОРМУВАННЯ:</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 950, color: '#fff' }}>
                    {new Date().toLocaleDateString('uk-UA')}
                  </div>
                </div>

                <div style={{ background: '#141414', padding: '10px 15px', borderRadius: '12px', border: '1px solid #222' }}>
                  <div style={{ fontSize: '0.6rem', color: '#666', fontWeight: 800 }}>ДЕДЛАЙН НА ЦЮ ПАРТІЮ:</div>
                  <input
                    type="date"
                    value={naryadDeadline}
                    onChange={e => setNaryadDeadline(e.target.value)}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 950, outline: 'none' }}
                  />
                </div>

                <div
                  onClick={() => setUseStockBZ(prev => !prev)}
                  style={{
                    background: '#141414',
                    padding: '10px 15px',
                    borderRadius: '12px',
                    border: '1px solid #222',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {useStockBZ ? <CheckSquare size={16} color="#10b981" /> : <Square size={16} color="#555" />}
                  <span style={{ fontSize: '0.8rem', fontWeight: 900, color: useStockBZ ? '#10b981' : '#888' }}>
                    Враховувати БЗ зі склада
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {!selectedOrder ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#555', fontSize: '0.9rem' }}>
            Оберіть замовлення зі списку вище для формування наряду.
          </div>
        ) : (
          <>
            {/* Table of Details */}
            <div style={{ overflowX: 'auto', marginBottom: '25px', borderRadius: '16px', border: '1px solid #222' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#121212', borderBottom: '1px solid #222', color: '#888', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 900 }}>
                    <th style={{ padding: '14px 16px' }}>Деталь в розкрій</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Потреба</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Склад БЗ</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>План</th>
                    <th style={{ padding: '14px 16px' }}>Матеріал</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>Шт/Л</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: '#a855f7' }}>Загалом Листів</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: '#38bdf8' }}>Листів Т300</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: '#38bdf8' }}>Листів Т700</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', color: '#eab308' }}>БЗ</th>
                  </tr>
                </thead>
                <tbody>
                  {orderDetailsBreakdown.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a', background: idx % 2 === 0 ? '#090909' : '#0d0d0d' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 900, color: '#fff' }}>
                        <div>{row.name}</div>
                        {row.code && <div style={{ fontSize: '0.65rem', color: '#555' }}>{row.code}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, color: '#ff9000' }}>
                        {row.totalNeeded}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#888' }}>
                        {row.inStockBZ}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 950, color: '#ff9000', fontSize: '1.05rem' }}>
                        {row.planQty}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#ccc', fontWeight: 800 }}>
                        {row.material}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#888' }}>
                        {row.unitsPerSheet}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 950, color: '#a855f7', fontSize: '1rem' }}>
                        {row.totalSheets}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#38bdf8', fontWeight: 900 }}>
                        {row.sheetsT300}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#38bdf8', fontWeight: 900 }}>
                        {row.sheetsT700}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#eab308', fontWeight: 900 }}>
                        +{row.bzSurplus}
                      </td>
                    </tr>
                  ))}

                  {/* Summary Totals Row */}
                  <tr style={{ background: '#121212', borderTop: '2px solid #222', fontWeight: 950 }}>
                    <td style={{ padding: '16px', color: '#fff', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ЗАГАЛЬНИЙ ПІДСУМОК:
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: '#ff9000', fontSize: '1.05rem' }}>
                      {totals.totalNeeded}
                    </td>
                    <td style={{ padding: '16px' }}></td>
                    <td style={{ padding: '16px', textAlign: 'center', color: '#ff9000', fontSize: '1.05rem' }}>
                      {totals.totalPlan}
                    </td>
                    <td colSpan="2" style={{ padding: '16px' }}></td>
                    <td style={{ padding: '16px', textAlign: 'center', color: '#a855f7', fontSize: '1.2rem' }}>
                      {totals.totalSheets}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: '#38bdf8', fontSize: '1rem' }}>
                      {totals.sheetsT300}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: '#38bdf8', fontSize: '1rem' }}>
                      {totals.sheetsT700}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: '#eab308', fontSize: '1rem' }}>
                      +{totals.bzSurplus}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Materials Breakdown */}
            <div style={{ background: '#090909', border: '1px solid #1a1a1a', borderRadius: '18px', padding: '20px', marginBottom: '25px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>
                ВІДОМІСТЬ МАТЕРІАЛІВ:
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {materialSummary.length === 0 ? (
                  <span style={{ color: '#555', fontSize: '0.8rem' }}>Матеріали не потрібні</span>
                ) : (
                  materialSummary.map((m, idx) => (
                    <div key={idx} style={{ background: '#121212', padding: '10px 16px', borderRadius: '12px', border: '1px solid #222', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 800 }}>{m.name}:</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff' }}>{m.sheets} <span style={{ fontSize: '0.7rem', color: '#666' }}>листів</span></span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              disabled={isSubmitting}
              onClick={handleCreate}
              style={{
                width: '100%',
                background: '#10b981',
                color: '#fff',
                padding: '20px',
                borderRadius: '20px',
                fontSize: '1.1rem',
                fontWeight: 950,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                border: 'none',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
                opacity: isSubmitting ? 0.6 : 1
              }}
            >
              {isSubmitting ? 'СТВОРЕННЯ НАРАДУ...' : 'СВОРИТИ НАРАД ТА ЗАПУСТИТИ В РОБОТУ'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
