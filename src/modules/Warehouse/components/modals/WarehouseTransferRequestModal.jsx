import React, { useState, useMemo, useEffect } from 'react'
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

  // Theme observer for real-time reactivity (light vs ultra-dark)
  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.body.classList.contains('light-theme')
    }
    return false
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    const updateTheme = () => {
      setIsLight(document.body.classList.contains('light-theme'))
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Comprehensive theme token system
  const t = useMemo(() => {
    if (isLight) {
      return {
        overlayBg: 'rgba(15, 23, 42, 0.65)',
        cardBg: '#ffffff',
        cardBorder: '#cbd5e1',
        cardShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        textMain: '#0f172a',
        textMuted: '#64748b',
        textDim: '#94a3b8',
        headerBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), #f8fafc)',
        headerBorder: '#e2e8f0',
        toolbarBg: '#f8fafc',
        toolbarBorder: '#e2e8f0',
        tabsContainerBg: '#e2e8f0',
        tabActiveBg: 'linear-gradient(135deg, #10b981, #059669)',
        tabActiveText: '#ffffff',
        tabInactiveText: '#475569',
        tabCountActiveBg: 'rgba(255,255,255,0.25)',
        tabCountInactiveBg: 'rgba(0,0,0,0.06)',
        searchBg: '#ffffff',
        searchBorder: '#cbd5e1',
        searchText: '#0f172a',
        searchIcon: '#64748b',
        searchPlaceholder: '#94a3b8',
        itemBg: '#ffffff',
        itemBorder: '#e2e8f0',
        itemSelectedBg: '#f0fdf4',
        itemSelectedBorder: '#10b981',
        itemTitle: '#0f172a',
        itemTitleSelected: '#047857',
        itemCodeBg: '#f1f5f9',
        itemCodeText: '#475569',
        itemCodeBorder: '#e2e8f0',
        stepperBg: '#f8fafc',
        stepperBorder: '#cbd5e1',
        stepperText: '#0f172a',
        stepperSelectedText: '#059669',
        stepperBtnColor: '#334155',
        stepperBtnDisabled: '#cbd5e1',
        quickBtnBg: '#ecfdf5',
        quickBtnBorder: '#a7f3d0',
        quickBtnText: '#059669',
        footerBg: '#f8fafc',
        footerBorder: '#e2e8f0',
        commentBg: '#ffffff',
        commentBorder: '#cbd5e1',
        commentText: '#0f172a',
        commentPlaceholder: '#94a3b8',
        summaryText: '#64748b',
        summaryCount: '#059669',
        summaryTotal: '#0f172a',
        cancelBg: '#fef2f2',
        cancelBorder: '#fecaca',
        cancelText: '#dc2626',
        cancelHoverBg: '#fee2e2',
        submitDisabledBg: '#e2e8f0',
        submitDisabledBorder: '#cbd5e1',
        submitDisabledText: '#94a3b8',
        submitActiveBg: 'linear-gradient(135deg, #10b981, #059669)',
        submitActiveShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
        closeBtnBg: '#f1f5f9',
        closeBtnBorder: '#cbd5e1',
        closeBtnColor: '#475569',
        closeBtnHoverBg: '#fee2e2',
        closeBtnHoverColor: '#dc2626',
        svStockColor: '#059669',
        svReservedColor: '#b45309',
        soStockColor: '#0284c7'
      }
    }
    return {
      overlayBg: 'rgba(0, 0, 0, 0.85)',
      cardBg: '#0a0a0d',
      cardBorder: '#23232c',
      cardShadow: '0 25px 60px rgba(0, 0, 0, 0.95)',
      textMain: '#ffffff',
      textMuted: '#94a3b8',
      textDim: '#71717a',
      headerBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), transparent)',
      headerBorder: '#1c1c24',
      toolbarBg: '#0d0d12',
      toolbarBorder: '#1c1c24',
      tabsContainerBg: '#14141a',
      tabActiveBg: 'linear-gradient(135deg, #10b981, #059669)',
      tabActiveText: '#ffffff',
      tabInactiveText: '#94a3b8',
      tabCountActiveBg: 'rgba(255,255,255,0.25)',
      tabCountInactiveBg: 'rgba(255,255,255,0.08)',
      searchBg: '#14141a',
      searchBorder: '#272734',
      searchText: '#ffffff',
      searchIcon: '#71717a',
      searchPlaceholder: '#71717a',
      itemBg: '#111116',
      itemBorder: '#202028',
      itemSelectedBg: 'rgba(16, 185, 129, 0.08)',
      itemSelectedBorder: '#10b981',
      itemTitle: '#ffffff',
      itemTitleSelected: '#34d399',
      itemCodeBg: 'rgba(255,255,255,0.06)',
      itemCodeText: '#a1a1aa',
      itemCodeBorder: 'rgba(255,255,255,0.08)',
      stepperBg: '#16161f',
      stepperBorder: '#2d2d3c',
      stepperText: '#ffffff',
      stepperSelectedText: '#34d399',
      stepperBtnColor: '#ffffff',
      stepperBtnDisabled: '#444455',
      quickBtnBg: 'rgba(16, 185, 129, 0.15)',
      quickBtnBorder: 'rgba(16, 185, 129, 0.35)',
      quickBtnText: '#34d399',
      footerBg: '#0d0d12',
      footerBorder: '#1c1c24',
      commentBg: '#14141a',
      commentBorder: '#272734',
      commentText: '#ffffff',
      commentPlaceholder: '#71717a',
      summaryText: '#94a3b8',
      summaryCount: '#34d399',
      summaryTotal: '#ffffff',
      cancelBg: 'rgba(239, 68, 68, 0.12)',
      cancelBorder: 'rgba(239, 68, 68, 0.35)',
      cancelText: '#f87171',
      cancelHoverBg: 'rgba(239, 68, 68, 0.22)',
      submitDisabledBg: '#1e1e24',
      submitDisabledBorder: '#2d2d38',
      submitDisabledText: '#555566',
      submitActiveBg: 'linear-gradient(135deg, #10b981, #059669)',
      submitActiveShadow: '0 4px 15px rgba(16, 185, 129, 0.45)',
      closeBtnBg: '#18181e',
      closeBtnBorder: '#2a2a34',
      closeBtnColor: '#94a3b8',
      closeBtnHoverBg: 'rgba(239, 68, 68, 0.2)',
      closeBtnHoverColor: '#f87171',
      svStockColor: '#10b981',
      svReservedColor: '#f59e0b',
      soStockColor: '#38bdf8'
    }
  }, [isLight])

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
      const authorName = currentUser
        ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.login
        : 'Комірник СО'

      const transferNote = `[TRANSFER_SO_SV] Запит на переміщення з СВ на СО. ${comment ? `Коментар: ${comment}. ` : ''}Ініціатор: ${authorName}`

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
            details: `Переміщення на СО: ${it?.name || 'Позиція'} — ${qty} ${it?.unit || 'шт'}`,
            comment: comment ? String(comment).trim() : null,
            author: authorName,
            notes: transferNote
          }
        })

      const orderNum = comment && comment.trim()
        ? `ПЕРЕМІЩЕННЯ НА СО (${comment.trim().slice(0, 35)})`
        : 'ПЕРЕМІЩЕННЯ НА СО'

      const { error } = await supabase.from('purchase_requests').insert([{
        order_id: null,
        order_num: orderNum,
        task_id: null,
        status: 'pending',
        destination_warehouse: 'production',
        items
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
        background: t.overlayBg,
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
          background: t.cardBg,
          border: `1px solid ${t.cardBorder}`,
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: t.cardShadow,
          color: t.textMain,
          transition: 'background 0.2s, border-color 0.2s'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: `1px solid ${t.headerBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: t.headerBg
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                flexShrink: 0
              }}
            >
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.02em', color: t.textMain }}>
                ЗАПИТ НА ПЕРЕМІЩЕННЯ (СВ → СО)
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: t.textMuted }}>
                Замовлення фрез та розхідників з основного Складу Виробництва на Оперативний склад
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Закрити"
            style={{
              background: t.closeBtnBg,
              border: `1px solid ${t.closeBtnBorder}`,
              color: t.closeBtnColor,
              cursor: 'pointer',
              padding: '7px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = t.closeBtnHoverBg
              e.currentTarget.style.color = t.closeBtnHoverColor
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = t.closeBtnBg
              e.currentTarget.style.color = t.closeBtnColor
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: Category tabs + Search */}
        <div
          style={{
            padding: '14px 28px',
            borderBottom: `1px solid ${t.toolbarBorder}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: t.toolbarBg
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: t.tabsContainerBg, padding: '4px', borderRadius: '12px' }}>
            <button
              type="button"
              onClick={() => setActiveCategory('cutters')}
              style={{
                background: activeCategory === 'cutters' ? t.tabActiveBg : 'transparent',
                color: activeCategory === 'cutters' ? t.tabActiveText : t.tabInactiveText,
                border: 'none',
                padding: '8px 16px',
                borderRadius: '9px',
                fontWeight: 900,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s',
                boxShadow: activeCategory === 'cutters' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
              }}
            >
              <span>⚙️ ФРЕЗИ</span>
              <span style={{
                background: activeCategory === 'cutters' ? t.tabCountActiveBg : t.tabCountInactiveBg,
                padding: '2px 7px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 800
              }}>
                {cuttersList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              style={{
                background: activeCategory === 'all' ? t.tabActiveBg : 'transparent',
                color: activeCategory === 'all' ? t.tabActiveText : t.tabInactiveText,
                border: 'none',
                padding: '8px 16px',
                borderRadius: '9px',
                fontWeight: 900,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s',
                boxShadow: activeCategory === 'all' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
              }}
            >
              <span>📦 ВСІ МАТЕРІАЛИ</span>
              <span style={{
                background: activeCategory === 'all' ? t.tabCountActiveBg : t.tabCountInactiveBg,
                padding: '2px 7px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 800
              }}>
                {allItemsList.length}
              </span>
            </button>
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '420px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.searchIcon }} />
            <input
              type="text"
              placeholder="Швидкий пошук за назвою або діаметром..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '10px',
                border: `1px solid ${t.searchBorder}`,
                background: t.searchBg,
                color: t.searchText,
                fontSize: '0.82rem',
                fontWeight: 700,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: t.textDim, cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px', background: t.cardBg }}>
          {displayList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: t.textMuted }}>
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
                      background: isSelected ? t.itemSelectedBg : t.itemBg,
                      border: isSelected ? `1.5px solid ${t.itemSelectedBorder}` : `1px solid ${t.itemBorder}`,
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
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: isSelected ? t.itemTitleSelected : t.itemTitle }}>
                          {item.name}
                        </span>
                        {item.code && (
                          <span style={{
                            background: t.itemCodeBg,
                            color: t.itemCodeText,
                            border: `1px solid ${t.itemCodeBorder}`,
                            padding: '2px 6px',
                            borderRadius: '5px',
                            fontSize: '0.65rem',
                            fontWeight: 800
                          }}>
                            {item.code}
                          </span>
                        )}
                      </div>

                      {/* Stock balances on SV & SO */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.74rem' }}>
                        <span style={{ color: item.svAvailable > 0 ? t.svStockColor : '#ef4444', fontWeight: 800 }}>
                          🏭 На СВ: <strong>{item.svAvailable} {item.unit}</strong>
                          {item.svReserved > 0 && <span style={{ opacity: 0.85, fontWeight: 700, color: t.svReservedColor }}> (забр: {item.svReserved})</span>}
                        </span>
                        <span style={{ color: t.textMuted, fontWeight: 700 }}>
                          📍 На СО: <strong style={{ color: item.soTotal > 0 ? t.soStockColor : t.textDim }}>{item.soTotal} {item.unit}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: t.stepperBg,
                        borderRadius: '10px',
                        border: `1px solid ${t.stepperBorder}`,
                        overflow: 'hidden'
                      }}>
                        <button
                          type="button"
                          onClick={() => handleStepQty(item.key, -1)}
                          disabled={qtySelected <= 0}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: qtySelected > 0 ? t.stepperBtnColor : t.stepperBtnDisabled,
                            width: '34px',
                            height: '34px',
                            cursor: qtySelected > 0 ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.1s'
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
                            color: isSelected ? t.stepperSelectedText : t.stepperText,
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
                            color: t.stepperBtnColor,
                            width: '34px',
                            height: '34px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.1s'
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
                          background: t.quickBtnBg,
                          border: `1px solid ${t.quickBtnBorder}`,
                          color: t.quickBtnText,
                          padding: '0 10px',
                          height: '34px',
                          borderRadius: '8px',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          transition: 'all 0.1s'
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
            padding: '16px 28px',
            borderTop: `1px solid ${t.footerBorder}`,
            background: t.footerBg,
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
                border: `1px solid ${t.commentBorder}`,
                background: t.commentBg,
                color: t.commentText,
                fontSize: '0.82rem',
                fontWeight: 700,
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '0.78rem', color: t.summaryText, textAlign: 'right' }}>
                Обрано: <strong style={{ color: t.summaryCount }}>{selectedCount}</strong> поз. (<strong style={{ color: t.summaryTotal }}>{totalPcs} шт</strong>)
              </div>

              {/* Кнопка скасування - ЧЕРВОНА */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  background: t.cancelBg,
                  border: `1px solid ${t.cancelBorder}`,
                  color: t.cancelText,
                  padding: '11px 20px',
                  borderRadius: '12px',
                  fontWeight: 900,
                  fontSize: '0.82rem',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  if (!isSubmitting) e.currentTarget.style.background = t.cancelHoverBg
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = t.cancelBg
                }}
              >
                <X size={15} />
                <span>СКАСУВАТИ</span>
              </button>

              {/* Погоджувальна кнопка - ЗЕЛЕНА */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || selectedCount === 0 || totalPcs <= 0}
                style={{
                  background: selectedCount > 0 && totalPcs > 0 && !isSubmitting
                    ? t.submitActiveBg
                    : t.submitDisabledBg,
                  border: selectedCount > 0 && totalPcs > 0 && !isSubmitting
                    ? 'none'
                    : `1px solid ${t.submitDisabledBorder}`,
                  color: selectedCount > 0 && totalPcs > 0 && !isSubmitting ? '#ffffff' : t.submitDisabledText,
                  padding: '11px 24px',
                  borderRadius: '12px',
                  fontWeight: 950,
                  fontSize: '0.85rem',
                  cursor: selectedCount > 0 && totalPcs > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: selectedCount > 0 && totalPcs > 0 && !isSubmitting ? t.submitActiveShadow : 'none',
                  transition: 'all 0.15s'
                }}
              >
                <Check size={16} />
                <span>{isSubmitting ? 'НАДСИЛАННЯ...' : 'НАДІСЛАТИ ЗАПИТ НА СВ'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
