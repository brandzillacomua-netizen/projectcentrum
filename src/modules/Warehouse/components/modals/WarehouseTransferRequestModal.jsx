import React, { useState, useMemo } from 'react'
import { X, Search, ArrowLeftRight, Check, AlertCircle, Plus, Minus, Package } from 'lucide-react'
import { supabase } from '../../../../supabase'

export function WarehouseTransferRequestModal({
  show,
  onClose,
  inventory = [],
  nomenclatures = [],
  currentUser = null,
  refreshTable,
  fetchData
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('cutters') // 'cutters' | 'all'
  const [quantities, setQuantities] = useState({})
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Index inventory by warehouse & nomenclature_id / name
  const { cuttersList, allItemsList } = useMemo(() => {
    const itemsMap = new Map()

    const ensureItem = (key, name, nomenclature = null, unit = 'шт', category = 'other') => {
      if (!itemsMap.has(key)) {
        itemsMap.set(key, {
          key,
          name,
          code: nomenclature?.code || null,
          nomenclature_id: nomenclature?.id || null,
          unit: unit || nomenclature?.unit || 'шт',
          category,
          svTotal: 0,
          svReserved: 0,
          svAvailable: 0,
          svInventoryId: null,
          soTotal: 0,
          soReserved: 0,
          soAvailable: 0
        })
      }
      return itemsMap.get(key)
    }

    // 1. Add all cutter nomenclatures first
    ;(nomenclatures || []).forEach(n => {
      const name = n.name || ''
      const lower = name.toLowerCase()
      const isCutter = lower.includes('фреза') || n.category === 'cutter' || n.type === 'cutter'
      const key = `nom:${n.id}`
      ensureItem(key, name, n, n.unit, isCutter ? 'cutters' : 'other')
    })

    // 2. Aggregate stock quantities from inventory for both СВ ('production') and СО ('operational')
    ;(inventory || []).forEach(inv => {
      const name = inv.name || ''
      const lower = name.toLowerCase()
      const isCutter = lower.includes('фреза') || inv.type === 'cutters'
      const total = Number(inv.total_qty) || 0
      const reserved = Number(inv.reserved_qty) || 0
      const available = Math.max(0, total - reserved)

      const key = inv.nomenclature_id ? `nom:${inv.nomenclature_id}` : `inv_name:${name.toLowerCase().trim()}`
      const item = ensureItem(key, name, null, inv.unit || 'шт', isCutter ? 'cutters' : 'other')

      if (inv.warehouse === 'production') {
        item.svTotal += total
        item.svReserved += reserved
        item.svAvailable += available
        if (!item.svInventoryId) item.svInventoryId = inv.id
      } else if (inv.warehouse === 'operational') {
        item.soTotal += total
        item.soReserved += reserved
        item.soAvailable += available
      }
    })

    const all = Array.from(itemsMap.values())
    const cutters = all.filter(it => it.category === 'cutters' || it.name.toLowerCase().includes('фреза'))

    // Sort: items with available stock on СВ first, then alphabetically
    const sorter = (a, b) => {
      if (b.svAvailable !== a.svAvailable) return b.svAvailable - a.svAvailable
      return a.name.localeCompare(b.name, 'uk-UA')
    }

    return {
      cuttersList: cutters.sort(sorter),
      allItemsList: all.sort(sorter)
    }
  }, [inventory, nomenclatures])

  if (!show) return null

  const displayList = (activeCategory === 'cutters' ? cuttersList : allItemsList).filter(item => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    const matchName = item.name.toLowerCase().includes(q)
    const matchCode = item.code && item.code.toLowerCase().includes(q)
    return matchName || matchCode
  })

  const handleQtyChange = (key, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0)
    setQuantities(prev => {
      const next = { ...prev }
      if (num === 0) delete next[key]
      else next[key] = num
      return next
    })
  }

  const handleStepQty = (key, delta) => {
    const current = quantities[key] || 0
    handleQtyChange(key, current + delta)
  }

  const selectedCount = Object.keys(quantities).length
  const totalPcs = Object.values(quantities).reduce((sum, q) => sum + (Number(q) || 0), 0)

  const handleSubmit = async () => {
    if (selectedCount === 0 || totalPcs <= 0) {
      setErrorMsg('Оберіть хоча б одну позицію та вкажіть кількість для переміщення.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const itemsMap = new Map((allItemsList || []).map(it => [it.key, it]))
      const items = Object.entries(quantities)
        .filter(([_, qty]) => Number(qty) > 0)
        .map(([key, qty]) => {
          const it = itemsMap.get(key)
          return {
            nomenclature_id: it?.nomenclature_id || null,
            inventory_id: it?.svInventoryId || null,
            name: it?.name || 'Невідома позиція',
            code: it?.code || null,
            unit: it?.unit || 'шт',
            needed: Number(qty),
            quantity: Number(qty),
            source_warehouse: 'production',
            target_warehouse: 'operational',
            details: `Переміщення на СО: ${it?.name || 'Позиція'} — ${qty} ${it?.unit || 'шт'}`
          }
        })

      const authorName = currentUser
        ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.login
        : 'Комірник СО'

      const { error } = await supabase.from('purchase_requests').insert([{
        order_id: null,
        order_num: 'ПЕРЕМІЩЕННЯ НА СО',
        task_id: null,
        status: 'pending',
        destination_warehouse: 'production',
        items,
        notes: `[TRANSFER_SO_SV] Запит на переміщення з СВ на СО. ${comment ? `Коментар: ${comment}. ` : ''}Ініціатор: ${authorName}`
      }])

      if (error) throw error

      if (typeof refreshTable === 'function') refreshTable('purchase_requests')
      if (typeof fetchData === 'function') fetchData(['purchase_requests'])

      alert(`Запит на переміщення (${totalPcs} шт.) успішно надіслано на Склад Виробництва (СВ)!`)
      setQuantities({})
      setComment('')
      onClose()
    } catch (err) {
      console.error('Failed to submit transfer request:', err)
      setErrorMsg(`Помилка надсилання: ${err?.message || 'невідома помилка'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          background: 'var(--surface-1, #0d0d0e)',
          border: '1px solid var(--border-subtle, #27272a)',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
          color: 'var(--text-color, #fff)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 28px',
            borderBottom: '1px solid var(--border-subtle, #1e1e24)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), transparent)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
              }}
            >
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>
                ЗАПИТ НА ПЕРЕМІЩЕННЯ (СВ → СО)
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                Замовлення фрез та розхідників з основного Складу Виробництва на Оперативний склад
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #888)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Category tabs + Search */}
        <div
          style={{
            padding: '16px 28px',
            borderBottom: '1px solid var(--border-subtle, #1e1e24)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.2)'
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--card-inner-bg, #141416)', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => setActiveCategory('cutters')}
              style={{
                background: activeCategory === 'cutters' ? '#3b82f6' : 'transparent',
                color: activeCategory === 'cutters' ? '#fff' : 'var(--text-muted, #888)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '9px',
                fontWeight: 900,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              <span>⚙️ ФРЕЗИ</span>
              <span style={{ background: activeCategory === 'cutters' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem' }}>
                {cuttersList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveCategory('all')}
              style={{
                background: activeCategory === 'all' ? '#3b82f6' : 'transparent',
                color: activeCategory === 'all' ? '#fff' : 'var(--text-muted, #888)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '9px',
                fontWeight: 900,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              <span>📦 ВСІ МАТЕРІАЛИ</span>
              <span style={{ background: activeCategory === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem' }}>
                {allItemsList.length}
              </span>
            </button>
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '420px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #666)' }} />
            <input
              type="text"
              placeholder="Швидкий пошук за назвою або діаметром..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, #27272a)',
                background: 'var(--card-inner-bg, #000)',
                color: 'var(--text-color, #fff)',
                fontSize: '0.82rem',
                fontWeight: 700,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
          {displayList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted, #666)' }}>
              За вашим запитом позицій не знайдено
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayList.map(item => {
                const qtySelected = quantities[item.key] || 0
                const isSelected = qtySelected > 0

                return (
                  <div
                    key={item.key}
                    style={{
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--card-inner-bg, #121214)',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid var(--border-subtle, #222)',
                      borderRadius: '14px',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      flexWrap: 'wrap',
                      transition: 'all 0.15s'
                    }}
                  >
                    {/* Item info */}
                    <div style={{ flex: 2, minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: isSelected ? '#60a5fa' : 'var(--text-color, #fff)' }}>
                          {item.name}
                        </span>
                        {item.code && (
                          <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted, #aaa)', padding: '2px 6px', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 800 }}>
                            {item.code}
                          </span>
                        )}
                      </div>

                      {/* Stock balances on SV & SO */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.74rem' }}>
                        <span style={{ color: item.svAvailable > 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                          🏭 На СВ: <strong>{item.svAvailable} {item.unit}</strong>
                          {item.svReserved > 0 && <span style={{ opacity: 0.7, fontWeight: 600 }}> (забр: {item.svReserved})</span>}
                        </span>
                        <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
                          📍 На СО: <strong style={{ color: item.soTotal > 0 ? '#38bdf8' : '#71717a' }}>{item.soTotal} {item.unit}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg, #000)', borderRadius: '10px', border: '1px solid var(--border-subtle, #333)', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => handleStepQty(item.key, -1)}
                          disabled={qtySelected <= 0}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: qtySelected > 0 ? '#fff' : '#444',
                            width: '34px',
                            height: '34px',
                            cursor: qtySelected > 0 ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Minus size={14} />
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={qtySelected === 0 ? '' : qtySelected}
                          placeholder="0"
                          onChange={e => handleQtyChange(item.key, e.target.value)}
                          style={{
                            width: '54px',
                            height: '34px',
                            textAlign: 'center',
                            background: 'transparent',
                            border: 'none',
                            color: isSelected ? '#60a5fa' : 'var(--text-color, #fff)',
                            fontSize: '0.9rem',
                            fontWeight: 950,
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => handleStepQty(item.key, 1)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            width: '34px',
                            height: '34px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Quick +5 button */}
                      <button
                        type="button"
                        onClick={() => handleStepQty(item.key, 5)}
                        style={{
                          background: 'rgba(59, 130, 246, 0.12)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: '#60a5fa',
                          padding: '0 10px',
                          height: '34px',
                          borderRadius: '8px',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          cursor: 'pointer'
                        }}
                      >
                        +5
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '18px 28px',
            borderTop: '1px solid var(--border-subtle, #1e1e24)',
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Коментар до переміщення (необов’язково, наприклад: під наряд №123)..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              style={{
                flex: 1,
                minWidth: '240px',
                padding: '11px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, #27272a)',
                background: 'var(--card-inner-bg, #000)',
                color: 'var(--text-color, #fff)',
                fontSize: '0.8rem',
                fontWeight: 700,
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #aaa)', textAlign: 'right' }}>
                Обрано: <strong style={{ color: '#38bdf8' }}>{selectedCount}</strong> поз. (<strong style={{ color: '#fff' }}>{totalPcs} шт</strong>)
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  background: 'var(--btn-ghost-bg, #1e1e24)',
                  border: '1px solid var(--border-subtle, #333)',
                  color: '#fff',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Скасувати
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || selectedCount === 0 || totalPcs <= 0}
                style={{
                  background: selectedCount > 0 && totalPcs > 0 && !isSubmitting
                    ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                    : 'var(--btn-disabled-bg, #222)',
                  border: 'none',
                  color: selectedCount > 0 && totalPcs > 0 && !isSubmitting ? '#fff' : '#666',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: 950,
                  fontSize: '0.85rem',
                  cursor: selectedCount > 0 && totalPcs > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: selectedCount > 0 && totalPcs > 0 ? '0 4px 15px rgba(59, 130, 246, 0.4)' : 'none'
                }}
              >
                <ArrowLeftRight size={16} />
                {isSubmitting ? 'НАДСИЛАННЯ...' : 'НАДІСЛАТИ ЗАПИТ НА СВ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
