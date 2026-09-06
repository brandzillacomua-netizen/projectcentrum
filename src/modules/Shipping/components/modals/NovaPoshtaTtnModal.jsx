import React from 'react'
import { Truck, X, CheckCircle2, Printer, FileText, Plus, Trash2 } from 'lucide-react'
import { saveNpApiKey } from '../../../../services/novaPoshtaService'

export const NovaPoshtaTtnModal = React.memo(({
  isNpModalOpen,
  setIsNpModalOpen,
  npError,
  npKeyInput,
  setNpKeyInput,
  handleOpenNpModal,
  npSuccessData,
  npSenderDetails,
  npRecipientName,
  setNpRecipientName,
  npRecipientPhone,
  setNpRecipientPhone,
  npCitySearch,
  handleCitySearch,
  npCityList = [],
  npSelectedCity,
  handleSelectCity,
  npSelectedWarehouse,
  setNpSelectedWarehouse,
  npWarehouseList = [],
  npCost,
  setNpCost,
  npSeatsList = [],
  totalSeatsWeight,
  handleAddSeat,
  handleRemoveSeat,
  handleUpdateSeat,
  npDescription,
  setNpDescription,
  npPayerType,
  setNpPayerType,
  handleGenerateNpTTNSubmit,
  npLoading
}) => {
  if (!isNpModalOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="shipping-modal-card" style={{ background: '#0e0e11', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '24px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', color: '#fff' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={22} color="#ff9000" />
            <div>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem', color: '#fff' }}>
                Генерація ТТН Нова Пошта
              </h3>
              <span style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 800 }}>API v2.0 Експрес-накладна</span>
            </div>
          </div>
          <button onClick={() => setIsNpModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {npError && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '14px 16px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>❌ {npError}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="password"
                value={npKeyInput}
                onChange={e => setNpKeyInput(e.target.value)}
                placeholder="Введіть API Ключ Нової Пошти..."
                style={{ flex: 1, minWidth: '220px', background: 'var(--card-inner-bg, #141414)', border: '1px solid #ff9000', borderRadius: '10px', padding: '8px 12px', color: 'var(--text, #fff)', fontSize: '0.82rem', fontWeight: 700 }}
              />
              <button
                type="button"
                onClick={() => {
                  if (npKeyInput.trim()) {
                    saveNpApiKey(npKeyInput.trim())
                    handleOpenNpModal()
                  }
                }}
                style={{ background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '0.82rem', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                💾 Зберегти та завантажити
              </button>
            </div>
          </div>
        )}

        {npSuccessData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '20px 0', textAlign: 'center' }}>
            <CheckCircle2 size={54} color="#10b981" />
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>ТТН УСПІШНО ЗГЕНЕРОВАНО!</h4>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ff9000', fontFamily: 'monospace', letterSpacing: '1px' }}>
                {npSuccessData.ttnNumber}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <a 
                href={npSuccessData.printStickerUrl} 
                target="_blank" 
                rel="noreferrer"
                style={{ background: 'linear-gradient(135deg, #ff9000, #ea580c)', color: '#fff', padding: '12px 20px', borderRadius: '12px', fontWeight: 900, textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Printer size={16} /> ДРУК СТІКЕРА (100x100)
              </a>
              <a 
                href={npSuccessData.printDocUrl} 
                target="_blank" 
                rel="noreferrer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '12px 20px', borderRadius: '12px', fontWeight: 800, textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FileText size={16} /> ДРУК ЕН (А4/А5)
              </a>
            </div>

            <button 
              onClick={() => setIsNpModalOpen(false)}
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#aaa', padding: '10px 24px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginTop: '10px' }}
            >
              ЗАКРИТИ ТА ЗБЕРЕГТИ У ВІДВАНТАЖЕННІ
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* 1. Відправник */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '14px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', marginBottom: '6px' }}>ВІДПРАВНИК (З ВАШОГО АКАУНТУ НП)</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                {npSenderDetails?.senderName || 'Завантаження профілю відправника...'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                Контакт: {npSenderDetails?.contactName} | Тел: {npSenderDetails?.contactPhone}
              </div>
            </div>

            {/* 2. Отримувач */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>ПІБ Отримувача</label>
                <input 
                  type="text"
                  value={npRecipientName}
                  onChange={e => setNpRecipientName(e.target.value)}
                  placeholder="напр. Ковальов Олександр Миколайович"
                  style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Телефон Отримувача</label>
                <input 
                  type="text"
                  value={npRecipientPhone}
                  onChange={e => setNpRecipientPhone(e.target.value)}
                  placeholder="0971234567"
                  style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* 3. Місто та Відділення */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Місто Доставки</label>
                <input 
                  type="text"
                  value={npCitySearch}
                  onChange={e => handleCitySearch(e.target.value)}
                  placeholder="Пошук міста..."
                  style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                />
                {npCityList.length > 0 && !npSelectedCity && (
                  <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', marginTop: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                    {npCityList.map(c => (
                      <div 
                        key={c.ref} 
                        onClick={() => handleSelectCity(c)}
                        style={{ padding: '8px 12px', fontSize: '0.78rem', color: '#eee', cursor: 'pointer', borderBottom: '1px solid #222' }}
                      >
                        {c.fullName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Відділення НП</label>
                <select
                  value={npSelectedWarehouse?.ref || ''}
                  onChange={e => {
                    const wh = npWarehouseList.find(w => w.ref === e.target.value)
                    if (wh) setNpSelectedWarehouse(wh)
                  }}
                  style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  {npWarehouseList.map(w => (
                    <option key={w.ref} value={w.ref}>
                      №{w.number} — {w.shortAddress}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Оголошена вартість */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary, #aaa)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Оголошена вартість (грн)</label>
              <input 
                type="number"
                value={npCost}
                onChange={e => setNpCost(e.target.value)}
                placeholder="1000"
                style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>

            {/* 4.5 МІСЦЯ ВАНТАЖУ ТА ГАБАРИТИ (Згідно стандартів НП v2.0) */}
            <div style={{ background: 'var(--card-inner-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    МІСЦЯ ВАНТАЖУ ТА ГАБАРИТИ ({npSeatsList.length} місц.)
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #888)', marginTop: '2px' }}>
                    Загальна вага вантажу: <strong style={{ color: '#ff9000' }}>{totalSeatsWeight} кг</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddSeat}
                  style={{
                    background: 'linear-gradient(135deg, #ff9000, #ea580c)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 10px rgba(255,144,0,0.3)'
                  }}
                >
                  <Plus size={14} /> ДОДАТИ МІСЦЕ (ЯЩИК)
                </button>
              </div>

              {npSeatsList.map((seat, index) => (
                <div
                  key={seat.id}
                  className="np-seat-card"
                  style={{
                    background: 'var(--card-bg, rgba(0,0,0,0.25))',
                    border: '1px solid var(--border, rgba(255,255,255,0.08))',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--text, #fff)' }}>
                      📦 Місце №{index + 1}
                    </span>
                    {npSeatsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSeat(seat.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                        title="Видалити місце"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Preset buttons for this seat */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleUpdateSeat(seat.id, { preset: '30x25x30', length: '30', width: '25', height: '30' })}
                      className={`np-preset-btn ${seat.preset === '30x25x30' ? 'active-preset' : ''}`}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: seat.preset === '30x25x30' ? '2px solid #ff9000' : '1px solid var(--border, #333)',
                        background: seat.preset === '30x25x30' ? 'rgba(255,144,0,0.18)' : 'var(--card-inner-bg, #181818)',
                        color: seat.preset === '30x25x30' ? '#ff9000' : 'var(--text, #eee)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      30 × 25 × 30 см (Компактний)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateSeat(seat.id, { preset: '45x30x40', length: '45', width: '30', height: '40' })}
                      className={`np-preset-btn ${seat.preset === '45x30x40' ? 'active-preset' : ''}`}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: seat.preset === '45x30x40' ? '2px solid #ff9000' : '1px solid var(--border, #333)',
                        background: seat.preset === '45x30x40' ? 'rgba(255,144,0,0.18)' : 'var(--card-inner-bg, #181818)',
                        color: seat.preset === '45x30x40' ? '#ff9000' : 'var(--text, #eee)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      45 × 30 × 40 см (Стандартний)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateSeat(seat.id, { preset: 'custom' })}
                      className={`np-preset-btn ${seat.preset === 'custom' ? 'active-preset' : ''}`}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: seat.preset === 'custom' ? '2px solid #ff9000' : '1px solid var(--border, #333)',
                        background: seat.preset === 'custom' ? 'rgba(255,144,0,0.18)' : 'var(--card-inner-bg, #181818)',
                        color: seat.preset === 'custom' ? '#ff9000' : 'var(--text, #eee)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Свої розміри
                    </button>
                  </div>

                  {/* Grid of L, W, H, Weight for this seat */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #888)', display: 'block', marginBottom: '2px' }}>Довжина (см)</label>
                      <input
                        type="number"
                        value={seat.length}
                        readOnly={seat.preset !== 'custom'}
                        onChange={e => handleUpdateSeat(seat.id, { length: e.target.value })}
                        style={{ width: '100%', background: seat.preset === 'custom' ? 'var(--card-inner-bg, #141414)' : 'var(--bg-muted, #222)', border: '1px solid var(--border, #333)', borderRadius: '8px', padding: '6px', color: 'var(--text, #fff)', fontSize: '0.8rem', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #888)', display: 'block', marginBottom: '2px' }}>Ширина (см)</label>
                      <input
                        type="number"
                        value={seat.width}
                        readOnly={seat.preset !== 'custom'}
                        onChange={e => handleUpdateSeat(seat.id, { width: e.target.value })}
                        style={{ width: '100%', background: seat.preset === 'custom' ? 'var(--card-inner-bg, #141414)' : 'var(--bg-muted, #222)', border: '1px solid var(--border, #333)', borderRadius: '8px', padding: '6px', color: 'var(--text, #fff)', fontSize: '0.8rem', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #888)', display: 'block', marginBottom: '2px' }}>Висота (см)</label>
                      <input
                        type="number"
                        value={seat.height}
                        readOnly={seat.preset !== 'custom'}
                        onChange={e => handleUpdateSeat(seat.id, { height: e.target.value })}
                        style={{ width: '100%', background: seat.preset === 'custom' ? 'var(--card-inner-bg, #141414)' : 'var(--bg-muted, #222)', border: '1px solid var(--border, #333)', borderRadius: '8px', padding: '6px', color: 'var(--text, #fff)', fontSize: '0.8rem', fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Вага місця (кг)</label>
                      <input
                        type="text"
                        value={seat.weight}
                        onChange={e => handleUpdateSeat(seat.id, { weight: e.target.value })}
                        placeholder="1.5"
                        style={{ width: '100%', background: 'var(--card-inner-bg, #141414)', border: '1px solid #ff9000', borderRadius: '8px', padding: '6px', color: 'var(--text, #fff)', fontSize: '0.8rem', fontWeight: 800 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 5. Опис вантажу та платник */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Опис вмісту</label>
                <input 
                  type="text"
                  value={npDescription}
                  onChange={e => setNpDescription(e.target.value)}
                  style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Платник доставки</label>
                <select
                  value={npPayerType}
                  onChange={e => setNpPayerType(e.target.value)}
                  style={{ width: '100%', background: '#141414', border: '1px solid #282828', borderRadius: '10px', padding: '10px', color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <option value="Recipient">Отримувач</option>
                  <option value="Sender">Відправник</option>
                </select>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleGenerateNpTTNSubmit}
              disabled={npLoading}
              style={{
                marginTop: '10px',
                width: '100%',
                background: npLoading ? '#555' : 'linear-gradient(135deg, #ff9000 0%, #ea580c 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '14px',
                fontSize: '0.95rem',
                fontWeight: 900,
                cursor: npLoading ? 'wait' : 'pointer',
                boxShadow: '0 4px 20px rgba(234, 88, 12, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <Truck size={20} />
              {npLoading ? 'З\'єднання з Nova Poshta API...' : 'ЗГЕНЕРУВАТИ ТТН У НОВІЙ ПОШТІ'}
            </button>

          </div>
        )}

      </div>
    </div>
  )
})

export default NovaPoshtaTtnModal
