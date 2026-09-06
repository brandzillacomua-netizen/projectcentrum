import React from 'react'
import { CheckCircle2, Package, Layers, X, ArrowLeft } from 'lucide-react'
import { QUALITY_CLASSIFICATION_OPTIONS } from '../../VKYA/quality-hold/qualityHoldModel'

export const BrakClassificationQueue = React.memo(({
  viewingCategory,
  viewingCategoryLabel,
  readyItems = [],
  filteredReadyItems = [],
  paginatedReadyItems = [],
  itemsInCat = [],
  paginatedCategoryItems = [],
  categoryTotalQuantity = 0,
  manualCardNumber = '',
  queuePage,
  setQueuePage,
  totalPages,
  categoryPage,
  setCategoryPage,
  categoryTotalPages,
  selectedItem,
  setSelectedItem,
  nomenclatures = [],
  distribution,
  updateCategoryQty,
  reasonAllocations,
  setReasonAllocations,
  updateReasonQty,
  activeScrapReasons = [],
  totalDistributed,
  totalReasonAllocated,
  isReasonDistributionValid,
  remainingInBatch,
  isProcessing,
  handleBulkClassify,
  handleDispose,
  handleRework,
  openRestorationModal,
  openReworkModal,
  setRouteReturnDraft
}) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
      
      {/* List of Pending Items */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 950, color: 'var(--text-color, #fff)' }}>
            {viewingCategory ? `Деталі: ${viewingCategoryLabel}` : 'КАРАНТИН · ОЧІКУЮТЬ КЛАСИФІКАЦІЇ ВКЯ'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: viewingCategory ? 'var(--btn-ghost-bg, #333)' : '#ef444415', padding: '8px 14px', borderRadius: '10px', color: viewingCategory ? 'var(--text-color, #fff)' : '#ef4444', fontSize: '0.75rem', fontWeight: 1000 }}>
              {viewingCategory
                ? `${itemsInCat.length} ПОЗИЦІЙ · ${categoryTotalQuantity} ШТ`
                : manualCardNumber.trim()
                  ? `ЗНАЙДЕНО: ${filteredReadyItems.length} з ${readyItems.length}`
                  : `${readyItems.length} ПОЗИЦІЙ`
              }
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(!viewingCategory && readyItems.length === 0) && (
            <div style={{ 
              background: 'var(--card-bg, #0a0a0a)', border: '2px dashed var(--border-color, #1a1a1a)', borderRadius: '24px', 
              padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted, #444)' 
            }}>
              <CheckCircle2 size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
              <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}>Поки що браку немає</div>
              <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>Як тільки Майстер перенесе брак з прийомки, він з'явиться тут</div>
            </div>
          )}

          {viewingCategory && itemsInCat.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #444)', background: 'var(--card-bg, #0a0a0a)', borderRadius: '20px' }}>
              Ця категорія порожня
            </div>
          )}

          {/* RENDER LIST: Either classifications OR category details */}
          {viewingCategory ? (
            paginatedCategoryItems.map(item => (
              <div key={item.id} style={{ 
                background: 'var(--card-bg, #111)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border-color, #1a1a1a)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '2px', color: 'var(--text-color, #fff)' }}>{item.name}</div>
                  {item.is_classified_lot && (
                    <div style={{ fontSize: '0.68rem', lineHeight: 1.55, color: 'var(--text-muted, #777)', fontWeight: 800 }}>
                      <span style={{ color: '#eab308' }}>Наряд №{item.naryad_number}</span>
                      {item.card_sequence ? <> · <span style={{ color: '#06b6d4' }}>Картка №{item.card_sequence}</span></> : null}
                      {item.operator ? <> · Оператор: <span style={{ color: '#a78bfa' }}>{item.operator}</span></> : null}
                      {item.stage ? <> · Етап: {item.stage}</> : null}
                    </div>
                  )}
                  {item.is_legacy_aggregate && (
                    <div style={{ color: '#f97316', fontSize: '0.66rem', fontWeight: 950, marginTop: '3px' }}>
                      СТАРИЙ АГРЕГОВАНИЙ ЗАЛИШОК · ДЖЕРЕЛО НАРЯДУ НЕ ЗБЕРЕЖЕНЕ
                    </div>
                  )}
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #555)', fontWeight: 800 }}>Обліковується як: {item.type === 'scrap_restoration' ? 'Відновлення (ВКЯ)' : item.type}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                   <div style={{ textAlign: 'right', marginRight: '10px' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 1000, color: 'var(--text-color, #fff)' }}>{item.total_qty} <small style={{ fontSize: '0.7rem', opacity: 0.3 }}>шт</small></div>
                   </div>
                   {viewingCategory === 'restoration' ? (
                     <>
                       <button 
                         onClick={() => handleRework(item, 'Пресування [ЦЕХ №2]')}
                         style={{ background: '#8b5cf6', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                       >ПРЕСУВАННЯ</button>
                       <button 
                         onClick={() => handleRework(item, 'Фарбування')}
                         style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                       >ФАРБУВАННЯ</button>
                     </>
                   ) : viewingCategory === 'brak' ? (
                     <>
                       <button 
                         onClick={() => openReworkModal(item)}
                         style={{ background: '#10b981', border: 'none', color: '#00150e', padding: '10px 15px', borderRadius: '12px', fontWeight: 950, fontSize: '0.75rem', cursor: 'pointer' }}
                       >НА ДООПРАЦЮВАННЯ</button>
                       <button 
                         onClick={() => openRestorationModal(item)}
                         style={{ background: '#06b6d4', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                       >НА ВІДНОВЛЕННЯ</button>
                     </>
                   ) : viewingCategory === 4 ? (
                     <button 
                       onClick={() => handleDispose(item)}
                       style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                     >СПИСАТИ</button>
                    ) : (
                      <button 
                        onClick={() => openRestorationModal(item)}
                        style={{ background: '#06b6d4', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                      >НА ВІДНОВЛЕННЯ</button>
                    )}
                </div>
              </div>
            ))
          ) : (
            paginatedReadyItems.map(item => {
              const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
              const isActive = selectedItem?.id === item.id
              return (
                <div key={item.id} 
                  className="queue-item-card"
                  onClick={() => setSelectedItem(item)}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedItem(item) }}
                  role="button"
                  tabIndex={0}
                  style={{ 
                    background: isActive ? 'rgba(239, 68, 68, 0.05)' : 'var(--card-bg, #111)', 
                    borderRadius: '20px', padding: '20px', cursor: 'pointer',
                    border: `1px solid ${isActive ? '#ef444450' : 'var(--border-color, #1a1a1a)'}`,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isActive ? '0 10px 30px rgba(239, 68, 68, 0.1)' : 'none'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ 
                      background: 'var(--card-inner-bg, #000)', width: '50px', height: '50px', borderRadius: '14px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted, #555)' 
                     }}>
                      <Package size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '2px', color: 'var(--text-color, #fff)' }}>{nom?.name || item.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: '5px', fontSize: '0.67rem', fontWeight: 850 }}>
                        <span style={{ color: '#f59e0b' }}>Наряд №{item.naryad_number}</span>
                        <span style={{ color: '#38bdf8' }}>Картка №{item.card_sequence || '—'}</span>
                        {item.task_card_sequence && item.task_card_sequence !== item.card_sequence && (
                          <span style={{ color: '#64748b' }}>у наряді №{item.task_card_sequence}</span>
                        )}
                        <span style={{ color: '#64748b' }} title={item.card_id ? String(item.card_id) : ''}>Системна #{item.card_number}</span>
                        <span style={{ color: 'var(--text-muted, #666)' }}>Отримано: {new Date(item.updated_at).toLocaleDateString('uk-UA')}</span>
                      </div>
                      {item.operator && <div style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 800, marginTop: '3px' }}>Оператор: {item.operator} · Етап: {item.stage || '—'}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: 'var(--text-color, #fff)' }}>{item.total_qty} <small style={{ fontSize: '0.7rem', opacity: 0.3 }}>шт</small></div>
                    {!isActive && <div style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 1000, textTransform: 'uppercase', marginTop: '5px' }}>Натисніть для класифікації</div>}
                  </div>
                </div>
              )
            })
          )}

          {!viewingCategory && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '25px', flexWrap: 'wrap' }}>
              <button
                disabled={queuePage === 1}
                onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                style={{
                  background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: queuePage === 1 ? 'var(--text-muted, #444)' : 'var(--text-color, #fff)',
                  padding: '8px 16px', borderRadius: '10px', fontWeight: 800, cursor: queuePage === 1 ? 'default' : 'pointer'
                }}
              >
                Назад
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1
                const isActive = pageNum === queuePage
                return (
                  <button
                    key={pageNum}
                    onClick={() => setQueuePage(pageNum)}
                    style={{
                      background: isActive ? '#ef4444' : 'var(--card-bg, #111)',
                      border: `1px solid ${isActive ? '#ef4444' : 'var(--border-color, #222)'}`,
                      color: '#fff',
                      width: '36px', height: '36px', borderRadius: '10px',
                      fontWeight: 900, cursor: 'pointer',
                      boxShadow: isActive ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none'
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                disabled={queuePage === totalPages}
                onClick={() => setQueuePage(p => Math.min(totalPages, p + 1))}
                style={{
                  background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: queuePage === totalPages ? 'var(--text-muted, #444)' : 'var(--text-color, #fff)',
                  padding: '8px 16px', borderRadius: '10px', fontWeight: 800, cursor: queuePage === totalPages ? 'default' : 'pointer'
                }}
              >
                Вперед
              </button>
            </div>
          )}

          {viewingCategory && categoryTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '25px', flexWrap: 'wrap' }}>
              <button
                disabled={categoryPage === 1}
                onClick={() => setCategoryPage(p => Math.max(1, p - 1))}
                style={{
                  background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: categoryPage === 1 ? 'var(--text-muted, #444)' : 'var(--text-color, #fff)',
                  padding: '8px 16px', borderRadius: '10px', fontWeight: 800, cursor: categoryPage === 1 ? 'default' : 'pointer'
                }}
              >
                Назад
              </button>
              {Array.from({ length: categoryTotalPages }).map((_, idx) => {
                const pageNum = idx + 1
                const isActive = pageNum === categoryPage
                const categoryColor = viewingCategory === 'brak' ? '#a855f7' : viewingCategory === 'restoration' ? '#06b6d4' : '#ef4444'
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCategoryPage(pageNum)}
                    style={{
                      background: isActive ? categoryColor : 'var(--card-bg, #111)',
                      border: `1px solid ${isActive ? categoryColor : 'var(--border-color, #222)'}`,
                      color: '#fff',
                      width: '36px', height: '36px', borderRadius: '10px',
                      fontWeight: 900, cursor: 'pointer',
                      boxShadow: isActive ? `0 0 10px ${categoryColor}40` : 'none'
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                disabled={categoryPage === categoryTotalPages}
                onClick={() => setCategoryPage(p => Math.min(categoryTotalPages, p + 1))}
                style={{
                  background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: categoryPage === categoryTotalPages ? 'var(--text-muted, #444)' : 'var(--text-color, #fff)',
                  padding: '8px 16px', borderRadius: '10px', fontWeight: 800, cursor: categoryPage === categoryTotalPages ? 'default' : 'pointer'
                }}
              >
                Вперед
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CLASSIFICATION FORM MODAL */}
      {selectedItem && (
        <div 
          onClick={() => setSelectedItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10050,
            background: 'rgba(0, 0, 0, 0.85)',
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
              background: 'var(--card-bg, #0d0d0d)',
              borderRadius: '28px',
              border: '1px solid #ef444450',
              padding: '30px',
              boxShadow: '0 25px 80px rgba(0,0,0,0.9)',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid var(--border-color, #1f1f1f)', paddingBottom: '20px' }}>
              <div>
                <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Класифікація браку</div>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 950, color: 'var(--text-color, #fff)' }}>{selectedItem.name}</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'var(--btn-ghost-bg, #1c1c1c)', border: 'none', color: 'var(--text-muted, #888)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {selectedItem.is_history_row && !selectedItem.is_vkya_return && (
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '18px', padding: '16px 20px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <div style={{ color: '#10b981', fontWeight: 950, fontSize: '0.85rem' }}>ПЕРЕВІРКА ПРИДАТНОСТІ ДЕТАЛЕЙ</div>
                  <div style={{ color: 'var(--text-muted, #888)', fontSize: '0.75rem', marginTop: '3px' }}>
                    Якщо брак виявлено помилково, ви можете повернути повністю або частину партії безпосередньо в наряд.
                  </div>
                </div>
                <button
                  onClick={() => setRouteReturnDraft(selectedItem)}
                  style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 950, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  ПОВЕРНУТИ В НАРЯД
                </button>
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '25px', marginBottom: '25px', border: '1px solid var(--border-color, #1a1a1a)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #777)', fontWeight: 950, textTransform: 'uppercase', marginBottom: '15px' }}>РОЗПОДІЛ ЗА КАТЕГОРІЯМИ</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {QUALITY_CLASSIFICATION_OPTIONS.map(c => {
                  const catKey = c.category || c.cat
                  const labelText = c.label
                  const descText = c.description || c.desc
                  return (
                    <div key={catKey} style={{ background: 'var(--card-inner-bg, #080808)', border: '1px solid var(--border-color, #1f1f1f)', borderRadius: '14px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 900, color: c.color }}>{labelText}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted, #555)', marginTop: '2px' }}>{descText}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button 
                          onClick={() => updateCategoryQty(catKey, Math.max(0, Number(distribution[catKey] || 0) - 1))}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: 'var(--text-color, #fff)', cursor: 'pointer' }}
                        >-</button>
                        <input 
                          type="number"
                          value={distribution[catKey] === 0 ? '' : distribution[catKey]}
                          onChange={(e) => {
                            const val = e.target.value
                            updateCategoryQty(catKey, val === '' ? 0 : parseInt(val) || 0)
                          }}
                          placeholder="0"
                          style={{ width: '50px', textAlign: 'center', background: 'transparent', border: 'none', color: 'var(--text-color, #fff)', fontSize: '1.1rem', fontWeight: 1000, outline: 'none' }}
                        />
                        <button 
                          onClick={() => updateCategoryQty(catKey, Number(distribution[catKey] || 0) + 1)}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: 'var(--text-color, #fff)', cursor: 'pointer' }}
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ 
                marginTop: '25px', padding: '15px', borderRadius: '15px', background: 'var(--card-inner-bg, #000)', border: '1px solid var(--border-color, #222)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted, #444)' }}>ВИБРАНО: <span style={{ color: remainingInBatch < 0 ? '#ef4444' : 'var(--text-color, #fff)' }}>{totalDistributed} / {selectedItem.total_qty}</span></div>
                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted, #444)' }}>ЗАЛИШОК: <span style={{ color: remainingInBatch < 0 ? '#ef4444' : '#10b981' }}>{remainingInBatch} шт</span></div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '25px', marginBottom: '30px', border: '1px solid var(--border-color, #1a1a1a)' }}>
              <div style={{ marginBottom: '18px' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #777)', fontWeight: 950, textTransform: 'uppercase' }}>ПРИЧИНИ БРАКУ</div>
                  <div style={{ color: 'var(--text-muted, #444)', fontSize: '0.63rem', marginTop: '4px' }}>
                    {totalDistributed > 0 ? `Розподіліть за причинами ${totalDistributed} шт, вибраних вище` : 'Спочатку вкажіть кількість у категоріях вище'}
                  </div>
                </div>
              </div>
              {totalDistributed === 0 ? (
                <div style={{ padding: '22px', textAlign: 'center', background: 'var(--card-inner-bg, #090909)', border: '1px dashed var(--border-color, #292929)', borderRadius: '13px', color: 'var(--text-muted, #555)', fontSize: '0.72rem', fontWeight: 800 }}>
                  Блок причин стане доступним після розподілу хоча б однієї деталі за категоріями
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {reasonAllocations.map((allocation, index) => (
                      <div key={index} style={{ background: 'var(--card-inner-bg, #090909)', border: `1px solid ${Number(allocation.qty) > 0 && !allocation.reason ? '#ef444466' : 'var(--border-color, #1d1d1d)'}`, borderRadius: '13px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-muted, #555)', fontSize: '0.6rem', fontWeight: 900 }}>
                          <span>ПРИЧИНА {index + 1}</span><span>КІЛЬКІСТЬ</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '9px', alignItems: 'center' }}>
                          <select 
                            value={allocation.reason} 
                            onChange={event => setReasonAllocations(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))}
                            style={{ minWidth: 0, width: '100%', background: 'var(--card-bg, #050505)', border: '1px solid var(--border-color, #292929)', color: allocation.reason ? 'var(--text-color, #fff)' : 'var(--text-muted, #666)', padding: '11px', borderRadius: '99px', fontWeight: 800, outline: 'none' }}
                          >
                            <option value="">Оберіть причину...</option>
                            {activeScrapReasons.filter(reason => reason === allocation.reason || !reasonAllocations.some((item, itemIndex) => itemIndex !== index && item.reason === reason)).map(reason => <option key={reason} value={reason}>{reason}</option>)}
                          </select>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button 
                              onClick={() => updateReasonQty(index, Number(allocation.qty) - 1)} 
                              disabled={Number(allocation.qty) <= 0}
                              style={{ width: '32px', height: '32px', background: 'var(--card-bg, #151515)', border: '1px solid var(--border-color, #292929)', color: 'var(--text-color, #fff)', borderRadius: '8px', cursor: 'pointer' }}
                            >−</button>
                            <input 
                              type="number" min="0" max={totalDistributed} value={allocation.qty || ''} placeholder="0"
                              onChange={event => updateReasonQty(index, event.target.value)}
                              style={{ width: '54px', background: 'transparent', border: 0, color: 'var(--text-color, #fff)', textAlign: 'center', fontSize: '1rem', fontWeight: 950, outline: 'none' }} 
                            />
                            <button 
                              onClick={() => updateReasonQty(index, Number(allocation.qty) + 1)} 
                              disabled={totalReasonAllocated >= totalDistributed}
                              style={{ width: '32px', height: '32px', background: 'var(--card-bg, #151515)', border: '1px solid var(--border-color, #292929)', color: 'var(--text-color, #fff)', borderRadius: '8px', cursor: 'pointer' }}
                            >+</button>
                          </div>
                          <button 
                            onClick={() => setReasonAllocations(items => items.length === 1 ? [{ reason: '', qty: 0 }] : items.filter((_, itemIndex) => itemIndex !== index))}
                            title="Прибрати причину" 
                            style={{ width: '32px', height: '32px', background: '#ef444412', border: '1px solid #ef444433', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 900 }}
                          >×</button>
                        </div>
                        {Number(allocation.qty) > 0 && !allocation.reason && (
                          <div style={{ color: '#ef4444', fontSize: '0.62rem', fontWeight: 900, marginTop: '8px' }}>Оберіть причину для цієї кількості</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setReasonAllocations(items => [...items, { reason: '', qty: 0 }])}
                    disabled={totalReasonAllocated >= totalDistributed || reasonAllocations.length >= activeScrapReasons.length}
                    style={{ width: '100%', marginTop: '11px', background: '#f59e0b12', color: '#f59e0b', border: '1px dashed #f59e0b55', borderRadius: '11px', padding: '11px', fontSize: '0.7rem', fontWeight: 950, cursor: 'pointer', opacity: totalReasonAllocated >= totalDistributed ? 0.35 : 1 }}
                  >
                    + ДОДАТИ ЩЕ ОДНУ ПРИЧИНУ
                  </button>
                  <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--card-inner-bg, #000)', border: `1px solid ${totalReasonAllocated === totalDistributed && totalDistributed > 0 ? '#10b98144' : 'var(--border-color, #292929)'}`, borderRadius: '11px', fontSize: '0.7rem', fontWeight: 900 }}>
                    <span style={{ color: 'var(--text-muted, #555)' }}>ЗА ПРИЧИНАМИ: <b style={{ color: totalReasonAllocated === totalDistributed && totalDistributed > 0 ? '#10b981' : 'var(--text-color, #fff)' }}>{totalReasonAllocated}</b></span>
                    <span style={{ color: 'var(--text-muted, #555)' }}>ЗАЛИШИЛОСЬ: <b style={{ color: totalReasonAllocated === totalDistributed ? '#10b981' : '#f59e0b' }}>{Math.max(0, totalDistributed - totalReasonAllocated)}</b></span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                disabled={isProcessing || remainingInBatch < 0 || !isReasonDistributionValid}
                onClick={handleBulkClassify}
                style={{ flex: 2, background: '#8b5cf6', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: 1000, cursor: isReasonDistributionValid ? 'pointer' : 'not-allowed', opacity: (remainingInBatch < 0 || !isReasonDistributionValid) ? 0.3 : 1 }}
              >
                {isProcessing ? 'ОБРОБКА...' : 'ПІДТВЕРДИТИ РОЗПОДІЛ'}
              </button>
              <button 
                onClick={() => setSelectedItem(null)}
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-color, #222)', color: 'var(--text-muted, #444)', padding: '15px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer' }}
              >
                СКАСУВАТИ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
