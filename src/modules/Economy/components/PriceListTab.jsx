import React, { useState, useMemo } from 'react'
import { Search, Filter, DollarSign, Percent, Save, Check, Layers, RefreshCw, ArrowUpRight } from 'lucide-react'

export const PriceListTab = ({
  nomenclatures = [],
  pricesMap = {},
  costRates = {},
  calculateItemCost,
  onUpdatePrice,
  onBulkUpdatePrices
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [editingItemId, setEditingItemId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // Bulk Adjustment Modal / Panel state
  const [showBulkPanel, setShowBulkPanel] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('all')
  const [bulkPercent, setBulkPercent] = useState(10)
  const [bulkField, setBulkField] = useState('wholesalePrice')

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set(nomenclatures.map(n => n.category || 'Загальна').filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [nomenclatures])

  // Filtered nomenclatures list
  const filteredItems = useMemo(() => {
    return nomenclatures.filter(item => {
      const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.code || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCat = selectedCategory === 'all' || (item.category || 'Загальна') === selectedCategory
      return matchesSearch && matchesCat
    })
  }, [nomenclatures, searchQuery, selectedCategory])

  const handleStartEdit = (item) => {
    const existing = pricesMap[item.id] || {}
    const costing = calculateItemCost ? calculateItemCost(item.id) : null
    
    setEditingItemId(item.id)
    setEditForm({
      wholesalePrice: existing.wholesalePrice || costing?.recommendedPrice || item.price || 0,
      retailPrice: existing.retailPrice || Math.round((existing.wholesalePrice || costing?.recommendedPrice || item.price || 0) * 1.25),
      dealerPrice: existing.dealerPrice || Math.round((existing.wholesalePrice || costing?.recommendedPrice || item.price || 0) * 0.9),
      rawMaterialCost: existing.rawMaterialCost || costing?.materialCost || 0
    })
  }

  const handleSaveEdit = (itemId) => {
    onUpdatePrice(itemId, editForm)
    setEditingItemId(null)
  }

  const handleExecuteBulk = () => {
    if (onBulkUpdatePrices) {
      onBulkUpdatePrices(bulkCategory, Number(bulkPercent), bulkField)
      setShowBulkPanel(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls Strip: Search, Category Filter & Bulk Price Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Пошук номенклатури за назвою або артикулом..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(0,0,0,0.2)',
              color: 'var(--text)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Category Pills & Bulk Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(0,0,0,0.2)',
              color: 'var(--text)',
              fontSize: '0.82rem',
              fontWeight: 800,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat} style={{ background: '#1c1c24' }}>
                {cat === 'all' ? '📁 Всі Категорії' : `🏷️ ${cat}`}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowBulkPanel(!showBulkPanel)}
            style={{
              padding: '9px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontWeight: 900,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Percent size={15} /> Групова Індексація Цін
          </button>
        </div>
      </div>

      {/* Bulk Price Adjustment Drawer / Banner */}
      {showBulkPanel && (
        <div className="glass-panel" style={{
          padding: '18px 22px',
          borderRadius: '18px',
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid #10b981',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontWeight: 950, color: '#10b981', fontSize: '0.95rem' }}>
              Групова зміна цін для економіста
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Автоматичний перерахунок цін вибраної категорії на вказаний відсоток
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '0.8rem' }}
            >
              <option value="all">Усі Категорії</option>
              {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={bulkField}
              onChange={(e) => setBulkField(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '0.8rem' }}
            >
              <option value="wholesalePrice">Гуртова Ціна</option>
              <option value="retailPrice">Роздрібна Ціна</option>
              <option value="dealerPrice">Дилерська Ціна</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                style={{ width: '70px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', color: 'var(--text)', border: '1px solid #10b981', textAlign: 'center', fontWeight: 900, outline: 'none' }}
              />
              <span style={{ fontWeight: 900, color: '#10b981' }}>%</span>
            </div>

            <button
              onClick={handleExecuteBulk}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                fontWeight: 950,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
              }}
            >
              Застосувати Перерахунок
            </button>
          </div>
        </div>
      )}

      {/* Main Prices Table */}
      <div className="glass-panel" style={{ borderRadius: '20px', padding: '20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px' }}>Артикул / Позиція</th>
              <th style={{ padding: '12px' }}>Категорія</th>
              <th style={{ padding: '12px' }}>Собівартість Сировини (₴)</th>
              <th style={{ padding: '12px' }}>Гуртова Ціна (₴)</th>
              <th style={{ padding: '12px' }}>Роздрібна Ціна (₴)</th>
              <th style={{ padding: '12px' }}>Дилерська Ціна (₴)</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Дії</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Жодної позиції номенклатури не знайдено.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const isEditing = editingItemId === item.id
                const pRecord = pricesMap[item.id] || {}
                const costing = calculateItemCost ? calculateItemCost(item.id) : null

                const hasManualRawCost = pRecord.rawMaterialCost !== undefined && pRecord.rawMaterialCost > 0
                const rawMaterialCost = isEditing ? editForm.rawMaterialCost : (hasManualRawCost ? pRecord.rawMaterialCost : (costing?.materialCost || 0))
                const isRawCostAuto = !hasManualRawCost && costing?.materialCost > 0

                const hasManualWholesale = pRecord.wholesalePrice !== undefined && pRecord.wholesalePrice > 0
                const wholesalePrice = isEditing ? editForm.wholesalePrice : (hasManualWholesale ? pRecord.wholesalePrice : (costing?.recommendedPrice || item.price || 0))
                const isWholesaleAuto = !hasManualWholesale && costing?.recommendedPrice > 0

                const retailPrice = isEditing ? editForm.retailPrice : (pRecord.retailPrice || Math.round(wholesalePrice * (1 + (costRates.retailMarkupPercentage || 25) / 100)))
                const dealerPrice = isEditing ? editForm.dealerPrice : (pRecord.dealerPrice || Math.round(wholesalePrice * (1 - (costRates.dealerDiscountPercentage || 10) / 100)))

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontSize: '0.86rem',
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Item Name & Code */}
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontWeight: 900, color: 'var(--text)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Код: {item.code || item.id}
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '14px 12px' }}>
                      {(() => {
                        const cat = item.category || 'Загальна'
                        let bg = 'rgba(255,255,255,0.06)'
                        let color = 'var(--text)'
                        let border = '1px solid var(--glass-border)'
                        const lower = cat.toLowerCase()
                        if (lower.includes('сировин') || lower.includes('лист')) { bg = 'rgba(99, 102, 241, 0.15)'; color = '#6366f1'; border = '1px solid rgba(99, 102, 241, 0.3)'; }
                        else if (lower.includes('метиз') || lower.includes('кріпл')) { bg = 'rgba(56, 189, 248, 0.15)'; color = '#38bdf8'; border = '1px solid rgba(56, 189, 248, 0.3)'; }
                        else if (lower.includes('інструм') || lower.includes('фрез')) { bg = 'rgba(255, 144, 0, 0.15)'; color = '#ff9000'; border = '1px solid rgba(255, 144, 0, 0.3)'; }
                        else if (lower.includes('готов') || lower.includes('рам')) { bg = 'rgba(16, 185, 129, 0.15)'; color = '#10b981'; border = '1px solid rgba(16, 185, 129, 0.3)'; }
                        else if (lower.includes('детал') || lower.includes('компон')) { bg = 'rgba(139, 92, 246, 0.15)'; color = '#8b5cf6'; border = '1px solid rgba(139, 92, 246, 0.3)'; }

                        return (
                          <span style={{ padding: '4px 10px', borderRadius: '10px', background: bg, color, border, fontSize: '0.76rem', fontWeight: 900 }}>
                            {cat}
                          </span>
                        )
                      })()}
                    </td>

                    {/* Raw Material Cost */}
                    <td style={{ padding: '14px 12px', fontWeight: 850, color: '#6366f1' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.rawMaterialCost}
                          onChange={(e) => setEditForm({ ...editForm, rawMaterialCost: Number(e.target.value) })}
                          style={{ width: '90px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #6366f1', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none', fontWeight: 850 }}
                        />
                      ) : (
                        rawMaterialCost > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>₴{rawMaterialCost.toLocaleString()}</span>
                            {isRawCostAuto && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 900 }} title="Автоматично розраховано за BOM калькуляцією">
                                ⚡ BOM
                              </span>
                            )}
                          </div>
                        ) : '—'
                      )}
                    </td>

                    {/* Wholesale Price */}
                    <td style={{ padding: '14px 12px', fontWeight: 950, color: '#10b981' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.wholesalePrice}
                          onChange={(e) => setEditForm({ ...editForm, wholesalePrice: Number(e.target.value) })}
                          style={{ width: '95px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #10b981', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none', fontWeight: 900 }}
                        />
                      ) : (
                        wholesalePrice > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>₴{wholesalePrice.toLocaleString()}</span>
                            {isWholesaleAuto && (
                              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: 900 }} title="Автоматична рекомендована ціна">
                                ⚡ Авто
                              </span>
                            )}
                          </div>
                        ) : '—'
                      )}
                    </td>

                    {/* Retail Price */}
                    <td style={{ padding: '14px 12px', fontWeight: 850, color: '#ff9000' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.retailPrice}
                          onChange={(e) => setEditForm({ ...editForm, retailPrice: Number(e.target.value) })}
                          style={{ width: '95px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #ff9000', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none', fontWeight: 900 }}
                        />
                      ) : (
                        retailPrice > 0 ? `₴${retailPrice.toLocaleString()}` : '—'
                      )}
                    </td>

                    {/* Dealer Price */}
                    <td style={{ padding: '14px 12px', fontWeight: 850, color: '#ec4899' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.dealerPrice}
                          onChange={(e) => setEditForm({ ...editForm, dealerPrice: Number(e.target.value) })}
                          style={{ width: '95px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #ec4899', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none', fontWeight: 900 }}
                        />
                      ) : (
                        dealerPrice > 0 ? `₴${dealerPrice.toLocaleString()}` : '—'
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                      {isEditing ? (
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#10b981',
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Check size={14} /> Зберегти
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'var(--text)',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Змінити ціни
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
