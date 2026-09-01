import React, { useState, useMemo } from 'react'
import { Calculator, Package, Layers, TrendingUp, AlertCircle, Wrench, ShieldAlert } from 'lucide-react'

export const CostingCalculatorTab = ({
  nomenclatures = [],
  calculateItemCost
}) => {
  // Extract unique sorted categories
  const categoryList = useMemo(() => {
    const set = new Set(nomenclatures.map(n => n.category || 'Загальна').filter(Boolean))
    const priority = ['Продакшн', 'Тестові зразки', '04. Готова продукція', '03. Деталі', 'Карбонові листи', 'Гума еластична листова', 'Фрези', 'Метизи', 'Комплектуючі']
    
    return Array.from(set).sort((a, b) => {
      const idxA = priority.findIndex(p => a.toLowerCase().includes(p.toLowerCase()))
      const idxB = priority.findIndex(p => b.toLowerCase().includes(p.toLowerCase()))
      const valA = idxA !== -1 ? idxA : 999
      const valB = idxB !== -1 ? idxB : 999
      if (valA !== valB) return valA - valB
      return a.localeCompare(b, 'uk')
    })
  }, [nomenclatures])

  // Step 1: Selected Category
  const [selectedCategory, setSelectedCategory] = useState(() => {
    const prod = categoryList.find(c => c.toLowerCase().includes('продакшн'))
    return prod || categoryList[0] || 'all'
  })

  // Items filtered by chosen category
  const filteredNomenclatures = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') return nomenclatures
    return nomenclatures.filter(n => (n.category || 'Загальна') === selectedCategory)
  }, [nomenclatures, selectedCategory])

  // Step 2: Selected Item within Category
  const [selectedItemId, setSelectedItemId] = useState(() => {
    const initialList = selectedCategory && selectedCategory !== 'all' 
      ? nomenclatures.filter(n => (n.category || 'Загальна') === selectedCategory)
      : nomenclatures
    return initialList[0]?.id || nomenclatures[0]?.id || ''
  })

  // Sync selected item when category changes
  const handleCategoryChange = (newCat) => {
    setSelectedCategory(newCat)
    const itemsInCat = newCat === 'all' 
      ? nomenclatures 
      : nomenclatures.filter(n => (n.category || 'Загальна') === newCat)
    if (itemsInCat.length > 0) {
      setSelectedItemId(itemsInCat[0].id)
    }
  }

  const costing = useMemo(() => {
    if (!selectedItemId) return null
    return calculateItemCost(selectedItemId)
  }, [selectedItemId, calculateItemCost])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Selector Strip with 2 Linked Dropdowns */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Calculator size={22} />
        </div>

        {/* Dropdown 1: Category Selection */}
        <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            1. Оберіть Категорію v2.0:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #10b981',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text)',
              fontSize: '0.92rem',
              fontWeight: 900,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all" style={{ background: '#1c1c24' }}>📁 Всі Категорії ({nomenclatures.length})</option>
            {categoryList.map(cat => {
              const count = nomenclatures.filter(n => (n.category || 'Загальна') === cat).length
              return (
                <option key={cat} value={cat} style={{ background: '#1c1c24' }}>
                  🏷️ {cat} ({count})
                </option>
              )
            })}
          </select>
        </div>

        {/* Dropdown 2: Item Selection within Category */}
        <div style={{ flex: '2 1 320px', minWidth: '280px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            2. Оберіть Позицію для Калькуляції:
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #6366f1',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text)',
              fontSize: '0.95rem',
              fontWeight: 900,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {filteredNomenclatures.map(item => (
              <option key={item.id} value={item.id} style={{ background: '#1c1c24' }}>
                ✨ {item.name} ({item.code || 'Код N/A'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {costing ? (
        <>
          {/* Executive Cost & Margin Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            {/* Card 1: Material Cost */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                1. Сировина & BOM (грн)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#6366f1', marginTop: '4px' }}>
                ₴{costing.materialCost.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {costing.materialsBreakdown.length} складових деталей/метизів
              </div>
            </div>

            {/* Card 2: Labor Cost */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                2. Труд & Операції (грн)
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 950, color: '#ff9000', marginTop: '4px' }}>
                ₴{costing.directLaborCost.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Розкрій, галтовка, заточка, пакування
              </div>
            </div>

            {/* Card 3: Total COGS */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '18px', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase' }}>
                Повна Собівартість 1 од.
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#ef4444', marginTop: '4px' }}>
                ₴{costing.totalUnitCost.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Вкл. накладні витрати (+{costing.overheadCost} грн)
              </div>
            </div>

            {/* Card 4: Recommended Selling Price */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '18px', border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.08)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>
                Рекомендована Ціна
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#10b981', marginTop: '4px' }}>
                ₴{costing.recommendedPrice.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '2px', fontWeight: 900 }}>
                Маржинальність: {costing.marginPercentage}% (Прибуток: +₴{costing.marginAmount.toLocaleString()})
              </div>
            </div>
          </div>

          {/* Breakdown Section: Materials & Labor */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Left Box: BOM Materials Breakdown */}
            <div className="glass-panel" style={{ borderRadius: '20px', padding: '22px' }}>
              <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 950, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} color="#6366f1" /> Специфікація Матеріалів & Метизів (BOM)
              </h4>

              {costing.materialsBreakdown.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {costing.materialsBreakdown.map((mat, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.84rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 850, color: 'var(--text)' }}>{mat.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {mat.category} · {mat.quantity} шт × ₴{mat.unitCost}
                        </div>
                      </div>
                      <div style={{ fontWeight: 950, color: '#6366f1' }}>
                        ₴{mat.total.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                  Для даного виробу відсутні прив'язані BOM складові. Використовується базова калькуляція сировини (₴{costing.materialCost}).
                </div>
              )}
            </div>

            {/* Right Box: Visual Cost Structure Bar */}
            <div className="glass-panel" style={{ borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 950, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="#10b981" /> Структура Ціни та Прибутку
                </h4>

                {/* Progress bar visualizer */}
                <div style={{ height: '24px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', display: 'flex', overflow: 'hidden', marginBottom: '16px' }}>
                  <div style={{ width: `${(costing.materialCost / costing.recommendedPrice) * 100}%`, background: '#6366f1' }} title="Сировина & BOM" />
                  <div style={{ width: `${(costing.directLaborCost / costing.recommendedPrice) * 100}%`, background: '#ff9000' }} title="Труд & Операції" />
                  <div style={{ width: `${(costing.overheadCost / costing.recommendedPrice) * 100}%`, background: '#ef4444' }} title="Накладні витрати" />
                  <div style={{ width: `${(costing.marginAmount / costing.recommendedPrice) * 100}%`, background: '#10b981' }} title="Чистий прибуток / Маржа" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366f1' }} /> Сировина & BOM
                    </span>
                    <strong>₴{costing.materialCost} ({Math.round((costing.materialCost / costing.recommendedPrice) * 100)}%)</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff9000' }} /> Операційний Труд
                    </span>
                    <strong>₴{costing.directLaborCost} ({Math.round((costing.directLaborCost / costing.recommendedPrice) * 100)}%)</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} /> Накладні витрати
                    </span>
                    <strong>₴{costing.overheadCost} ({Math.round((costing.overheadCost / costing.recommendedPrice) * 100)}%)</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#10b981', fontWeight: 900 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} /> Валова Маржа
                    </span>
                    <strong>₴{costing.marginAmount} ({costing.marginPercentage}%)</strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--glass-border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                💡 Розрахунок здійснено відповідно до технологічного нормативу часу та актуальних тарифів на виробничі операції.
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Оберіть виріб зі списку вище для перегляду калькуляції.
        </div>
      )}
    </div>
  )
}
