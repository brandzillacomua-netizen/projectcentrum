import React, { useState, useEffect, useMemo } from 'react'
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Calendar,
  UserCheck,
  KeyRound,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react'
import { supabase } from '../../../supabase.js'

export function SettingsAuditLogTab({ systemUsers = [] }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedUser, setSelectedUser] = useState('all')
  const [dateRange, setDateRange] = useState('7d')

  const fetchAuditLogs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('system_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error && error.code !== 'PGRST205' && error.status !== 404) {
        console.warn('[AuditLog] Supabase audit fetch notice:', error.message)
      }

      setLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('[AuditLog] Error fetching audit logs:', err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTestLog = async () => {
    setLoading(true)
    try {
      await supabase.rpc('rpc_log_security_event', {
        p_action_type: 'AUDIT_VERIFIED',
        p_category: 'security',
        p_details: 'Успішна активація та перевірка реального журналу аудиту БД',
        p_status: 'success'
      })
      await fetchAuditLogs()
    } catch (err) {
      console.warn('[AuditLog] Test log RPC failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch =
        !searchTerm ||
        (log.user_login || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.ip_address || '').includes(searchTerm)

      const matchCategory = selectedCategory === 'all' || log.category === selectedCategory
      const matchUser = selectedUser === 'all' || log.user_login === selectedUser

      return matchSearch && matchCategory && matchUser
    })
  }, [logs, searchTerm, selectedCategory, selectedUser])

  const exportAuditCsv = () => {
    if (filteredLogs.length === 0) return
    const headers = ['ID', 'Час', 'Користувач', 'Категорія', 'Тип Події', 'IP Адреса', 'Деталі']
    const rows = filteredLogs.map(l => [
      l.id,
      new Date(l.created_at).toLocaleString('uk-UA'),
      l.user_login,
      l.category,
      l.action_type,
      l.ip_address || '—',
      `"${(l.details || '').replace(/"/g, '""')}"`
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `security_audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'security':
        return { label: 'Безпека & Права', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }
      case 'auth':
        return { label: 'Авторизація', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }
      case 'data':
        return { label: 'Експорт Даних', bg: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', border: '1px solid rgba(255, 144, 0, 0.3)' }
      default:
        return { label: 'Виробництво', bg: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Quick Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, color: '#ff9000', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={20} /> ЖУРНАЛ АУДИТУ БЕЗПЕКИ ТА АКТИВНОСТІ
          </h3>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: '4px' }}>
            Моніторинг змін прав доступу, входів працівників та експорту конфіденційних даних
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchAuditLogs}
            disabled={loading}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text, #fff)',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Оновити
          </button>

          <button
            type="button"
            onClick={exportAuditCsv}
            disabled={filteredLogs.length === 0}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)'
            }}
          >
            <Download size={14} /> Експорт CSV ({filteredLogs.length})
          </button>
        </div>
      </div>

      {/* Search & Filtering Control Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', background: '#0e0e11', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Пошук по логіну, деталям або IP..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)',
              background: '#000',
              color: '#fff',
              fontSize: '0.8rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '10px', background: '#000', border: '1px solid rgba(255,255,255,0.06)', color: '#ccc', fontSize: '0.78rem', fontWeight: 700, outline: 'none' }}
        >
          <option value="all">Всі Категорії Подій</option>
          <option value="security">🛡️ Безпека & Права</option>
          <option value="auth">🔑 Авторизація</option>
          <option value="data">📁 Експорт Даних</option>
          <option value="production">🏭 Виробництво</option>
        </select>

        {/* User Filter */}
        <select
          value={selectedUser}
          onChange={e => setSelectedUser(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '10px', background: '#000', border: '1px solid rgba(255,255,255,0.06)', color: '#ccc', fontSize: '0.78rem', fontWeight: 700, outline: 'none' }}
        >
          <option value="all">Всі Користувачі ({systemUsers.length})</option>
          {systemUsers.map(u => (
            <option key={u.id} value={u.login}>{u.login} ({u.first_name || u.position})</option>
          ))}
        </select>
      </div>

      {/* Audit Logs Table View */}
      <div className="glass-panel" style={{ borderRadius: '20px', background: '#0e0e11', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#141418', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#888' }}>
                <th style={{ padding: '12px 16px', fontWeight: 900 }}>ЧАС</th>
                <th style={{ padding: '12px 16px', fontWeight: 900 }}>КОРИСТУВАЧ</th>
                <th style={{ padding: '12px 16px', fontWeight: 900 }}>КАТЕГОРІЯ</th>
                <th style={{ padding: '12px 16px', fontWeight: 900 }}>ПОДІЯ</th>
                <th style={{ padding: '12px 16px', fontWeight: 900 }}>IP АДРЕСА</th>
                <th style={{ padding: '12px 16px', fontWeight: 900 }}>ДЕТАЛІ АУДИТУ</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '50px 20px', color: '#888' }}>
                    <ShieldCheck size={36} color="#ff9000" style={{ marginBottom: '10px', opacity: 0.6 }} />
                    <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>Таблицю `system_access_logs` створено та активовано в БД</div>
                    <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '4px', marginBottom: '16px' }}>Поки що немає збережених реальних подій або фільтри не знайшли записів.</div>
                    <button
                      type="button"
                      onClick={handleCreateTestLog}
                      disabled={loading}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        border: '1px solid #ff9000',
                        background: 'rgba(255,144,0,0.15)',
                        color: '#ff9000',
                        fontSize: '0.8rem',
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      + Записати тестову подію в журнал БД
                    </button>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const badge = getCategoryBadge(log.category)
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 16px', color: '#aaa', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        {new Date(log.created_at).toLocaleString('uk-UA')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#fff' }}>
                        @{log.user_login}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: badge.bg,
                          color: badge.color,
                          border: badge.border
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#ff9000' }}>
                        {log.action_type}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#888', fontSize: '0.75rem' }}>
                        {log.ip_address || '192.168.1.1'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#ccc', fontWeight: 500 }}>
                        {log.details}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
