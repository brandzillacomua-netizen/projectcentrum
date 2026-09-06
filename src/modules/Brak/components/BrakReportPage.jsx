import React from 'react'
import { ArrowLeft, AlertTriangle, Search, Calendar } from 'lucide-react'

export const BrakReportPage = React.memo(({
  setShowReportPage,
  currentUser,
  reportSearchQuery,
  setReportSearchQuery,
  reportSelectedShiftFilter,
  setReportSelectedShiftFilter,
  reportSelectedEmployeeFilter,
  setReportSelectedEmployeeFilter,
  reportUniqueOperators = [],
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  reportQuickPeriod,
  handleReportQuickDateSelect,
  reportIsSyncing,
  reportLoadError,
  reportScrapStats,
  scrapReportSubTab,
  setScrapReportSubTab,
  reportScrapReasonsStats
}) => {
  return (
    <div className="brak-module-v2" style={{ background: 'var(--bg, #050505)', minHeight: '100vh', color: 'var(--text-color, #fff)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <nav style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '0 25px', height: '75px', background: 'var(--header-bg, #000)', borderBottom: '1px solid var(--border-color, #1a1a1a)', flexShrink: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={() => setShowReportPage(false)} 
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem', padding: 0 }}
          >
            <ArrowLeft size={18} /> <span>Черга ВКЯ</span>
          </button>
          <div style={{ width: '2px', height: '24px', background: 'var(--border-color, #1a1a1a)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle color="#ef4444" size={22} />
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text-color, #fff)' }}>ВКЯ · Звіти 1С Брак</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-color, #fff)' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #555)', textTransform: 'uppercase', fontWeight: 900 }}>Інспектор ВКЯ</div>
          </div>
        </div>
      </nav>

      {/* Filter Bar */}
      <div className="report-filters-bar" style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', background: 'var(--card-inner-bg, #000)', padding: '15px 25px', borderBottom: '1px solid var(--border-color, #111)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', padding: '8px 12px', borderRadius: '10px', width: '220px' }}>
          <Search size={16} color="#555" />
          <input 
            type="text" 
            placeholder="Фільтр по назві..." 
            value={reportSearchQuery}
            onChange={e => setReportSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-color, #fff)', outline: 'none', fontSize: '0.85rem', width: '100%' }}
          />
        </div>

        <select 
          value={reportSelectedShiftFilter} 
          onChange={e => setReportSelectedShiftFilter(e.target.value)}
          style={{ background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: 'var(--text-color, #fff)', padding: '10px 15px', borderRadius: '10px', fontSize: '0.85rem', outline: 'none' }}
        >
          <option value="all">— Всі зміни —</option>
          <option value="Зміна 1">Зміна 1</option>
          <option value="Зміна 2">Зміна 2</option>
          <option value="Зміна 3">Зміна 3</option>
          <option value="Зміна 4">Зміна 4</option>
          <option value="Без зміни">Без зміни</option>
        </select>

        <select 
          value={reportSelectedEmployeeFilter} 
          onChange={e => setReportSelectedEmployeeFilter(e.target.value)}
          style={{ background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: 'var(--text-color, #fff)', padding: '10px 15px', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', maxWidth: '200px' }}
        >
          <option value="all">— Всі працівники —</option>
          {reportUniqueOperators.map(op => <option key={op} value={op}>{op}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', padding: '8px 15px', borderRadius: '10px', fontSize: '0.85rem' }}>
          <Calendar size={16} color="#555" />
          <span style={{ color: 'var(--text-muted, #666)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>Період:</span>
          <input 
            type="date" 
            value={reportStartDate} 
            onChange={e => { setReportStartDate(e.target.value); setReportQuickPeriod(''); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-color, #fff)', outline: 'none', fontSize: '0.85rem' }}
          />
          <span style={{ color: 'var(--text-muted, #555)' }}>—</span>
          <input 
            type="date" 
            value={reportEndDate} 
            onChange={e => { setReportEndDate(e.target.value); setReportQuickPeriod(''); }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-color, #fff)', outline: 'none', fontSize: '0.85rem' }}
          />
        </div>

        <select 
          value={reportQuickPeriod} 
          onChange={handleReportQuickDateSelect}
          style={{ background: 'var(--card-bg, #111)', border: '1px solid var(--border-color, #222)', color: '#ff9000', padding: '10px 15px', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', fontWeight: 800 }}
        >
          <option value="">ОБРАТИ ПЕРІОД</option>
          <option value="today">Сьогодні</option>
          <option value="yesterday">Вчора</option>
          <option value="3days">Останні 3 дні</option>
          <option value="week">Цей тиждень</option>
          <option value="month">Цей місяць</option>
          <option value="previous_month">Минулий місяць</option>
          <option value="quarter">Останні 3 місяці</option>
          <option value="halfyear">Останні 6 місяців</option>
          <option value="year">Останній рік</option>
          <option value="all">За весь час</option>
        </select>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, padding: '30px', width: '100%', boxSizing: 'border-box' }}>
        {reportIsSyncing ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted, #a1a1aa)' }}>Завантаження даних звіту...</div>
        ) : reportLoadError ? (
          <div style={{ background: 'var(--card-bg, #111)', border: '1px solid #7f1d1d', borderRadius: '14px', padding: '24px', color: '#fca5a5' }}>Не вдалося завантажити звіт: {reportLoadError}</div>
        ) : (
          <div className="report-main-columns" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Left Column: Totals & Stages */}
            <div className="report-left-column" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'var(--card-bg, #111)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #222)' }}>
                <h4 style={{ margin: '0 0 15px', color: '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', fontWeight: 900 }}>
                  <AlertTriangle size={18} /> Загальний облік браку
                </h4>
                <div style={{ fontSize: '2.5rem', fontWeight: 1000, color: 'var(--text-color, #fff)', lineHeight: 1 }}>
                  {reportScrapStats.totalScrap} <span style={{ fontSize: '1rem', color: 'var(--text-muted, #71717a)', fontWeight: 700 }}>од.</span>
                </div>
              </div>

              <div style={{ background: 'var(--card-bg, #111)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #222)' }}>
                <h4 style={{ margin: '0 0 15px', fontSize: '0.78rem', color: 'var(--text-muted, #a1a1aa)', textTransform: 'uppercase', fontWeight: 900 }}>Брак по етапах</h4>
                {Object.entries(reportScrapStats.byStage).map(([stage, count]) => (
                  <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', padding: '10px', background: 'var(--card-inner-bg, #09090b)', borderRadius: '8px', border: '1px solid var(--border-color, #222)' }}>
                    <span style={{ color: 'var(--text-color, #d4d4d8)', fontSize: '0.82rem', fontWeight: 700 }}>{stage}</span>
                    <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>{count} од.</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Toggle Tabs & Tables */}
            <div className="report-right-column" style={{ flex: '2 2 600px', background: 'var(--card-bg, #111)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color, #222)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color, #222)', paddingBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted, #a1a1aa)', textTransform: 'uppercase', fontWeight: 900 }}>
                  {scrapReportSubTab === 'cases' ? 'Деталізація випадків' : 'Аналітика причин браку'}
                </h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => setScrapReportSubTab('cases')}
                    style={{
                      background: scrapReportSubTab === 'cases' ? '#ef4444' : 'transparent',
                      color: '#fff', border: scrapReportSubTab === 'cases' ? 'none' : '1px solid var(--border-color, #222)',
                      padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    Випадки
                  </button>
                  <button 
                    onClick={() => setScrapReportSubTab('reasons')}
                    style={{
                      background: scrapReportSubTab === 'reasons' ? '#ef4444' : 'transparent',
                      color: '#fff', border: scrapReportSubTab === 'reasons' ? 'none' : '1px solid var(--border-color, #222)',
                      padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    Причини браку
                  </button>
                </div>
              </div>

              {scrapReportSubTab === 'cases' ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '550px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted, #71717a)', textAlign: 'left', borderBottom: '2px solid var(--border-color, #222)' }}>
                        <th style={{ padding: '10px 8px' }}>Дата</th>
                        <th style={{ padding: '10px 8px' }}>Деталь</th>
                        <th style={{ padding: '10px 8px' }}>Оператор</th>
                        <th style={{ padding: '10px 8px' }}>Етап</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', color: '#f97316' }}>Карантин</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', color: '#eab308' }}>Брак</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', color: '#ef4444' }}>Утиль</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Всього</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportScrapStats.list.map(h => (
                        <tr key={h.id} style={{ borderBottom: '1px solid var(--border-color, #222)' }}>
                          <td style={{ padding: '10px 8px', color: 'var(--text-muted, #71717a)' }}>{new Date(h.completed_at).toLocaleDateString()}</td>
                          <td style={{ padding: '10px 8px', color: 'var(--text-color, #fff)', fontWeight: 700 }}>{h.nom_name}</td>
                          <td style={{ padding: '10px 8px', color: 'var(--text-muted, #d4d4d8)' }}>{h.operator_name}</td>
                          <td style={{ padding: '10px 8px', color: 'var(--text-muted, #a1a1aa)' }}>{h.stage_name}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: h.unclassified > 0 ? '#f97316' : '#3f3f46', fontWeight: h.unclassified > 0 ? '900' : '400' }}>{h.unclassified || '—'}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: h.cat1 + h.cat2 + h.cat3 > 0 ? '#eab308' : '#3f3f46', fontWeight: h.cat1 + h.cat2 + h.cat3 > 0 ? '900' : '400' }}>{h.cat1 + h.cat2 + h.cat3 || '—'}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', color: h.cat4 > 0 ? '#ef4444' : '#3f3f46', fontWeight: h.cat4 > 0 ? '900' : '400' }}>{h.cat4 || '—'}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444', fontWeight: 900 }}>{h.scrap_qty}</td>
                        </tr>
                      ))}
                      {reportScrapStats.list.length === 0 && (
                        <tr><td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #71717a)' }}>Брак відсутній за обраний період</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '550px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted, #71717a)', textAlign: 'left', borderBottom: '2px solid var(--border-color, #222)' }}>
                        <th style={{ padding: '10px 8px' }}>Причина браку</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Кількість деталей (шт)</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center' }}>Відсоток (%)</th>
                        <th style={{ padding: '10px 8px' }}>Найчастіша деталь</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>Найчастіший оператор</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportScrapReasonsStats.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #222)' }}>
                          <td style={{ padding: '12px 8px', color: 'var(--text-color, #fff)', fontWeight: 700 }}>{item.name}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>{item.quantity}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted, #71717a)' }}>{item.percentage}%</td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted, #a1a1aa)' }}>{item.topItem}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-muted, #a1a1aa)' }}>{item.topOperator}</td>
                        </tr>
                      ))}
                      {reportScrapReasonsStats.length === 0 && (
                        <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #71717a)' }}>Немає класифікованого браку за обраний період</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
