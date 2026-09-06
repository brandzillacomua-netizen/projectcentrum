import React from 'react'
import { Truck, X, QrCode, Plus, Package, Send } from 'lucide-react'
import { getNomLabel } from '../utils/supplyHelpers'

export const SupplyCreateShipmentModal = ({
  showCreate,
  setShowCreate,
  isProcurementOnly,
  targetWarehouse,
  setTargetWarehouse,
  pocketOwner,
  setPocketOwner,
  managers = [],
  searchQuery,
  setSearchQuery,
  availableNoms = [],
  setIsScanning,
  selectedQty,
  setSelectedQty,
  addToDraft,
  draftItems,
  setDraftItems,
  isProcessing,
  handleSendToWarehouse
}) => {
  if (!showCreate) return null

  const sendDisabled = isProcessing || !targetWarehouse || (targetWarehouse === 'pocket' && !pocketOwner)
  const targetLabel = targetWarehouse === 'operational'
    ? 'СО'
    : (targetWarehouse === 'production' ? 'СВ' : 'КИШЕНЮ')

  return (
    <section style={{
      background: 'var(--modal-bg, #0d0d0d)',
      borderRadius: '24px',
      border: '1px solid var(--modal-border, #222)',
      padding: '30px',
      maxWidth: '650px',
      margin: '0 auto 30px auto',
      width: '100%',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px', alignItems: 'center', borderBottom: '1px solid var(--border-color, #222)', paddingBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-color, #fff)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={22} style={{ color: '#ff9000' }} />
            НОВА ПОСТАВКА
          </h2>
          <p style={{ color: 'var(--text-muted, #666)', fontSize: '0.8rem', margin: '6px 0 0' }}>
            {isProcurementOnly 
              ? 'Сформувати поставку на Склад Операційний (СО) або Склад Виробництва (СВ)' 
              : 'Передати матеріали зі складу виробництва до свідомо обраного пункту призначення'}
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(false); setDraftItems([]); setTargetWarehouse(''); setPocketOwner('') }}
          style={{ background: 'var(--btn-ghost-bg, #1c1c1c)', border: '1px solid var(--border-color, #2a2a2a)', color: 'var(--text-muted, #888)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Destination selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted, #555)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Пункт призначення</label>
          {!targetWarehouse && (
            <div style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 800, marginBottom: '8px' }}>
              Оберіть пункт призначення вручну
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {[
              { id: 'operational', label: 'СО', desc: 'Склад Операційний', color: '#10b981', icon: '🏭' },
              isProcurementOnly && { id: 'production', label: 'СВ', desc: 'Склад Виробництва', color: '#3b82f6', icon: '⚙️' },
              { id: 'pocket', label: 'Кишеня Майстра', desc: 'Кишеня Майстра', color: '#f59e0b', icon: '💼' }
            ].filter(Boolean).map(wh => {
              const active = targetWarehouse === wh.id
              return (
                <button
                  key={wh.id}
                  type="button"
                  onClick={() => {
                    setTargetWarehouse(wh.id)
                    if (wh.id !== 'pocket') setPocketOwner('')
                  }}
                  style={{
                    background: active ? `${wh.color}15` : 'var(--card-bg, #0a0a0a)',
                    border: active ? `2px solid ${wh.color}` : '1px solid var(--border-color, #222)',
                    color: active ? wh.color : 'var(--text-color, #fff)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>{wh.icon}</span>
                  <span style={{ fontWeight: 900, fontSize: '0.85rem' }}>{wh.label}</span>
                  <span style={{ fontSize: '0.62rem', color: active ? wh.color : 'var(--text-muted, #555)', opacity: 0.8 }}>{wh.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Master Selector for Pocket */}
        {targetWarehouse === 'pocket' && (
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '14px', padding: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#f59e0b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Оберіть майстра / відповідального</label>
            <select
              value={pocketOwner}
              onChange={e => setPocketOwner(e.target.value)}
              style={{ width: '100%', background: 'var(--card-bg, #000)', border: '1px solid var(--border-color, #333)', color: 'var(--text-color, #fff)', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', fontWeight: 700 }}
            >
              <option value="">-- Оберіть зі списку --</option>
              {managers.map(m => (
                <option key={m.id} value={`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.name || m.username}>
                  {m.first_name ? `${m.first_name} ${m.last_name || ''}` : (m.name || m.username)} ({m.role || m.position || 'Майстер'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Add items to draft panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted, #555)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Пошук товару</label>
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                style={{ background: 'transparent', border: 'none', color: '#ff9000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 900, padding: 0 }}
              >
                <QrCode size={12} /> СКАНУВАТИ QR
              </button>
            </div>
            <input
              list="noms-list"
              style={{ width: '100%', background: 'var(--card-bg, #0a0a0a)', border: '1px solid var(--border-color, #222)', color: 'var(--text-color, #fff)', padding: '12px 15px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              placeholder="Оберіть товар..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <datalist id="noms-list">
              {availableNoms.map(n => <option key={n.id} value={getNomLabel(n)} />)}
            </datalist>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted, #555)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Кількість</label>
            <input
              type="number"
              style={{ width: '100%', background: 'var(--card-bg, #0a0a0a)', border: '1px solid var(--border-color, #222)', color: 'var(--text-color, #fff)', padding: '12px 15px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
              placeholder="0"
              value={selectedQty}
              onChange={e => setSelectedQty(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" onClick={addToDraft} style={{ height: '42px', width: '50px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Draft list */}
        <div style={{ background: 'var(--card-bg, #070707)', borderRadius: '14px', border: '1px solid var(--border-color, #1a1a1a)', padding: '15px' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--text-muted, #444)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>СПИСОК ПОСТАВКИ ({draftItems.length})</div>
          {draftItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '25px 0', color: 'var(--text-muted, #333)' }}>
              <Package size={28} style={{ marginBottom: '8px', opacity: 0.1, display: 'inline-block' }} />
              <p style={{ fontSize: '0.75rem', margin: 0 }}>Немає доданих товарів</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {draftItems.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--card-inner-bg, #0d0d0d)', borderRadius: '8px', border: '1px solid var(--border-color, #222)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-color, #ddd)' }}>{it.name}</span>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={it.qty}
                      onChange={e => {
                        const val = e.target.value
                        const updated = [...draftItems]
                        updated[idx].qty = val
                        setDraftItems(updated)
                      }}
                      style={{ width: '85px', background: 'var(--card-bg, #000)', border: '1px solid var(--border-color, #333)', color: '#ff9000', textAlign: 'center', borderRadius: '8px', padding: '6px 10px', fontSize: '0.85rem', fontWeight: 900, outline: 'none' }}
                    />
                    <button onClick={() => setDraftItems(draftItems.filter((_, i) => i !== idx))} style={{ color: 'var(--text-muted, #555)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit button */}
        {draftItems.length > 0 && (
          <button
            disabled={sendDisabled}
            onClick={handleSendToWarehouse}
            style={{
              width: '100%',
              padding: '14px',
              background: sendDisabled
                ? '#222'
                : (targetWarehouse === 'production'
                    ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                    : (targetWarehouse === 'pocket'
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : 'linear-gradient(135deg, #10b981, #047857)')),
              color: sendDisabled ? '#666' : '#fff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 900,
              cursor: sendDisabled ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '5px',
              opacity: isProcessing ? 0.7 : 1,
              transition: '0.2s'
            }}>
            <Send size={16} />
            {isProcessing
              ? 'ОБРОБКА...'
              : (!targetWarehouse
                  ? 'ОБЕРІТЬ ПУНКТ ПРИЗНАЧЕННЯ'
                  : (targetWarehouse === 'pocket' && !pocketOwner
                      ? 'ОБЕРІТЬ МАЙСТРА'
                      : `ВІДПРАВИТИ НА ${targetLabel}`))}
          </button>
        )}
      </div>
    </section>
  )
}
