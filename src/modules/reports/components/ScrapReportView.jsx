import React from 'react'
import { RefreshCw } from 'lucide-react'

export const ScrapReportView = ({
  isSyncing,
  historyLoadError,
  inventory,
  scrapStats,
  scrapReportSubTab,
  setScrapReportSubTab,
  scrapReasonsStats
}) => {
  if (isSyncing) {
    return <div className="glass-panel" style={{ background: '#111', padding: '35px', borderRadius: '16px', border: '1px solid #222', color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}><RefreshCw size={20} className="spin" /> Завантажуємо брак за обраний період…</div>
  }
  if (historyLoadError) {
    return <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #7f1d1d', color: '#fca5a5' }}>Не вдалося завантажити звіт: {historyLoadError}</div>
  }

  const invScrapCat123 = (inventory || []).filter(i => ['scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3'].includes(i?.type)).reduce((s, i) => s + (Number(i?.total_qty) || 0), 0)
  const invScrapCat4 = (inventory || []).filter(i => i?.type === 'scrap_cat_4').reduce((s, i) => s + (Number(i?.total_qty) || 0), 0)
  const totalQuarantinePending = scrapStats.totalUnclassified + scrapStats.totalQuarantine
  const totalOverallScrap = Math.max(scrapStats.totalScrap, invScrapCat4 + invScrapCat123 + totalQuarantinePending)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      {/* TOP KPI DASHBOARD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Зафіксовано браку всього</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#ef4444', lineHeight: 1 }}>{totalOverallScrap} <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 600 }}>од.</span></div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>Сума (Утиль + Доопрацювання + Карантин)</div>
        </div>

        <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222', borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Брак на доопрацювання</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#eab308', lineHeight: 1 }}>{invScrapCat123 || scrapStats.totalCat123} <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 600 }}>од.</span></div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>Складський залишок доопрацювання</div>
        </div>

        <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Повний утиль</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#dc2626', lineHeight: 1 }}>{invScrapCat4 || scrapStats.totalCat4} <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 600 }}>од.</span></div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>Загальний утиль у базі даних</div>
        </div>

        <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222', borderLeft: '4px solid #f97316' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Не класифіковано / Карантин</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 950, color: '#f97316', lineHeight: 1 }}>{scrapStats.totalUnclassified + scrapStats.totalQuarantine} <span style={{ fontSize: '0.9rem', color: '#888', fontWeight: 600 }}>од.</span></div>
          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>Очікують рішення інспектора ВКЯ</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
            <h4 style={{ margin: '0 0 15px', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', fontWeight: 900 }}>Брак по етапах виникнення</h4>
            {Object.entries(scrapStats.byStage).map(([stage, count]) => (
              <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', padding: '10px', background: '#0a0a0a', borderRadius: '8px', border: '1px solid #1a1a1a' }}>
                <span style={{ color: '#ccc', fontSize: '0.85rem', fontWeight: 700 }}>{stage}</span>
                <strong style={{ color: '#ef4444', fontSize: '0.9rem' }}>{count} од.</strong>
              </div>
            ))}
            {Object.keys(scrapStats.byStage).length === 0 && (
              <div style={{ color: '#555', fontSize: '0.85rem' }}>Немає даних за обраний період</div>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ flex: 1, minWidth: '600px', background: '#111', padding: '20px', borderRadius: '16px', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #222', paddingBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase', fontWeight: 900 }}>
              {scrapReportSubTab === 'cases' ? '📋 Деталізація всіх випадків браку' : '🎯 Аналітика причин браку'}
            </h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setScrapReportSubTab('cases')}
                style={{
                  background: scrapReportSubTab === 'cases' ? '#ef4444' : 'transparent',
                  color: '#fff', border: scrapReportSubTab === 'cases' ? 'none' : '1px solid #333',
                  padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer'
                }}
              >
                Випадки
              </button>
              <button
                onClick={() => setScrapReportSubTab('reasons')}
                style={{
                  background: scrapReportSubTab === 'reasons' ? '#ef4444' : 'transparent',
                  color: '#fff', border: scrapReportSubTab === 'reasons' ? 'none' : '1px solid #333',
                  padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer'
                }}
              >
                Причини браку
              </button>
            </div>
          </div>

          {scrapReportSubTab === 'cases' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: '#888', textAlign: 'left', borderBottom: '2px solid #222', background: '#0a0a0a' }}>
                    <th style={{ padding: '12px 10px' }}>Дата</th>
                    <th style={{ padding: '12px 10px' }}>Деталь</th>
                    <th style={{ padding: '12px 10px' }}>Оператор</th>
                    <th style={{ padding: '12px 10px' }}>Етап</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', color: '#eab308' }}>Брак</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', color: '#f97316' }}>Карантин</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', color: '#ef4444' }}>Утиль</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', color: '#666' }}>Не класиф.</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right' }}>Всього</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapStats.list.map(h => {
                    const dateDisplay = h.completed_at || h.created_at ? new Date(h.completed_at || h.created_at).toLocaleDateString('uk-UA') : '—'
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '10px', color: '#888', whiteSpace: 'nowrap' }}>{dateDisplay}</td>
                        <td style={{ padding: '10px', color: '#fff', fontWeight: 700 }}>{h.nom_name}</td>
                        <td style={{ padding: '10px', color: '#aaa' }}>{h.operator_name || 'Не вказано'}</td>
                        <td style={{ padding: '10px', color: '#aaa' }}>{h.stage_name}</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: h.cat1 + h.cat2 > 0 ? '#eab308' : '#444', fontWeight: h.cat1 + h.cat2 > 0 ? '900' : '400' }}>{h.cat1 + h.cat2 || '—'}</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: h.cat3 > 0 ? '#f97316' : '#444', fontWeight: h.cat3 > 0 ? '900' : '400' }}>{h.cat3 || '—'}</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: h.cat4 > 0 ? '#ef4444' : '#444', fontWeight: h.cat4 > 0 ? '900' : '400' }}>{h.cat4 || '—'}</td>
                        <td style={{ padding: '10px', textAlign: 'center', color: h.unclassified > 0 ? '#888' : '#333', fontWeight: h.unclassified > 0 ? '700' : '400' }}>{h.unclassified || '—'}</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#ef4444', fontWeight: 900 }}>{h.scrap_qty}</td>
                      </tr>
                    )
                  })}
                  {scrapStats.list.length === 0 && (
                    <tr><td colSpan="9" style={{ padding: '25px', textAlign: 'center', color: '#555' }}>Брак відсутній за обраний період</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: '#888', textAlign: 'left', borderBottom: '2px solid #222', background: '#0a0a0a' }}>
                    <th style={{ padding: '12px 10px' }}>Причина браку</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Кількість деталей (шт)</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center' }}>Відсоток (%)</th>
                    <th style={{ padding: '12px 10px' }}>Найчастіша деталь</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right' }}>Найчастіший оператор</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapReasonsStats.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '12px 10px', color: '#fff', fontWeight: 700 }}>{item.name}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{item.quantity}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', color: '#888' }}>{item.percentage}%</td>
                      <td style={{ padding: '12px 10px', color: '#aaa' }}>{item.topItem}</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', color: '#aaa' }}>{item.topOperator}</td>
                    </tr>
                  ))}
                  {scrapReasonsStats.length === 0 && (
                    <tr><td colSpan="5" style={{ padding: '25px', textAlign: 'center', color: '#555' }}>Немає класифікованого браку за обраний період</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
