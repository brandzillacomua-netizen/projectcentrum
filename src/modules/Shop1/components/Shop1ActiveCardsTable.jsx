import React from 'react'
import { RefreshCw, Eye } from 'lucide-react'
import {
  translateCyrillic,
  CHAIN,
  formatSec,
  formatDateTimeParts,
  formatMachine
} from '../utils/shop1Helpers'

export function Shop1ActiveCardsTable({
  workCards = [],
  tasks = [],
  orders = [],
  nomenclatures = [],
  getNom,
  manualId = '',
  activeTableFilter = 'all',
  setActiveTableFilter,
  isSyncing = false,
  setSelectedCardId,
  setSelectedOperator,
  collapsedGroups = {},
  setCollapsedGroups,
  getCardStartDate,
  getCardTimeMetrics
}) {
  return (
    <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
      <div style={{ padding: '20px 25px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>В РОБОТІ ТА БУФЕРІ</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSyncing && <div style={{ fontSize: '0.7rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}><RefreshCw className="spin-s1" size={12} /> Оновлення...</div>}
          {/* Кнопки фільтру */}
          {[['all', 'ВСІ'], ['in-progress', '▶ РОБОТА'], ['at-buffer', '■ БУФЕР']].map(([val, label]) => (
            <button key={val} onClick={() => setActiveTableFilter && setActiveTableFilter(val)} style={{
              padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.04em',
              transition: 'all 0.15s',
              background: activeTableFilter === val
                ? (val === 'in-progress' ? '#3b82f6' : val === 'at-buffer' ? '#f59e0b' : '#fff')
                : '#1a1a1a',
              color: activeTableFilter === val
                ? (val === 'all' ? '#000' : '#fff')
                : '#555',
              boxShadow: activeTableFilter === val ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto', maxWidth: '100%', border: 'none', borderRadius: 0, width: '100%', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 14px' }}>ДАТА І ЧАС</th>
              <th style={{ padding: '12px 14px' }}>ДЕТАЛЬ</th>
              <th style={{ padding: '12px 14px' }}>ЕТАП</th>
              <th style={{ padding: '12px 14px' }}>СТАТУС</th>
              <th style={{ padding: '12px 14px' }}>К-СТЬ</th>
              <th style={{ padding: '12px 14px' }}>ЗМІНА</th>
              <th style={{ padding: '12px 14px' }}>ОПЕРАТОР</th>
              <th style={{ padding: '12px 14px' }}>ВЕРСТАТ</th>
              <th style={{ padding: '12px 14px', color: '#10b981' }}>ЗАГАЛЬНИЙ ЧАС</th>
              <th style={{ padding: '12px 14px', color: '#eab308' }}>ЧАС ЗМІНИ</th>
              <th style={{ padding: '12px 14px' }}></th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const activeCardsRaw = (workCards || []).filter(c => {
                const nom = getNom ? getNom(c) : nomenclatures.find(n => n.id === c.nomenclature_id)
                if (nom && nom.type && nom.type !== 'part') return false

                const info = String(c.card_info || '')
                if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return false

                const parentTask = (tasks || []).find(t => String(t.id) === String(c.task_id))
                if (parentTask) {
                  if (parentTask.status === 'completed') return false
                  if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return false
                }

                if (!CHAIN.includes(c.operation)) return false
                if (c.status !== 'in-progress' && c.status !== 'at-buffer') return false
                if (activeTableFilter === 'in-progress' && c.status !== 'in-progress') return false
                if (activeTableFilter === 'at-buffer' && c.status !== 'at-buffer') return false

                // Filter by manualId search query
                if (manualId && manualId.trim()) {
                  const q = translateCyrillic(manualId.trim()).toLowerCase()
                  
                  const seqMatch = (c.card_info || '').match(/(\d+)\/(\d+)/)
                  const seqStr = seqMatch ? seqMatch[1] : ''
                  const seqFull = seqMatch ? `${seqMatch[1]}/${seqMatch[2]}` : ''
                  
                  let matchesSearch = true
                  if (/^\d{1,4}$/.test(q)) {
                    matchesSearch = seqStr === q
                  } else if (/^\d+\/\d*$/.test(q)) {
                    matchesSearch = seqFull.startsWith(q)
                  } else {
                    const cardInfoStr = String(c.card_info || '').toLowerCase()
                    const matchesId = c.id.toLowerCase().includes(q)
                    const matchesInfo = cardInfoStr.includes(q)
                    const cardNom = getNom ? getNom(c) : nomenclatures.find(n => n.id === c.nomenclature_id)
                    const matchesNom = cardNom?.name?.toLowerCase().includes(q)
                    const matchesOrder = orders?.find(o => o.id === c.order_id)?.order_num?.toString().toLowerCase().includes(q)
                    matchesSearch = matchesId || matchesInfo || matchesNom || matchesOrder
                  }
                  
                  if (!matchesSearch) return false
                }

                return true
              }).sort((a, b) => {
                const dateA = getCardStartDate ? getCardStartDate(a) : new Date(a.created_at || 0)
                const dateB = getCardStartDate ? getCardStartDate(b) : new Date(b.created_at || 0)
                return dateB.getTime() - dateA.getTime()
              });
              const activeCards = Array.from(new Map(activeCardsRaw.map(c => [String(c.id), c])).values())

              if (activeCards.length === 0) {
                return (
                  <tr><td colSpan={12} style={{ padding: '50px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>Немає активних карток</td></tr>
                )
              }

              const grouped = { 'Розкрій': [], 'Галтовка': [], 'Прийомка': [], 'Сортування': [] }
              activeCards.forEach(card => {
                const groupKey = card.operation?.startsWith('Галтовка') ? 'Галтовка' : card.operation
                if (grouped[groupKey]) grouped[groupKey].push(card)
              })

              const rows = []
              const renderCardRow = (card) => {
                const inBuf = card.status === 'at-buffer'
                const seqMatch = (card.card_info || '').match(/(\d+\/\d+)/)
                const cardSeq = seqMatch ? seqMatch[1] : ''
                const timeMetrics = getCardTimeMetrics ? getCardTimeMetrics(card) : { totalSec: 0, currentSec: 0 }
                const startDate = getCardStartDate ? getCardStartDate(card) : new Date(card.created_at || 0)
                const nom = getNom ? getNom(card) : nomenclatures.find(n => n.id === card.nomenclature_id)

                return (
                  <tr key={card.id} 
                    onClick={() => { setSelectedCardId && setSelectedCardId(card.id); setSelectedOperator && setSelectedOperator('') }}
                    style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const parts = formatDateTimeParts(startDate);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#aaa' }}>{parts.date}</span>
                            {parts.time && <span style={{ fontSize: '0.65rem', color: '#777' }}>{parts.time}</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cardSeq && (
                          <span style={{ 
                            background: '#eab30815', 
                            color: '#eab308', 
                            padding: '2px 6px', 
                            borderRadius: '6px', 
                            fontSize: '0.65rem', 
                            fontWeight: 900,
                            border: '1px solid #eab30830'
                          }}>
                            {cardSeq}
                          </span>
                        )}
                        <span>{nom?.name || '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>{card.operation}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase',
                          background: (inBuf && card.operation === 'Сортування') ? '#8b5cf618' : inBuf ? '#f59e0b18' : '#3b82f618',
                          color: (inBuf && card.operation === 'Сортування') ? '#8b5cf6' : inBuf ? '#f59e0b' : '#3b82f6',
                          padding: '4px 10px', borderRadius: '6px',
                          whiteSpace: 'nowrap'
                        }}>
                          {(inBuf && card.operation === 'Сортування') ? '🟣 БУФЕР' : inBuf ? '▣ БУФЕР' : '▶ РОБОТА'}
                        </span>
                        {inBuf && card.operation === 'Розкрій' && (() => {
                          const pColors = { 1: '#ef4444', 2: '#3b82f6', 3: '#10b981' }
                          const pVal = card.galt_priority || 2
                          return (
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 900,
                              background: `${pColors[pVal]}15`,
                              color: pColors[pVal],
                              padding: '4px 8px', borderRadius: '6px',
                              border: `1px solid ${pColors[pVal]}30`,
                              whiteSpace: 'nowrap'
                            }}>
                              Пр. {pVal}
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 900 }}>{card.quantity} шт</td>
                    <td style={{ padding: '10px 14px', color: '#888' }}>{card.shift_name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#eab308', fontWeight: 800 }}>{formatMachine(card.machine)}</td>
                    <td style={{ padding: '10px 14px', color: '#10b981', fontFamily: 'monospace', fontWeight: 700 }}>
                      {formatSec(timeMetrics.totalSec)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#eab308', fontFamily: 'monospace', fontWeight: 700 }}>
                      {formatSec(timeMetrics.currentSec)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedCardId && setSelectedCardId(card.id); setSelectedOperator && setSelectedOperator('') }}
                        style={{ background: '#eab308', border: 'none', color: '#000', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Відкрити">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                )
              }

              const DISPLAY_GROUPS = ['Розкрій', 'Галтовка', 'Прийомка', 'Сортування']
              DISPLAY_GROUPS.forEach(op => {
                if (grouped[op] && grouped[op].length > 0) {
                  const isCollapsed = collapsedGroups[op]
                  rows.push(
                    <tr key={`header-${op}`} 
                        onClick={() => setCollapsedGroups && setCollapsedGroups(prev => ({ ...prev, [op]: !prev[op] }))}
                        style={{ background: '#0a0a0a', cursor: 'pointer', userSelect: 'none' }}>
                      <td colSpan={11} style={{ padding: '12px 14px', fontSize: '0.7rem', fontWeight: 950, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.15em', borderBottom: '1px solid #1a1a1a', borderTop: '1px solid #1a1a1a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '0', height: '0', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: isCollapsed ? 'none' : '5px solid #eab308', borderBottom: isCollapsed ? '5px solid #eab308' : 'none', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }} />
                          {op} <span style={{ color: '#555' }}>({grouped[op].length})</span>
                        </div>
                      </td>
                    </tr>
                  )
                  if (!isCollapsed) {
                    grouped[op].forEach(card => rows.push(renderCardRow(card)))
                  }
                }
              })

              return rows
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}
