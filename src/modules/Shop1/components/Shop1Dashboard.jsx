import React from 'react'
import { ChevronRight, ClipboardList, Search, RefreshCw, QrCode } from 'lucide-react'
import { Shop1ActiveCardsTable } from './Shop1ActiveCardsTable'

export function Shop1Dashboard({
  manualId,
  setManualId,
  isProcessing,
  setIsScanning,
  handleManualEntry,
  setDetailStage,
  setDetailTab,
  stageStats,
  workCards,
  getNom,
  setShowStorageExplorer,
  tasks,
  orders,
  nomenclatures,
  activeTableFilter,
  setActiveTableFilter,
  isSyncing,
  setSelectedCardId,
  setSelectedOperator,
  collapsedGroups,
  setCollapsedGroups,
  getCardStartDate,
  getCardTimeMetrics
}) {
  return (
    <div style={{ width: '100%', padding: '0 12px 140px', boxSizing: 'border-box' }}>
      <style>{`
        .floating-controls-container {
          position: fixed; bottom: 30px; right: 30px; display: flex; align-items: center; gap: 12px; z-index: 1000; transition: all 0.3s ease;
        }
        @media (max-width: 600px) {
          .floating-controls-container {
            bottom: 0; left: 0; right: 0; width: 100%; background: rgba(10, 10, 12, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 14px 20px; justify-content: space-between;
            border-radius: 0; box-shadow: 0 -10px 35px rgba(0,0,0,0.9); backdrop-filter: blur(15px);
          }
          .floating-controls-container form {
            flex: 1; box-shadow: none !important; background: #000 !important; border: 1px solid #222 !important;
          }
        }
      `}</style>

      {/* Floating Controls */}
      <div className="floating-controls-container">
        <form onSubmit={handleManualEntry} style={{
          display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(10, 10, 10, 0.95)',
          border: '1px solid #222', padding: '10px 14px', borderRadius: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)'
        }}>
          <Search size={16} color="#6b7280" />
          <input
            type="text"
            placeholder="Введіть системний номер..."
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            disabled={isProcessing}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
          />
          <button type="submit" disabled={isProcessing} className="floating-search-btn" style={{ background: '#eab308', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        <button onClick={() => setIsScanning(true)}
          className="hover-lift floating-qr-btn"
          style={{
            background: '#eab308', border: 'none', color: '#000', width: '64px', height: '64px',
            borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center',
            cursor: 'pointer', boxShadow: '0 10px 30px rgba(234,179,8,0.4)', transition: 'all 0.2s', flexShrink: 0
          }}>
          <QrCode size={32} />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950, letterSpacing: '-0.02em' }}>ЦЕХ №1</h2>
            <span className="pillar-badge-mes" style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
              MES Shop Floor Pillar
            </span>
          </div>
          <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Розкрій → Буфер → Галтовка → Буфер → Прийомка
          </p>
        </div>
      </div>

      {/* Ланцюжок з буферами + сток Прийомки */}
      <div className="stages-grid-responsive" style={{
        display: 'grid', gap: '12px', marginBottom: '36px', alignItems: 'stretch'
      }}>
        {['Розкрій', 'Галтовка'].map((stage, idx) => {
          const st = stageStats(stage)
          const isCut = idx === 0
          const stageColor = isCut ? '#3b82f6' : '#f59e0b'
          const cardClass = isCut ? 's1-stage-card-cut' : 's1-stage-card-galt'
          return (
            <React.Fragment key={stage}>
              <div onClick={() => { setDetailStage(stage); setDetailTab('work') }}
                style={{
                  background: isCut ? 'linear-gradient(145deg, #0b1526 0%, #050a14 100%)' : 'linear-gradient(145deg, #1f1404 0%, #0d0802 100%)',
                  border: `1px solid ${isCut ? '#1e3a8a50' : '#78350f50'}`,
                  borderTop: `4px solid ${stageColor}`,
                  borderRadius: '20px', padding: '20px 16px', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  gridArea: `stage${idx + 1}`
                }}
                className={`s1-stage-card ${cardClass} s1-stage-hover`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span className="stage-card-title" style={{ fontSize: '0.65rem', fontWeight: 1000, color: stageColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{stage}</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.inWork > 0 ? '#10b981' : '#222', boxShadow: st.inWork > 0 ? '0 0 8px #10b981' : 'none' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                  {[
                    { label: 'РОБОТА', val: st.inWork, color: '#3b82f6' },
                    { label: 'БУФЕР', val: st.inBuffer, color: '#f59e0b' },
                  ].map(({ label, val, color }, li) => (
                    <div key={label} style={li > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '8px' } : {}}>
                      <div className="metric-label" style={{ fontSize: '0.55rem', color: '#6b7280', fontWeight: 1000, marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
                      <div style={{
                        fontSize: '1.4rem', fontWeight: 1000, letterSpacing: '-0.02em',
                        color: val > 0 ? color : '#475569'
                      }}>
                        {val}<small style={{ fontSize: '0.45rem', opacity: 0.4, marginLeft: '1px' }}>шт</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className={`hide-mobile`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '0 6px', gridArea: `arrow${idx + 1}`
                }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '2px', background: st.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#334155' }} />
                  <ChevronRight size={14} color={st.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#334155'} />
                </div>
                <div style={{
                  marginTop: '5px', fontSize: '0.46rem', fontWeight: 900, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px',
                  background: st.inBuffer > 0 ? `${idx === 0 ? '#f59e0b20' : '#10b98120'}` : 'rgba(255,255,255,0.05)', color: st.inBuffer > 0 ? (idx === 0 ? '#f59e0b' : '#10b981') : '#64748b'
                }}>
                  {st.inBuffer > 0 ? `${st.inBuffer} шт` : (idx === 0 ? 'БУФЕР' : 'СКЛАД')}
                </div>
              </div>
            </React.Fragment>
          )
        })}

        {/* ПРИЙОМКА / СКЛАД */}
        {(() => {
          const sortingCards = (workCards || []).filter(c => {
            const nom = getNom(c)
            if (nom && nom.type && nom.type !== 'part') return false
            return (c.operation === 'Прийомка' || c.operation === 'Сортування') &&
                   (c.status === 'at-buffer' || c.status === 'in-progress')
          })
          const sortingQty = sortingCards.reduce((a, c) => a + (Number(c.quantity) || 0), 0)
          const receptionCards = sortingCards.filter(c => c.operation === 'Прийомка')
          const realSortingCards = sortingCards.filter(c => c.operation === 'Сортування')
          const receptionQty = receptionCards.reduce((a, c) => a + (Number(c.quantity) || 0), 0)
          const realSortingQty = realSortingCards.reduce((a, c) => a + (Number(c.quantity) || 0), 0)
          const isActive = sortingQty > 0
          const cardColor = '#10b981'

          return (
            <div onClick={() => setShowStorageExplorer(true)}
              style={{
                background: 'linear-gradient(145deg, #0d1a15 0%, #050a08 100%)',
                border: '1px solid #10b98130', borderTop: '4px solid #10b981',
                borderRadius: '20px', padding: '20px 16px', cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)', transition: 'all 0.2s ease', gridArea: 'storage'
              }}
              className="s1-stage-card-storage s1-stage-hover">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <span className="stage-card-title" style={{ fontSize: '0.65rem', fontWeight: 1000, color: cardColor, textTransform: 'uppercase', letterSpacing: '0.12em' }}>ХАБ-СКЛАД ЦЕХУ 1</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isActive && (
                    <div style={{
                      background: cardColor, color: '#000', padding: '2.5px 8px', borderRadius: '6px',
                      fontSize: '0.52rem', fontWeight: 950, letterSpacing: '0.5px'
                    }}>
                      АКТИВНО
                    </div>
                  )}
                  <ClipboardList size={14} color={cardColor} style={{ opacity: 0.5 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px' }}>
                {[
                  { label: 'ПРИЙОМКА', val: receptionQty, color: '#3b82f6' },
                  { label: 'СОРТУВАННЯ', val: realSortingQty, color: '#8b5cf6' },
                ].map(({ label, val, color }, i) => (
                  <div key={label} style={i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '6px' } : {}}>
                    <div className="metric-label" style={{ fontSize: '0.45rem', color: '#6b7280', fontWeight: 1000, marginBottom: '2px', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 1000, letterSpacing: '-0.02em', color: val > 0 ? color : '#475569' }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Таблиця активних карток */}
      <Shop1ActiveCardsTable
        workCards={workCards}
        tasks={tasks}
        orders={orders}
        nomenclatures={nomenclatures}
        getNom={getNom}
        manualId={manualId}
        activeTableFilter={activeTableFilter}
        setActiveTableFilter={setActiveTableFilter}
        isSyncing={isSyncing}
        setSelectedCardId={setSelectedCardId}
        setSelectedOperator={setSelectedOperator}
        collapsedGroups={collapsedGroups}
        setCollapsedGroups={setCollapsedGroups}
        getCardStartDate={getCardStartDate}
        getCardTimeMetrics={getCardTimeMetrics}
      />
    </div>
  )
}
