import React from 'react'
import { Camera, Layers, RefreshCw, Eye } from 'lucide-react'

export const OperatorProductionOverview = ({
  setIsScanning,
  productionStages,
  workCards,
  workCardHistory,
  setDetailStage,
  isSyncing,
  setSelectedCardId,
  getNomFromCard,
  machines,
  currentTime
}) => {
  const matchesStage = (cardOp, stageName) => {
    const op = (cardOp || '').toLowerCase()
    const sk = (stageName || '').toLowerCase()
    return op === sk || op.includes(sk) || sk.includes(op)
  }

  const formatMachine = (name) => {
    if (!name) return '—'
    const match = name.match(/№\s*(\S+)/)
    return match ? `№${match[1]}` : name
  }

  const formatElapsedTime = (startIso) => {
    if (!startIso) return '00:00:00'
    const start = new Date(startIso)
    const diff = Math.floor((currentTime - start) / 1000)
    if (isNaN(diff) || diff < 0) return '00:00:00'
    const h = Math.floor(diff / 3600).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
    const s = (diff % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const formatPlanned = (mins) => {
    if (!mins || mins <= 0) return '—'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    if (h > 0) return `${h}год ${m}хв`
    return `${m}хв`
  }

  const getPlannedTime = (card) => {
    if (!card) return 0
    if (card.estimated_time) return Number(card.estimated_time)
    if (card.estimated_seconds) return Number(card.estimated_seconds) / 60
    const nom = getNomFromCard(card)
    if (nom?.time_per_unit) return (Number(nom.time_per_unit) * Number(card.quantity))
    return 0
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950 }}>ЛАНЦЮЖОК ВИРОБНИЦТВА</h2>
        <button onClick={() => setIsScanning(true)} style={{ background: '#eab308', border: 'none', color: '#000', padding: '15px 30px', borderRadius: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <Camera size={20} /> ВІДКРИТИ СКАНЕР
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '50px' }}>
        {productionStages.map(stage => {
          const stageCards = workCards.filter(c => matchesStage(c.operation, stage))
          const workQty = stageCards.filter(c => c.status === 'in-progress').reduce((acc, c) => acc + (c.quantity || 0), 0)
          const bufferQty = stageCards.filter(c => ['at-buffer', 'waiting-buffer'].includes(c.status)).reduce((acc, c) => acc + (c.quantity || 0), 0)
          const scrapQty = workCardHistory.filter(h => matchesStage(h.stage_name, stage)).reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
          return (
            <div key={stage} onClick={() => setDetailStage(stage)} className="stage-card-hover" style={{ background: '#111', border: '1px solid #222', borderRadius: '24px', padding: '20px', cursor: 'pointer', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <span style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>{stage}</span>
                <Layers size={14} color="#333" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 800, whiteSpace: 'nowrap' }}>У РОБОТІ</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 950, whiteSpace: 'nowrap', letterSpacing: '-0.02em', color: workQty > 0 ? '#fff' : '#222' }}>{workQty} <small style={{ fontSize: '0.55rem', opacity: 0.3 }}>шт</small></div>
                </div>
                <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800, whiteSpace: 'nowrap' }}>БУФЕР</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 950, whiteSpace: 'nowrap', letterSpacing: '-0.02em', color: bufferQty > 0 ? '#10b981' : '#222' }}>{bufferQty} <small style={{ fontSize: '0.55rem', opacity: 0.3 }}>шт</small></div>
                </div>
                <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 800, whiteSpace: 'nowrap' }}>БРАК</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 950, whiteSpace: 'nowrap', letterSpacing: '-0.02em', color: scrapQty > 0 ? '#ef4444' : '#222' }}>{scrapQty} <small style={{ fontSize: '0.55rem', opacity: 0.3 }}>шт</small></div>
                </div>
              </div>
              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <span style={{ fontSize: '0.55rem', color: '#333', fontWeight: 900 }}>ВСЬОГО: {stageCards.length}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflowX: 'auto' }}>
        <div style={{ padding: '25px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>В РОБОТІ ТА БУФЕРІ</h3>
          {isSyncing && <div style={{ fontSize: '0.7rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}><RefreshCw className="animate-spin" size={12} /> ОНОВЛЕННЯ...</div>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
          <thead style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '12px 15px' }}>ДЕТАЛЬ</th>
              <th style={{ padding: '12px 15px' }}>ЕТАП</th>
              <th style={{ padding: '12px 15px' }}>К-СТЬ</th>
              <th style={{ padding: '12px 15px' }}>МАЙСТЕР</th>
              <th style={{ padding: '12px 15px' }}>ЗМІНА</th>
              <th style={{ padding: '12px 15px' }}>ОПЕРАТОР</th>
              <th style={{ padding: '12px 15px' }}>ВЕРСТАТ</th>
              <th style={{ padding: '12px 15px' }}>ПЛАН. ЧАС</th>
              <th style={{ padding: '12px 15px' }}>ЧАС</th>
              <th style={{ padding: '12px 15px' }}></th>
            </tr>
          </thead>
          <tbody>
            {workCards.filter(c => c.status === 'in-progress' || c.status === 'at-buffer').map(card => (
              <tr key={card.id} 
                onClick={() => setSelectedCardId(card.id)}
                style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem', cursor: 'pointer' }}>
                <td style={{ padding: '12px 15px', fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{getNomFromCard(card)?.name}</td>
                <td style={{ padding: '12px 15px' }}><span style={{ color: card.status === 'at-buffer' ? '#10b981' : '#8b5cf6', fontWeight: 900, fontSize: '0.7rem' }}>{card.status === 'at-buffer' ? 'БУФЕР' : card.operation?.toUpperCase()}</span></td>
                <td style={{ padding: '12px 15px', fontWeight: 900 }}>{card.quantity} шт</td>
                <td style={{ padding: '12px 15px', color: '#888' }}>{card.manager_name || '—'}</td>
                <td style={{ padding: '12px 15px', color: '#888' }}>{card.shift_name || '—'}</td>
                <td style={{ padding: '12px 15px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                <td style={{ padding: '12px 15px', color: '#eab308', fontWeight: 800 }}>{formatMachine(machines.find(m => String(m.id) === String(card.machine_id))?.name || card.machine)}</td>
                <td style={{ padding: '12px 15px', color: '#3b82f6', fontWeight: 700 }}>{formatPlanned(getPlannedTime(card))}</td>
                <td style={{ padding: '12px 15px', color: '#10b981' }}>{formatElapsedTime(card.started_at)}</td>
                <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id) }}
                    style={{ background: '#eab308', border: 'none', color: '#000', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Відкрити">
                    <Eye size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
