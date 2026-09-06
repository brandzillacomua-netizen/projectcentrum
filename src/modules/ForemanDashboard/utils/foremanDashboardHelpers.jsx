import React from 'react'
import { supabase } from '../../../supabase'

// ─────────────────────────────────────────────────────────────
// Helpers & Data Fetchers
// ─────────────────────────────────────────────────────────────

export const renderVal = (val = 0, type = 'normal', demand = 0, onClick = null, title = '') => {
  if (val === 0 && !demand) {
    return <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 400 }}>0</span>
  }
  let color = 'var(--text, #1e293b)'
  let bg = 'var(--chip-bg, rgba(0,0,0,0.04))'
  let border = '1px solid var(--glass-border, rgba(0,0,0,0.12))'

  if (type === 'sum') {
    color = '#ff9000'
    bg = 'rgba(255,144,0,0.12)'
    border = '1px solid rgba(255,144,0,0.3)'
  } else if (type === 'sgp' || type === 'bz') {
    color = '#10b981'
    bg = 'rgba(16,185,129,0.12)'
    border = '1px solid rgba(16,185,129,0.3)'
  } else if (type === 'scrap') {
    color = '#ef4444'
    bg = 'rgba(239,68,68,0.12)'
    border = '1px solid rgba(239,68,68,0.3)'
  }

  const displayVal = type === 'sum' && demand > 0 ? `${val} / ${demand}` : val
  const isClickable = typeof onClick === 'function' && val > 0

  return (
    <span
      className={type === 'sum' ? 'wip-sum-badge' : ''}
      onClick={isClickable ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      title={title || (isClickable ? `Клікніть, щоб відкрити ${val} шт карток на цьому етапі` : '')}
      style={{
        fontWeight: 'bold', color, background: bg, border, padding: '2px 6px',
        borderRadius: '4px', display: 'inline-block', minWidth: '24px',
        textAlign: 'center', whiteSpace: 'nowrap',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.15s ease-in-out',
        ...(isClickable ? { boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : {})
      }}
      onMouseEnter={e => {
        if (isClickable) {
          e.currentTarget.style.transform = 'scale(1.16)'
          e.currentTarget.style.boxShadow = '0 0 12px rgba(255, 144, 0, 0.7)'
          e.currentTarget.style.zIndex = '10'
        }
      }}
      onMouseLeave={e => {
        if (isClickable) {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.15)'
          e.currentTarget.style.zIndex = 'auto'
        }
      }}
    >
      {displayVal}
    </span>
  )
}

export const getGroupTotals = (rows) => {
  const r = { qCutWait: 0, qCut: 0, qCutBuf: 0, qGalt: 0, qGaltBuf: 0, qPriy: 0, qSortAct: 0, qSort: 0, qMalWait: 0, qMal: 0, qMalBuf: 0, qPresWait: 0, qPres: 0, qPresBuf: 0, qDoopWait: 0, qDoop: 0, qDoopBuf: 0, qSgp: 0, qBz: 0, qScrap: 0, sum: 0 }
  rows.forEach(row => {
    Object.keys(r).forEach(k => { r[k] += row[k] || 0 })
  })
  return r
}

export const fetchWorkCardHistoryByCardIds = async (cardIds = []) => {
  if (!cardIds?.length) return []
  const chunkSize = 60
  const chunks = []
  for (let i = 0; i < cardIds.length; i += chunkSize) {
    chunks.push(cardIds.slice(i, i + chunkSize))
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const chunkRows = []
      const pageSize = 1000
      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1
        const { data, error } = await supabase
          .from('work_card_history')
          .select('id, card_id, nomenclature_id, scrap_qty, created_at, completed_at, started_at, stage_name')
          .in('card_id', chunk)
          .gt('scrap_qty', 0)
          .order('created_at', { ascending: true })
          .range(from, to)

        if (error) throw error
        chunkRows.push(...(data || []))
        if (!data || data.length < pageSize) break
      }
      return chunkRows
    })
  )

  const rows = results.flat()
  return Array.from(new Map(rows.filter(Boolean).map(row => [String(row.id), row])).values())
}

export const fetchWorkCardsByTaskIds = async (taskIds = [], columns = '*') => {
  if (!taskIds?.length) return []
  const chunkSize = 60
  const chunks = []
  for (let i = 0; i < taskIds.length; i += chunkSize) {
    chunks.push(taskIds.slice(i, i + chunkSize))
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const chunkRows = []
      const pageSize = 1000
      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1
        const { data, error } = await supabase
          .from('work_cards')
          .select(columns)
          .in('task_id', chunk)
          .order('created_at', { ascending: true })
          .range(from, to)

        if (error) throw error
        chunkRows.push(...(data || []))
        if (!data || data.length < pageSize) break
      }
      return chunkRows
    })
  )

  const rows = results.flat()
  return Array.from(new Map(rows.filter(Boolean).map(row => [String(row.id), row])).values())
}

export const normalizeStage = (value) => String(value || '').toLowerCase().replace(/\s+/g, '')

export const FLOW_STAGE = {
  cut: ['розкрій'],
  tumbling: ['галтовка'],
  reception: ['прийом', 'прийм'],
  sorting: ['сортування'],
  painting: ['фарбування', 'малярка'],
  pressing: ['пресування'],
  finishing: ['доопрацювання'],
  sgp: ['сгп', 'пакування'],
  bz: ['бз', 'bz']
}

export const flowStageMatches = (stageName, keys) => {
  const stage = normalizeStage(stageName)
  return keys.some(key => (FLOW_STAGE[key] || [key]).some(needle => stage.includes(needle)))
}

export const sumFlowField = (rows, field, stageKeys = null) => {
  return rows.reduce((sum, row) => {
    if (stageKeys && !flowStageMatches(row.stage_name, stageKeys)) return sum
    return sum + (Number(row[field]) || 0)
  }, 0)
}

export const getBestKnownProducedFromFlow = (rows) => {
  const finalGood = sumFlowField(rows, 'total_good', ['sgp'])
  if (finalGood > 0) return finalGood

  const priority = ['finishing', 'pressing', 'painting', 'sorting', 'reception', 'tumbling', 'cut']
  return Math.max(0, ...priority.map(key => sumFlowField(rows, 'total_good', [key])))
}

// ─────────────────────────────────────────────────────────────
// Table Cell Styles (Theme-aware with CSS Variables)
// ─────────────────────────────────────────────────────────────

export const TH = {
  padding: '11px 10px',
  fontWeight: 600,
  borderRight: '1px solid var(--glass-border, rgba(0,0,0,0.1))',
  position: 'sticky',
  top: 0,
  background: 'var(--card-bg, #18181b)',
  color: 'var(--text-muted, #94a3b8)',
  zIndex: 10,
  whiteSpace: 'nowrap',
  fontSize: '0.72rem'
}

export const TH_STICKY = {
  ...TH,
  textAlign: 'left',
  color: 'var(--text, #f4f4f5)',
  position: 'sticky',
  top: 0,
  left: 0,
  zIndex: 40,
  minWidth: '200px',
  maxWidth: '200px',
  width: '200px'
}

export const TH_SUM = {
  ...TH,
  background: 'var(--sum-head-bg, rgba(234, 88, 12, 0.12))',
  color: '#ea580c',
  position: 'sticky',
  top: 0,
  left: '200px',
  zIndex: 40,
  minWidth: '110px',
  maxWidth: '110px',
  width: '110px'
}

export const TD = {
  padding: '10px 10px',
  textAlign: 'center',
  borderRight: '1px solid var(--glass-border, rgba(0,0,0,0.08))',
  color: 'var(--text, #f4f4f5)'
}

export const TD_STICKY = {
  ...TD,
  textAlign: 'left',
  fontWeight: 'bold',
  color: 'var(--text, #f4f4f5)',
  borderRight: '1px solid var(--glass-border, rgba(0,0,0,0.12))',
  position: 'sticky',
  left: 0,
  background: 'var(--bg, #09090b)',
  zIndex: 2,
  minWidth: '200px',
  maxWidth: '200px',
  width: '200px'
}

export const TD_SUM = {
  ...TD,
  background: 'var(--sum-cell-bg, rgba(234, 88, 12, 0.06))',
  borderRight: '1px solid var(--glass-border, rgba(0,0,0,0.12))',
  fontWeight: 'bold',
  position: 'sticky',
  left: '200px',
  zIndex: 2,
  minWidth: '110px',
  maxWidth: '110px',
  width: '110px'
}
