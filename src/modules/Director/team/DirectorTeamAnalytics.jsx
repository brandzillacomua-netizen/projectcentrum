import React, { useState, useEffect } from 'react'
import { useMES } from '../../../MESContext'
import { useStore } from '../../../store/index.js'
import { useDirectorTeamAnalytics } from './hooks/useDirectorTeamAnalytics'
import { GeminiTeamChat } from './components/GeminiTeamChat'
import { TeamLeaderboard } from './components/TeamLeaderboard'
import { TeamHeadToHead } from './components/TeamHeadToHead'
import { EmployeeAuditModal } from './components/EmployeeAuditModal'
import { Users, ArrowRightLeft, Sparkles, Search, Filter, Calendar, ArrowLeft, MessageSquare } from 'lucide-react'
import './DirectorTeamAnalytics.css'

export const DirectorTeamAnalytics = ({ onBack }) => {
  const { fetchData, supabase } = useMES() || {}
  const workCardHistory = useStore((state) => state.workCardHistory) || []
  const workCards = useStore((state) => state.workCards) || []
  const systemUsers = useStore((state) => state.systemUsers) || []
  const nomenclatures = useStore((state) => state.nomenclatures) || []
  const inventory = useStore((state) => state.inventory) || []
  const orders = useStore((state) => state.orders) || []
  const tasks = useStore((state) => state.tasks) || []
  const machines = useStore((state) => state.machines) || []

  // Ensure full ERP/MES context is actively fetched
  useEffect(() => {
    if (fetchData) {
      fetchData([
        'work_card_history',
        'system_users',
        'nomenclatures',
        'work_cards',
        'inventory',
        'orders',
        'tasks',
        'machines'
      ]).catch(() => {})
    }
  }, [fetchData])

  const [dateRange, setDateRange] = useState('30d') // '7d' | '30d' | 'month' | 'all'
  const [selectedDept, setSelectedDept] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSubTab, setActiveSubTab] = useState('gemini') // 'gemini' | 'leaderboard' | 'comparison'
  const [activeDossierOperator, setActiveDossierOperator] = useState(null)
  const [dbHistory, setDbHistory] = useState(null)
  const [isSyncingDb, setIsSyncingDb] = useState(false)

  // Fetch full history from Supabase for the selected date range (aligns directly with /reports without 500 row limit)
  useEffect(() => {
    let isCancelled = false
    const syncFullHistory = async () => {
      if (!supabase) return
      setIsSyncingDb(true)
      try {
        const now = new Date()
        let startIso = null
        if (dateRange === '7d') {
          startIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        } else if (dateRange === '30d') {
          startIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        } else if (dateRange === 'month') {
          startIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        }

        const columns = 'id,card_id,task_id,nomenclature_id,operator_name,shift_name,stage_name,qty_completed,scrap_qty,qc_scrap_comment,completed_at,created_at,card_info,machine,machine_id,machine_name'
        const pageSize = 1000
        const rows = []

        for (let from = 0; from < 5000; from += pageSize) {
          let query = supabase.from('work_card_history').select(columns)
          if (startIso) query = query.gte('created_at', startIso)

          const result = await query
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, from + pageSize - 1)

          if (result.error) throw result.error
          const page = result.data || []
          rows.push(...page)
          if (page.length < pageSize) break
        }

        if (!isCancelled && rows.length > 0) {
          setDbHistory(rows)
        }
      } catch (err) {
        console.warn('[DirectorTeamAnalytics] Supabase history sync error, falling back to cache:', err)
      } finally {
        if (!isCancelled) setIsSyncingDb(false)
      }
    }

    syncFullHistory()
    return () => { isCancelled = true }
  }, [supabase, dateRange])

  // Merge history with current work cards so live operations are also included
  const combinedHistory = React.useMemo(() => {
    const baseHistory = (dbHistory && dbHistory.length > 0) ? dbHistory : workCardHistory
    const existingIds = new Set(baseHistory.map(h => h.id || h.card_id).filter(Boolean))
    const liveCardsFormatted = (workCards || []).filter(c => c && c.operator_name && !existingIds.has(c.id)).map(c => ({
      id: c.id,
      card_id: c.id,
      operator_name: c.operator_name,
      nomenclature_id: c.nomenclature_id,
      product_name: c.product_name,
      machine_name: c.machine_name || c.machine,
      shift_name: c.shift_name || c.shift || 'Зміна 1',
      stage_name: c.operation || c.stage_name || 'Розкрій',
      qty_completed: Number(c.produced_qty || c.quantity_completed || c.quantity || 0),
      scrap_qty: Number(c.scrap_qty || c.defect_qty || 0),
      duration_active_sec: Number(c.duration_active_sec || c.work_seconds || 0),
      duration_pause_sec: Number(c.duration_pause_sec || c.pause_seconds || 0),
      cutters_used: Number(c.cutters_used || 0),
      created_at: c.started_at || new Date().toISOString(),
      started_at: c.started_at || new Date().toISOString()
    }))
    return [...baseHistory, ...liveCardsFormatted]
  }, [dbHistory, workCardHistory, workCards])

  const {
    operatorsStats,
    shiftStats,
    aiInsights,
    totalRecords
  } = useDirectorTeamAnalytics({
    workCardHistory: combinedHistory,
    systemUsers,
    nomenclatures,
    dateRange,
    selectedDept,
    searchQuery
  })

  return (
    <div className="director-team-container anim-fade-in">
      {/* Strategic Header & Controls */}
      <div className="team-header-bar">
        <div className="team-header-tabs">
          <button
            className={`team-nav-pill ${activeSubTab === 'gemini' ? 'active gemini-pill' : ''}`}
            onClick={() => setActiveSubTab('gemini')}
          >
            <Sparkles size={16} className="text-amber-400" />
            <span>CENTRUM AI</span>
          </button>

          <button
            className={`team-nav-pill ${activeSubTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('leaderboard')}
          >
            <Users size={16} />
            <span>Рейтинг & Таблиця</span>
          </button>

          <button
            className={`team-nav-pill ${activeSubTab === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('comparison')}
          >
            <ArrowRightLeft size={16} />
            <span>Head-to-Head & Зміни</span>
          </button>
        </div>

        {/* Filters */}
        <div className="team-filters-group">
          {/* Search */}
          <div className="team-search-box">
            <Search size={14} className="text-dim" />
            <input
              type="text"
              placeholder="Пошук працівника..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Department */}
          <div className="team-select-box">
            <Filter size={13} className="text-dim" />
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              <option value="ALL">Всі дільниці</option>
              <option value="Цех №1">Цех №1 (Розкрій/Галтовка)</option>
              <option value="Цех №2">Цех №2</option>
              <option value="ВКЯ">ВКЯ / Якість</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="team-range-pills">
            <button
              className={`range-pill ${dateRange === '7d' ? 'active' : ''}`}
              onClick={() => setDateRange('7d')}
            >
              7д
            </button>
            <button
              className={`range-pill ${dateRange === '30d' ? 'active' : ''}`}
              onClick={() => setDateRange('30d')}
            >
              30д
            </button>
            <button
              className={`range-pill ${dateRange === 'month' ? 'active' : ''}`}
              onClick={() => setDateRange('month')}
            >
              Поточний місяць
            </button>
            <button
              className={`range-pill ${dateRange === 'all' ? 'active' : ''}`}
              onClick={() => setDateRange('all')}
            >
              Весь час
            </button>
          </div>

          {onBack && (
            <button className="team-btn-back" onClick={onBack} title="Повернутися до календаря">
              <ArrowLeft size={16} /> <span>НАЗАД</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="team-content-body">
        {activeSubTab === 'gemini' ? (
          <GeminiTeamChat
            operators={operatorsStats}
            shifts={shiftStats}
            history={combinedHistory}
            nomenclatures={nomenclatures}
            inventory={inventory}
            orders={orders}
            tasks={tasks}
            machines={machines}
            workCards={workCards}
            dateRange={dateRange}
            onOpenDossier={(op) => setActiveDossierOperator(op)}
          />
        ) : activeSubTab === 'leaderboard' ? (
          <TeamLeaderboard
            operators={operatorsStats}
            aiInsights={aiInsights}
            onSelectOperator={(op) => setActiveDossierOperator(op)}
          />
        ) : (
          <TeamHeadToHead
            operators={operatorsStats}
            shifts={shiftStats}
          />
        )}
      </div>

      {/* Detailed Audit Dossier Modal */}
      {activeDossierOperator && (
        <EmployeeAuditModal
          operator={activeDossierOperator}
          onClose={() => setActiveDossierOperator(null)}
        />
      )}
    </div>
  )
}

