import React from 'react'

export const BrakStatsDashboard = React.memo(({
  qualityStatusTotals,
  viewingCategory,
  setViewingCategory,
  setSelectedItem,
  navigate
}) => {
  const cards = [
    { cat: 'quarantine', label: 'Карантин', val: qualityStatusTotals.quarantine, color: '#f97316', desc: 'Нові деталі, що очікують рішення ВКЯ' },
    { cat: 'brak', label: 'Брак', val: qualityStatusTotals.recoverableScrap, color: '#a855f7', desc: 'Класифікований брак і деталі на доопрацювання' },
    { cat: 4, label: 'Утиль', val: qualityStatusTotals.finalScrap, color: '#ef4444', desc: 'Безнадійний брак для списання' },
    { cat: 'restoration', label: 'Відновлення', val: qualityStatusTotals.restoration, color: '#06b6d4', desc: 'Внутрішнє відновлення' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '40px' }}>
      {cards.map(s => (
        <div key={s.label} 
          onClick={() => {
            if (s.cat === 'restoration') {
              navigate('/brak/restoration')
              return
            }
            if (s.cat === 'quarantine') {
              setViewingCategory(null)
              setSelectedItem(null)
              return
            }
            setViewingCategory(s.cat === viewingCategory ? null : s.cat)
            setSelectedItem(null)
          }}
          className={`vkya-card vkya-card-${s.cat}`} 
          style={{ 
            background: viewingCategory === s.cat ? `${s.color}18` : 'var(--card-bg, rgba(20,20,20,0.6))', 
            borderRadius: '24px', padding: '24px', cursor: 'pointer',
            borderLeft: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '25'}`, 
            borderRight: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '25'}`, 
            borderBottom: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '25'}`, 
            borderTop: `4px solid ${s.color}`,
            transition: 'all 0.3s ease'
          }}>
          <div className="vkya-card-label" style={{ fontSize: '0.75rem', color: s.color, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{s.label}</div>
          <div className="vkya-card-val" style={{ fontSize: '2.4rem', fontWeight: 1000, color: s.color, lineHeight: 1 }}>{s.val} <small style={{ fontSize: '0.9rem', opacity: 0.6 }}>шт</small></div>
          <div className="vkya-card-desc" style={{ fontSize: '0.65rem', marginTop: '10px', fontWeight: 600, color: 'var(--text-muted, #777)' }}>{s.desc}</div>
          {viewingCategory === s.cat && <div style={{ marginTop: '15px', fontSize: '0.6rem', color: s.color, fontWeight: 900 }}>ВІДКРИТО ДЕТАЛЬНИЙ ПЕРЕГЛЯД ↓</div>}
        </div>
      ))}
    </div>
  )
})
