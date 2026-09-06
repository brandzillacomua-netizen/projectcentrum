import React from 'react'
import { Truck, X, Palette, Boxes, Square, CheckSquare, CheckCircle2 } from 'lucide-react'
import { CustomSelect } from '../CustomSelect'
import { PALLET_COLORS } from '../../utils/shippingHelpers'

export const ShippingWorkModal = React.memo(({
  workModal,
  onClose,
  closeWorkModal,
  customerDeliveryAddresses = [],
  matchingCustomer,
  selectedClientAddressId,
  setSelectedClientAddressId,
  shippingType,
  setShippingType,
  shippingDate,
  setShippingDate,
  ttnNumber,
  setTtnNumber,
  handleOpenNpModal,
  selectedWorkerId,
  setSelectedWorkerId,
  shippingWorkers = [],
  batchColor,
  setBatchColor,
  totalBoxes,
  checkedCount,
  loadingBoxes,
  boxes = [],
  checkedBoxes = {},
  setCheckedBoxes,
  handleFinishShipping,
  canFinish,
  isProcessing
}) => {
  if (!workModal) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
      <div className="shipping-modal-card" style={{ background: 'linear-gradient(160deg, #0f1923 0%, #0a0f18 100%)', border: '1px solid rgba(255,144,0,0.2)', borderRadius: '32px', width: '100%', maxWidth: '720px', marginTop: '20px', marginBottom: '20px', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 80px rgba(255,144,0,0.05)' }}>

        {/* Modal Header */}
        <div style={{ padding: '28px 32px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,144,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #ff9000, #ff5e00)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(255,144,0,0.4)' }}>
              <Truck size={24} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Взяти в роботу
              </div>
              <div style={{ fontSize: '0.75rem', color: '#ff9000', fontWeight: 700, marginTop: '2px' }}>
                #{workModal.batch.orderNum} · Партія {workModal.batch.batchIndex} · {workModal.batch.customer}
              </div>
            </div>
          </div>
          <button onClick={onClose || closeWorkModal} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#888', cursor: 'pointer', padding: '10px', display: 'flex', transition: '0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

          {/* ── АДРЕСИ ДОСТАВКИ КЛІЄНТА ── */}
          {customerDeliveryAddresses.length > 0 && (
            <div className="shipping-address-btn-container" style={{ background: 'rgba(255,144,0,0.05)', border: '1px solid rgba(255,144,0,0.2)', borderRadius: '20px', padding: '20px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={14} />
                  <span>Оберіть адресу доставки клієнта ({matchingCustomer?.name || workModal?.batch?.customer})</span>
                </div>
                {customerDeliveryAddresses.length > 1 && (
                  <span style={{ background: 'rgba(255,144,0,0.15)', color: '#ff9000', padding: '2px 8px', borderRadius: '6px', fontSize: '0.65rem' }}>
                    Знайдено адрес: {customerDeliveryAddresses.length}
                  </span>
                )}
              </div>

              {/* Кнопки вибору адрес */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {customerDeliveryAddresses.map(addr => {
                  const isSel = selectedClientAddressId === addr.id
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => {
                        setSelectedClientAddressId(addr.id)
                        setShippingType(addr.deliveryMethod === 'pickup' ? 'Самовивіз' : 'Доставка НП')
                      }}
                      className={`shipping-address-btn ${isSel ? 'active-address' : ''}`}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: isSel ? '2px solid #ff9000' : '1px solid var(--border, rgba(255,255,255,0.08))',
                        background: isSel ? 'rgba(255,144,0,0.18)' : 'var(--card-inner-bg, #111)',
                        color: isSel ? 'var(--text, #fff)' : 'var(--text-secondary, #aaa)',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        boxShadow: isSel ? '0 4px 15px rgba(255,144,0,0.25)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: isSel ? '#ff9000' : '#888' }}>
                          {addr.deliveryMethod === 'pickup' ? '🚗' : addr.deliveryMethod === 'np_postomat' ? '📮' : '📦'}
                        </span>
                        <span className="address-title">{addr.title || addr.city}</span>
                        {addr.isDefault && (
                          <span style={{ background: '#ff9000', color: '#000', padding: '1px 5px', borderRadius: '4px', fontSize: '0.58rem', fontWeight: 950 }}>
                            ★ Основна
                          </span>
                        )}
                      </div>
                      <div className="address-subtitle" style={{ fontSize: '0.7rem', color: isSel ? 'var(--text, #ddd)' : 'var(--text-secondary, #666)', fontWeight: 600 }}>
                        {addr.city}{addr.warehouse ? `, ${addr.warehouse}` : addr.address ? `, ${addr.address}` : ''}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Інформаційна картка обраної / єдиної адреси */}
              {(() => {
                const sel = customerDeliveryAddresses.find(a => a.id === selectedClientAddressId) || customerDeliveryAddresses[0]
                if (!sel) return null
                return (
                  <div className="shipping-address-summary" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '14px', padding: '14px', border: '1px solid rgba(255,144,0,0.15)', fontSize: '0.78rem', color: 'var(--text, #ccc)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div><strong style={{ color: 'var(--text-secondary, #888)' }}>Місто:</strong> {sel.city || '—'}</div>
                    <div><strong style={{ color: 'var(--text-secondary, #888)' }}>Спосіб:</strong> {sel.deliveryMethod === 'pickup' ? 'Самовивіз' : sel.deliveryMethod === 'np_postomat' ? 'Поштомат НП' : sel.deliveryMethod === 'np_courier' ? 'Адресна НП' : 'Відділення НП'}</div>
                    <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary, #888)' }}>Адреса / Відділення:</strong> <span style={{ color: '#ff9000', fontWeight: 800 }}>{sel.warehouse || sel.address || '—'}</span></div>
                    {sel.recipientName && <div><strong style={{ color: 'var(--text-secondary, #888)' }}>Отримувач:</strong> {sel.recipientName}</div>}
                    {sel.recipientPhone && <div><strong style={{ color: 'var(--text-secondary, #888)' }}>Тел. отримувача:</strong> {sel.recipientPhone}</div>}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── СЕКЦІЯ 1: ДЕТАЛІ ВІДВАНТАЖЕННЯ ── */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px' }}>
              Деталі відвантаження
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

              {/* Тип відвантаження */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Тип відвантаження</label>
                <CustomSelect
                  value={shippingType}
                  onChange={setShippingType}
                  options={[
                    { value: 'Самовивіз', label: 'Самовивіз', icon: '🚗' },
                    { value: 'Доставка НП', label: 'Доставка НП', icon: '📦' },
                  ]}
                  placeholder="— Обрати —"
                />
              </div>

              {/* Дата відвантаження */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Дата відвантаження</label>
                <input
                  type="date"
                  value={shippingDate}
                  onChange={e => setShippingDate(e.target.value)}
                  onClick={e => {
                    try {
                      e.target.showPicker();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  style={{ padding: '12px 14px', background: 'rgba(255,144,0,0.06)', border: `1.5px solid ${shippingDate ? 'rgba(255,144,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', color: shippingDate ? '#fff' : '#555', fontSize: '0.85rem', fontWeight: 700, outline: 'none', colorScheme: 'dark', cursor: 'pointer', width: '100%' }}
                />
              </div>

              {/* Номер ТТН */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Номер ТТН</label>
                  <button
                    type="button"
                    onClick={handleOpenNpModal}
                    style={{ background: 'linear-gradient(135deg, rgba(255,144,0,0.15), rgba(234,88,12,0.25))', border: '1px solid rgba(255,144,0,0.4)', borderRadius: '8px', color: '#ff9000', fontSize: '0.68rem', fontWeight: 900, padding: '3px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s' }}
                  >
                    ⚡ Згенерувати ТТН НП
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="20450000000000"
                  value={ttnNumber}
                  onChange={e => setTtnNumber(e.target.value)}
                  style={{ padding: '12px 14px', background: 'rgba(255,144,0,0.06)', border: `1.5px solid ${ttnNumber.trim() ? 'rgba(255,144,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
                />
              </div>

              {/* Відповідальний */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Відповідальний</label>
                <CustomSelect
                  value={selectedWorkerId}
                  onChange={setSelectedWorkerId}
                  options={shippingWorkers.map(u => ({
                    value: String(u.id),
                    label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.login,
                    icon: '👤'
                  }))}
                  placeholder="— Обрати —"
                />
              </div>
            </div>
          </div>

          {/* ── СЕКЦІЯ 2: КОЛІР ПАРТІЇ ── */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={14} />
              Колір маркування партії (палет)
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {PALLET_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setBatchColor(c.id)}
                  title={c.label}
                  style={{
                    width: '42px', height: '42px', borderRadius: '12px',
                    background: c.hex,
                    border: batchColor === c.id ? '3px solid #fff' : '3px solid transparent',
                    cursor: 'pointer',
                    boxShadow: batchColor === c.id ? `0 0 0 2px ${c.hex}88, 0 4px 12px ${c.hex}66` : 'none',
                    transform: batchColor === c.id ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  {batchColor === c.id && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={18} color={c.id === 'white' || c.id === 'yellow' ? '#333' : '#fff'} />
                    </div>
                  )}
                </button>
              ))}
            </div>
            {batchColor && (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888', fontWeight: 700 }}>
                Обрано: <span style={{ color: PALLET_COLORS.find(c => c.id === batchColor)?.hex }}>{PALLET_COLORS.find(c => c.id === batchColor)?.label}</span>
              </div>
            )}
          </div>

          {/* ── СЕКЦІЯ 3: ПЕРЕВІРКА КОРОБОК ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Boxes size={14} />
                Перевірка коробок
              </div>
              {totalBoxes > 0 && (
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: checkedCount === totalBoxes ? '#10b981' : '#888' }}>
                  {checkedCount} / {totalBoxes} перевірено
                </div>
              )}
            </div>

            {loadingBoxes ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#444', fontSize: '0.8rem' }}>
                Завантаження коробок…
              </div>
            ) : boxes.length === 0 ? (
              <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid #1a1a1a', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>
                ⚠️ Коробки не знайдені в базі. Переконайтесь що пакування було збережено.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '6px' }}>
                {boxes.map(box => {
                  const isChecked = checkedBoxes[box.box_number] === true
                  return (
                    <div
                      key={box.box_number}
                      onClick={() => setCheckedBoxes(prev => ({ ...prev, [box.box_number]: !prev[box.box_number] }))}
                      style={{
                        padding: '12px 14px',
                        background: isChecked ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isChecked ? 'rgba(16,185,129,0.25)' : '#1a1a1a'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                    >
                      <div style={{ marginTop: '2px', flexShrink: 0 }}>
                        {isChecked
                          ? <CheckSquare size={18} color="#10b981" />
                          : <Square size={18} color="#333" />
                        }
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ background: isChecked ? '#10b98120' : '#ff900015', color: isChecked ? '#10b981' : '#ff9000', fontSize: '0.7rem', fontWeight: 900, padding: '3px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
                            #{box.box_number}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700 }}>
                            {box.items.length} позицій
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {box.items.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: isChecked ? '#888' : '#555' }}>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nom_name}</span>
                              <span style={{ fontWeight: 800, marginLeft: '10px', flexShrink: 0 }}>{item.qty} {item.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Відмітити все */}
            {boxes.length > 0 && (
              <button
                onClick={() => {
                  const allChecked = boxes.every(b => checkedBoxes[b.box_number])
                  const newState = {}
                  boxes.forEach(b => { newState[b.box_number] = !allChecked })
                  setCheckedBoxes(newState)
                }}
                style={{ marginTop: '10px', background: 'transparent', border: '1px solid #222', borderRadius: '10px', color: '#555', fontSize: '0.75rem', fontWeight: 700, padding: '8px 16px', cursor: 'pointer', transition: '0.2s' }}
              >
                {boxes.every(b => checkedBoxes[b.box_number]) ? '✕ Зняти всі' : '✓ Відмітити всі'}
              </button>
            )}
          </div>

          {/* ── КНОПКА ЗАВЕРШИТИ ── */}
          <button
            onClick={handleFinishShipping}
            disabled={!canFinish || isProcessing}
            style={{
              padding: '17px',
              background: canFinish
                ? 'linear-gradient(135deg, #ff9000 0%, #ff5e00 100%)'
                : 'rgba(255,255,255,0.04)',
              border: 'none',
              borderRadius: '16px',
              color: canFinish ? '#fff' : '#333',
              fontSize: '0.9rem',
              fontWeight: 900,
              cursor: canFinish ? 'pointer' : 'not-allowed',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'all 0.3s',
              boxShadow: canFinish ? '0 8px 24px rgba(255,144,0,0.4)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
            onMouseEnter={e => { if (canFinish) e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          >
            {isProcessing ? (
              <span>Обробка…</span>
            ) : (
              <>
                <Truck size={20} />
                Завершити відвантаження та згенерувати пакувальний лист
              </>
            )}
          </button>

          {!canFinish && (
            <div style={{ fontSize: '0.72rem', color: '#555', textAlign: 'center', marginTop: '-16px' }}>
              {!shippingType && '• Оберіть тип відвантаження  '}
              {!shippingDate && '• Вкажіть дату  '}
              {!ttnNumber.trim() && '• Введіть номер ТТН  '}
              {!selectedWorkerId && '• Оберіть відповідального  '}
              {!batchColor && '• Оберіть колір партії  '}
              {boxes.length > 0 && !boxes.every(b => checkedBoxes[b.box_number]) && `• Перевірте всі коробки (${checkedCount}/${totalBoxes})`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default ShippingWorkModal
