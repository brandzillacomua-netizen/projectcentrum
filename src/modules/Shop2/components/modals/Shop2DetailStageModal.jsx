import React from 'react'
import { X, Play, Package } from 'lucide-react'

export const Shop2DetailStageModal = ({
  detailStage,
  setDetailStage,
  detailTab,
  setDetailTab,
  workCards = [],
  isShop2Card = () => false,
  matchesStage = () => false,
  getNomFromCard = () => null,
  handoverToSGP,
  isProcessing,
  setIsProcessing
}) => {
  if (!detailStage) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px', backdropFilter: 'blur(5px)' }}>
      <div style={{ background: '#111', width: '100%', maxWidth: '750px', maxHeight: '85vh', borderRadius: '28px', border: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ padding: '20px 25px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, color: '#fff' }}>ЕТАП: {detailStage.toUpperCase()}</h3>
            <div style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 800, marginTop: '2px' }}>ДЕТАЛІЗАЦІЯ РОБІТ ТА БУФЕРІВ ЦЕХУ №2</div>
          </div>
          <button onClick={() => setDetailStage(null)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {/* Таби */}
        <div style={{ display: 'flex', borderBottom: '1px solid #222', background: '#141414' }}>
          <button onClick={() => setDetailTab('work')} style={{ flex: 1, padding: '15px', background: detailTab === 'work' ? '#1f1f1f' : 'transparent', border: 'none', borderBottom: detailTab === 'work' ? '2px solid #3b82f6' : 'none', color: detailTab === 'work' ? '#3b82f6' : '#666', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Play size={16} /> В РОБОТІ ({workCards.filter(c => isShop2Card(c) && matchesStage(c.operation, detailStage) && c.status === 'in-progress').length})
          </button>
          <button onClick={() => setDetailTab('buffer')} style={{ flex: 1, padding: '15px', background: detailTab === 'buffer' ? '#1f1f1f' : 'transparent', border: 'none', borderBottom: detailTab === 'buffer' ? '2px solid #10b981' : 'none', color: detailTab === 'buffer' ? '#10b981' : '#666', fontWeight: 900, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Package size={16} /> БУФЕР / ОЧІКУВАННЯ ({workCards.filter(c => isShop2Card(c) && matchesStage(c.operation, detailStage) && ['at-buffer', 'waiting-buffer'].includes(c.status)).length})
          </button>
        </div>

        {/* Вміст модалки */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {(() => {
            if (detailTab === 'buffer') {
              const bufferItems = workCards.filter(c => isShop2Card(c) && matchesStage(c.operation, detailStage) && ['at-buffer', 'waiting-buffer'].includes(c.status));
              if (bufferItems.length === 0) return <div style={{ textAlign: 'center', padding: '50px', color: '#444', fontSize: '0.85rem' }}>Буфер порожній</div>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {bufferItems.map(c => {
                    const nom = typeof getNomFromCard === 'function' ? getNomFromCard(c) : null;
                    return (
                      <div key={c.id} style={{ background: '#161616', border: '1px solid #222', borderRadius: '14px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff' }}>{nom?.name || 'Деталь'}</div>
                          <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '3px' }}>
                            Картка #{c.id.slice(-8).toUpperCase()} · <span style={{ color: '#10b981', fontWeight: 800 }}>{c.quantity} шт</span>
                            {c.operator_name ? ` · Оператор: ${c.operator_name}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            disabled={isProcessing}
                            onClick={async () => {
                              if (isProcessing) return
                              setIsProcessing(true)
                              try {
                                await handoverToSGP(c.id)
                              } finally {
                                setIsProcessing(false)
                              }
                            }}
                            style={{ background: isProcessing ? '#555' : '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1 }}
                          >
                            {isProcessing ? 'ПЕРЕДАЧА...' : 'ВІДПРАВИТИ НА СГП'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            } else {
              const agg = {};
              workCards.filter(c => isShop2Card(c) && matchesStage(c.operation, detailStage) && c.status === 'in-progress').forEach(c => {
                const nom = typeof getNomFromCard === 'function' ? getNomFromCard(c) : null;
                const name = nom?.name || 'Деталь';
                agg[name] = (agg[name] || 0) + (c.quantity || 0);
              });
              const items = Object.entries(agg);
              if (items.length === 0) return <div style={{ textAlign: 'center', padding: '50px', color: '#444', fontSize: '0.85rem' }}>Дані відсутні</div>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map(([name, qty], idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{name}</div>
                      <div style={{ fontWeight: 1000, fontSize: '1.3rem', color: '#8b5cf6' }}>{qty} <small style={{ fontSize: '0.6rem', opacity: 0.3 }}>шт</small></div>
                    </div>
                  ))}
                </div>
              );
            }
          })()}
        </div>
      </div>
    </div>
  )
}
