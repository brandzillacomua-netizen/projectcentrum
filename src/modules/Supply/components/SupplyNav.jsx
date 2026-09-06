import React from 'react'
import { Truck, ArrowLeft, Plus, CheckCircle, Package } from 'lucide-react'
import { Link } from 'react-router-dom'
import { resolveItemName, resolveItemQty } from '../utils/supplyHelpers'

export const SupplyNav = ({
  isProcurementOnly,
  currentUser,
  incomingReceptionCount,
  activeTab,
  setActiveTab,
  showCreate,
  setShowCreate,
  setTargetWarehouse,
  setPocketOwner,
  showReception,
  setShowReception,
  receptionDocs,
  processingDocs,
  setReceptionDocToAccept,
  supabase,
  refreshTable,
  pendingRequestsCount = 0
}) => {
  return (
    <>
      <nav style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        background: '#111',
        padding: '15px 30px',
        borderBottom: '1px solid #222'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#666', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#ff9000', color: '#000', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center' }}>
              <Truck size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
                {isProcurementOnly ? 'ВІДДІЛ ПОСТАЧАННЯ' : 'СКЛАД ВИРОБНИЦТВА (СВ)'}
              </h1>
              <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {isProcurementOnly ? 'Закупівлі та розподіл матеріалів' : 'Управління запасами та вишуки'}
              </span>
            </div>
          </div>
          {!isProcurementOnly && (
            <button
              type="button"
              onClick={() => setShowReception(prev => !prev)}
              style={{
                background: showReception ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                color: incomingReceptionCount > 0 ? '#0ea5e9' : '#888',
                padding: '6px 14px',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'relative'
              }}
            >
              <Truck size={16} /> <span>ПРИЙОМКА</span>
              {incomingReceptionCount > 0 && (
                <span className="badge-count anim-pulse" style={{ background: '#0ea5e9', color: '#000', borderRadius: '50%', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 900 }}>
                  {incomingReceptionCount}
                </span>
              )}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="hide-mobile" style={{ color: '#555', fontSize: '0.75rem', fontWeight: 600 }}>
            {currentUser?.first_name} {currentUser?.last_name}
          </div>
          {!showCreate && (
            <button
              onClick={() => {
                setTargetWarehouse('')
                setPocketOwner('')
                setShowCreate(true)
              }}
              className="hide-mobile"
              style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}
            >
              <Plus size={20} /> НОВА ПОСТАВКА
            </button>
          )}
        </div>
      </nav>

      <div style={{ padding: '25px 25px 0 25px' }}>
        {/* RECEPTION ALERT BANNER */}
        {!isProcurementOnly && incomingReceptionCount > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(2, 132, 199, 0.05))',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            borderRadius: '20px',
            padding: '15px 25px',
            marginBottom: '25px',
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(14, 165, 233, 0.15)',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: '#0ea5e9', padding: '12px', borderRadius: '14px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  У ВАС Є НОВІ ПОСТАВКИ ДЛЯ ПРИЙОМКИ НА СВ!
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#888' }}>
                  Очікує підтвердження: <strong style={{ color: '#0ea5e9' }}>{incomingReceptionCount}</strong> документ(ів)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReception(true)}
              style={{
                background: '#0ea5e9',
                color: '#000',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '0.8rem',
                cursor: 'pointer',
                textTransform: 'uppercase',
                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)',
                transition: '0.2s',
                letterSpacing: '0.05em'
              }}
            >
              Відкрити прийомку
            </button>
          </div>
        )}

        {/* RECEPTION DRAWER */}
        {!isProcurementOnly && showReception && (
          <div className="content-card glass-panel" style={{ background: '#111', border: '1px solid #333', borderRadius: '24px', padding: '25px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#3b82f6', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Truck size={18} /> ОЧІКУЮТЬ ПРИЙОМКИ НА СВ
            </h3>
            <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
              {(receptionDocs || [])
                .filter(d => (d.status === 'shipped' || d.status === 'ordered') && (!d.target_warehouse || d.target_warehouse === 'production'))
                .map(doc => (
                  <div key={doc.id} style={{ minWidth: '350px', background: '#0a0a0a', border: '1px solid #222', padding: '20px', borderRadius: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#555' }}>Документ #{doc.id.slice(0, 8)}</span>
                      <button 
                        disabled={processingDocs.has(doc.id)}
                        onClick={() => setReceptionDocToAccept(doc)}
                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, opacity: processingDocs.has(doc.id) ? 0.5 : 1, cursor: processingDocs.has(doc.id) ? 'not-allowed' : 'pointer' }}
                      >
                        {processingDocs.has(doc.id) ? 'ОБРОБКА...' : 'ПРИЙНЯТИ НА СКЛАД'}
                      </button>
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      {(doc.items || []).map((it, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                          <span style={{ color: '#aaa' }}>{resolveItemName(it, i)}</span>
                          <strong style={{ color: '#10b981' }}>{resolveItemQty(it)}</strong>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid #111', paddingTop: '10px' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm('Перенаправити прийомку на Склад Операційний (СО)?')) {
                            const { error } = await supabase.from('reception_docs').update({ target_warehouse: 'operational' }).eq('id', doc.id)
                            if (!error && typeof refreshTable === 'function') refreshTable('reception_docs')
                          }
                        }}
                        style={{ background: 'rgba(255, 144, 0, 0.05)', border: '1px solid rgba(255, 144, 0, 0.3)', color: '#ff9000', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Перенаправити на СО
                      </button>
                    </div>
                  </div>
                ))}
              {(receptionDocs || []).filter(d => (d.status === 'shipped' || d.status === 'ordered') && (!d.target_warehouse || d.target_warehouse === 'production')).length === 0 && (
                <p style={{ color: '#444', fontSize: '0.8rem', padding: '20px' }}>Немає активних документів на прийомку для цього складу</p>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="supply-tabs" style={{ display: 'flex', background: '#111', padding: '5px', borderRadius: '14px', marginBottom: '25px', maxWidth: '700px', flexWrap: 'wrap', gap: '2px' }}>
          <button onClick={() => { setActiveTab('requests'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'requests' && !showCreate ? 'active' : ''}`}>ЗАПИТИ ({pendingRequestsCount})</button>
          <button onClick={() => { setActiveTab('registry'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'registry' && !showCreate ? 'active' : ''}`}>РЕЄСТР</button>
          {!isProcurementOnly && <button onClick={() => { setActiveTab('stock'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'stock' && !showCreate ? 'active' : ''}`}>ЗАЛИШКИ</button>}
          {isProcurementOnly && <button onClick={() => { setActiveTab('qrcodes'); setShowCreate(false) }} className={`tab-btn-m ${activeTab === 'qrcodes' && !showCreate ? 'active' : ''}`}>QR-КОДИ</button>}
          <button onClick={() => { setShowCreate(true); setActiveTab('create'); setTargetWarehouse(''); setPocketOwner('') }} className={`tab-btn-m ${showCreate ? 'active' : ''}`}>+ НОВИЙ</button>
        </div>
      </div>
    </>
  )
}
