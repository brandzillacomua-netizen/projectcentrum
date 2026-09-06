import React, { useState } from 'react'
import {
  renderVal,
  getGroupTotals,
  TH,
  TH_STICKY,
  TH_SUM,
  TD,
  TD_STICKY,
  TD_SUM
} from '../utils/foremanDashboardHelpers.jsx'

const WipTable = ({ groupedData, maxHeight = 'calc(100vh - 320px)', emptyText = 'Немає даних', onCellClick = null }) => {
  const [isFull, setIsFull] = useState(false)

  const renderTable = (scrollMaxHeight) => (
    <div style={{ borderRadius: '16px', border: '1px solid var(--glass-border, rgba(0,0,0,0.1))', background: 'var(--bg, #09090b)', overflow: 'auto', maxHeight: scrollMaxHeight, width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', color: 'var(--text, #f4f4f5)', minWidth: '800px' }}>
        <thead>
          <tr style={{ background: 'var(--card-bg, #18181b)', color: 'var(--text-muted, #a1a1aa)', textAlign: 'center', borderBottom: '2px solid var(--glass-border, rgba(0,0,0,0.12))' }}>
            <th className="wip-col-nomenclature" style={TH_STICKY}>Номенклатура</th>
            <th className="wip-col-sum" style={TH_SUM}>Сума</th>
            <th style={TH}>Очік. Розкрій</th>
            <th style={TH}>Розкрій</th>
            <th style={TH}>Буфер Розкр.</th>
            <th style={TH}>Галтовка</th>
            <th style={TH}>Буфер Галт.</th>
            <th style={TH}>Прийомка</th>
            <th style={TH}>Сортування</th>
            <th style={TH}>Буфер Цех2</th>
            <th style={TH}>Очік. Малярка</th>
            <th style={TH}>Малярка</th>
            <th style={TH}>Буфер Мал.</th>
            <th style={TH}>Очік. Прес.</th>
            <th style={TH}>Пресування</th>
            <th style={TH}>Буфер Прес.</th>
            <th style={TH}>Очік. Доопр.</th>
            <th style={TH}>Доопрац.</th>
            <th style={TH}>Буфер Доопр.</th>
            <th style={{ ...TH, color: '#10b981', background: 'rgba(16,185,129,0.08)' }}>СГП</th>
            <th style={{ ...TH, color: '#10b981', background: 'rgba(16,185,129,0.08)' }}>БЗ</th>
            <th style={{ ...TH, color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderRight: 'none' }}>Брак</th>
          </tr>
        </thead>
        <tbody>
          {groupedData.length === 0 ? (
            <tr>
              <td colSpan={22} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #52525b)', fontStyle: 'italic' }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            groupedData.map(group => {
              const gt = getGroupTotals(group.rows)
              return (
                <React.Fragment key={group.id}>
                  {/* Group header */}
                  <tr style={{ background: 'var(--card-bg, #18181b)', borderBottom: '2px solid var(--glass-border, rgba(0,0,0,0.1))' }}>
                    <td colSpan={22} style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text, #f4f4f5)', position: 'sticky', left: 0, background: 'var(--card-bg, #18181b)', zIndex: 2 }}>
                      <span style={{ color: '#ff9000', marginRight: '8px' }}>📦</span>
                      {group.name}{group.code ? ` (${group.code})` : ''}
                      {group.trend && (
                        <span style={{ color: 'var(--text-muted, #a1a1aa)', fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '12px' }}>
                          Потенційний тренд: <strong style={{ color: 'var(--text, #f4f4f5)' }}>{group.trend.potential}</strong> / {group.trend.demand || 0} компл.
                          {' '}| На СГП: <strong style={{ color: '#10b981' }}>{group.trend.actual} компл.</strong>
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Rows */}
                  {group.rows.map(row => (
                    <tr key={row.id} style={{ background: 'var(--bg, #09090b)', borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.06))', transition: 'background 0.15s' }}>
                      <td className="wip-col-nomenclature" style={{ ...TD_STICKY, paddingLeft: '28px' }}>
                        {row.name}
                        {row.code && <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted, #52525b)', marginTop: '1px' }}>Код: {row.code}</span>}
                      </td>
                      <td className="wip-col-sum" style={TD_SUM}>{renderVal(row.sum, 'sum', row.demand, onCellClick ? () => onCellClick(row, 'sum', 'Усі етапи (Сума)', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qCutWait, 'normal', 0, onCellClick ? () => onCellClick(row, 'qCutWait', 'Очік. Розкрій', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qCut, 'normal', 0, onCellClick ? () => onCellClick(row, 'qCut', 'Розкрій', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qCutBuf, 'normal', 0, onCellClick ? () => onCellClick(row, 'qCutBuf', 'Буфер Розкр.', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qGalt, 'normal', 0, onCellClick ? () => onCellClick(row, 'qGalt', 'Галтовка', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qGaltBuf, 'normal', 0, onCellClick ? () => onCellClick(row, 'qGaltBuf', 'Буфер Галт.', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qPriy, 'normal', 0, onCellClick ? () => onCellClick(row, 'qPriy', 'Прийомка', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qSortAct, 'normal', 0, onCellClick ? () => onCellClick(row, 'qSortAct', 'Сортування (в роботі)', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qSort, 'normal', 0, onCellClick ? () => onCellClick(row, 'qSort', 'Сортування / Буфер Цех2', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qMalWait, 'normal', 0, onCellClick ? () => onCellClick(row, 'qMalWait', 'Очік. Малярка', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qMal, 'normal', 0, onCellClick ? () => onCellClick(row, 'qMal', 'Малярка', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qMalBuf, 'normal', 0, onCellClick ? () => onCellClick(row, 'qMalBuf', 'Буфер Мал.', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qPresWait, 'normal', 0, onCellClick ? () => onCellClick(row, 'qPresWait', 'Очік. Прес.', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qPres, 'normal', 0, onCellClick ? () => onCellClick(row, 'qPres', 'Пресування', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qPresBuf, 'normal', 0, onCellClick ? () => onCellClick(row, 'qPresBuf', 'Буфер Прес.', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qDoopWait, 'normal', 0, onCellClick ? () => onCellClick(row, 'qDoopWait', 'Очік. Доопр.', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qDoop, 'normal', 0, onCellClick ? () => onCellClick(row, 'qDoop', 'Доопрацювання', group) : null)}</td>
                      <td style={TD}>{renderVal(row.qDoopBuf, 'normal', 0, onCellClick ? () => onCellClick(row, 'qDoopBuf', 'Буфер Доопр.', group) : null)}</td>
                      <td style={{ ...TD, background: 'rgba(16,185,129,0.03)' }}>{renderVal(row.qSgp, 'sgp', 0, onCellClick ? () => onCellClick(row, 'qSgp', 'СГП (Пакування)', group) : null)}</td>
                      <td style={{ ...TD, background: 'rgba(16,185,129,0.03)' }}>{renderVal(row.qBz, 'bz', 0, onCellClick ? () => onCellClick(row, 'qBz', 'БЗ (Склад)', group) : null)}</td>
                      <td style={{ ...TD, background: 'rgba(239,68,68,0.03)', borderRight: 'none' }}>{renderVal(row.qScrap, 'scrap', 0, onCellClick ? () => onCellClick(row, 'qScrap', 'Брак', group) : null)}</td>
                    </tr>
                  ))}

                  {/* Subtotals */}
                  <tr style={{ background: 'var(--card-bg, #18181b)', fontWeight: 'bold', borderTop: '1px solid var(--glass-border, rgba(0,0,0,0.1))', borderBottom: '1px solid var(--glass-border, rgba(0,0,0,0.1))', color: 'var(--text-muted, #a1a1aa)', fontSize: '0.76rem' }}>
                    <td className="wip-col-nomenclature" style={{ ...TD_STICKY, fontStyle: 'italic', paddingLeft: '28px', color: 'var(--text-muted, #52525b)', background: 'var(--card-bg, #18181b)' }}>Підсумок по виробу:</td>
                    <td className="wip-col-sum" style={{ ...TD_SUM, background: 'rgba(234, 88, 12, 0.1)' }}>{renderVal(gt.sum, 'sum')}</td>
                    <td style={TD}>{renderVal(gt.qCutWait)}</td>
                    <td style={TD}>{renderVal(gt.qCut)}</td>
                    <td style={TD}>{renderVal(gt.qCutBuf)}</td>
                    <td style={TD}>{renderVal(gt.qGalt)}</td>
                    <td style={TD}>{renderVal(gt.qGaltBuf)}</td>
                    <td style={TD}>{renderVal(gt.qPriy)}</td>
                    <td style={TD}>{renderVal(gt.qSortAct)}</td>
                    <td style={TD}>{renderVal(gt.qSort)}</td>
                    <td style={TD}>{renderVal(gt.qMalWait)}</td>
                    <td style={TD}>{renderVal(gt.qMal)}</td>
                    <td style={TD}>{renderVal(gt.qMalBuf)}</td>
                    <td style={TD}>{renderVal(gt.qPresWait)}</td>
                    <td style={TD}>{renderVal(gt.qPres)}</td>
                    <td style={TD}>{renderVal(gt.qPresBuf)}</td>
                    <td style={TD}>{renderVal(gt.qDoopWait)}</td>
                    <td style={TD}>{renderVal(gt.qDoop)}</td>
                    <td style={TD}>{renderVal(gt.qDoopBuf)}</td>
                    <td style={{ ...TD, background: 'rgba(16,185,129,0.08)' }}>{renderVal(gt.qSgp, 'sgp')}</td>
                    <td style={{ ...TD, background: 'rgba(16,185,129,0.08)' }}>{renderVal(gt.qBz, 'bz')}</td>
                    <td style={{ ...TD, background: 'rgba(239,68,68,0.08)', borderRight: 'none' }}>{renderVal(gt.qScrap, 'scrap')}</td>
                  </tr>
                </React.Fragment>
              )
            })
          )}

          {/* Grand total */}
          {groupedData.length > 1 && (() => {
            const allRows = groupedData.flatMap(g => g.rows)
            const gt = getGroupTotals(allRows)
            return (
              <tr style={{ background: 'var(--card-bg, #18181b)', fontWeight: 'bold', borderTop: '2px solid #ff9000', color: 'var(--text, #f4f4f5)', fontSize: '0.8rem' }}>
                <td className="wip-col-nomenclature" style={{ ...TD_STICKY, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.72rem', background: 'var(--card-bg, #18181b)' }}>ЗАГАЛЬНИЙ WIP РАЗОМ:</td>
                <td className="wip-col-sum" style={{ ...TD_SUM, background: 'rgba(234, 88, 12, 0.15)', color: '#ff9000' }}>{renderVal(gt.sum, 'sum')}</td>
                <td style={TD}>{renderVal(gt.qCutWait)}</td>
                <td style={TD}>{renderVal(gt.qCut)}</td>
                <td style={TD}>{renderVal(gt.qCutBuf)}</td>
                <td style={TD}>{renderVal(gt.qGalt)}</td>
                <td style={TD}>{renderVal(gt.qGaltBuf)}</td>
                <td style={TD}>{renderVal(gt.qPriy)}</td>
                <td style={TD}>{renderVal(gt.qSortAct)}</td>
                <td style={TD}>{renderVal(gt.qSort)}</td>
                <td style={TD}>{renderVal(gt.qMalWait)}</td>
                <td style={TD}>{renderVal(gt.qMal)}</td>
                <td style={TD}>{renderVal(gt.qMalBuf)}</td>
                <td style={TD}>{renderVal(gt.qPresWait)}</td>
                <td style={TD}>{renderVal(gt.qPres)}</td>
                <td style={TD}>{renderVal(gt.qPresBuf)}</td>
                <td style={TD}>{renderVal(gt.qDoopWait)}</td>
                <td style={TD}>{renderVal(gt.qDoop)}</td>
                <td style={TD}>{renderVal(gt.qDoopBuf)}</td>
                <td style={{ ...TD, background: 'rgba(16,185,129,0.12)' }}>{renderVal(gt.qSgp, 'sgp')}</td>
                <td style={{ ...TD, background: 'rgba(16,185,129,0.12)' }}>{renderVal(gt.qBz, 'bz')}</td>
                <td style={{ ...TD, background: 'rgba(239,68,68,0.12)', borderRight: 'none' }}>{renderVal(gt.qScrap, 'scrap')}</td>
              </tr>
            )
          })()}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>
      {/* Mobile-only toggle full screen button */}
      <div className="mobile-fullscreen-btn-container" style={{ display: 'none', marginBottom: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setIsFull(true)}
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span>🖥️</span> На весь екран
        </button>
      </div>

      {renderTable(maxHeight)}

      {/* Full screen modal */}
      {isFull && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'var(--bg, #09090b)', zIndex: 99999, padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', color: '#ff9000' }}>WIP Таблиця (Повноекранний аналіз)</span>
            <button
              onClick={() => setIsFull(false)}
              style={{ background: 'var(--card-bg, #27272a)', color: 'var(--text, #fff)', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Закрити ✕
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {renderTable('100%')}
          </div>
        </div>
      )}
    </div>
  )
}

export default WipTable
