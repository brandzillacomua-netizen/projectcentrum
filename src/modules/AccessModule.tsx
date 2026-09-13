import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { 
  ShieldCheck, 
  ArrowLeft, 
  Search, 
  Clock, 
  User, 
  MapPin, 
  Activity,
  RefreshCw,
  Filter,
  Lock,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  FileText
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'

export interface FortnetLogEntry {
  event_time: string
  person_name?: string
  card_code?: string
  hardware_name?: string
  event_kind?: string
}

export interface SystemAccessLogEntry {
  id: number
  created_at: string
  user_id: number | null
  user_login: string
  user_name: string | null
  action_type: string
  category: string
  ip_address: string | null
  details: string | null
  status: string
}

type AccessTab = 'fortnet' | 'system_audit'

export const AccessModule: React.FC = () => {
  const { accessLogs, syncFortnetEvents, fortnetUrl } = useMES()
  const [activeTab, setActiveTab] = useState<AccessTab>('fortnet')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDoor, setFilterDoor] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // System access audit logs state
  const [systemLogs, setSystemLogs] = useState<SystemAccessLogEntry[]>([])
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const [systemLogsError, setSystemLogsError] = useState<string | null>(null)

  const fetchSystemAccessLogs = useCallback(async () => {
    setIsLogsLoading(true)
    setSystemLogsError(null)
    try {
      const { data, error } = await supabase
        .from('system_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        setSystemLogsError(error.message)
      } else if (data) {
        setSystemLogs(data as SystemAccessLogEntry[])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Помилка завантаження логів'
      setSystemLogsError(msg)
    } finally {
      setIsLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'system_audit') {
      fetchSystemAccessLogs()
    }
  }, [activeTab, fetchSystemAccessLogs])

  const filteredFortnetLogs = useMemo(() => {
    return (accessLogs || []).filter((log: FortnetLogEntry) => {
      const matchesSearch = 
        log.person_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.card_code?.includes(searchTerm)
      
      const matchesDoor = filterDoor === 'all' || log.hardware_name === filterDoor
      
      return matchesSearch && matchesDoor
    })
  }, [accessLogs, searchTerm, filterDoor])

  const filteredSystemLogs = useMemo(() => {
    return systemLogs.filter((log: SystemAccessLogEntry) => {
      const matchesSearch = 
        log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_login?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [systemLogs, searchTerm, statusFilter])

  const doors = useMemo(() => {
    const d = new Set((accessLogs || []).map((l: FortnetLogEntry) => l.hardware_name))
    return Array.from(d).filter(Boolean) as string[]
  }, [accessLogs])

  return (
    <div className="access-module" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <nav className="module-nav" style={{ 
        padding: '0 20px', 
        height: '70px', 
        background: '#000', 
        borderBottom: '1px solid #1a1a1a',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} color="#ff9000" />
            <h1 style={{ fontSize: '1rem', fontWeight: 950, textTransform: 'uppercase', margin: 0 }}>
              Система Доступу <span style={{ color: '#ff9000', fontSize: '0.7rem' }}>ENTERPRISE AUDIT</span>
            </h1>
          </div>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', gap: '8px', background: '#111', padding: '4px', borderRadius: '12px', border: '1px solid #222' }}>
          <button
            onClick={() => setActiveTab('fortnet')}
            style={{
              background: activeTab === 'fortnet' ? '#ff9000' : 'transparent',
              color: activeTab === 'fortnet' ? '#000' : '#888',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '8px',
              fontWeight: 900,
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: '0.2s'
            }}
          >
            <KeyRound size={14} /> ТУРНІКЕТИ FORTNET
          </button>

          <button
            onClick={() => setActiveTab('system_audit')}
            style={{
              background: activeTab === 'system_audit' ? '#ff9000' : 'transparent',
              color: activeTab === 'system_audit' ? '#000' : '#888',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '8px',
              fontWeight: 900,
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: '0.2s'
            }}
          >
            <Lock size={14} /> АУДИТ БЕЗПЕКИ ВХОДІВ
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={activeTab === 'fortnet' ? syncFortnetEvents : fetchSystemAccessLogs}
            className="anim-pulse-hover"
            style={{ 
              background: '#111', 
              border: '1px solid #222', 
              color: '#ff9000', 
              padding: '8px 15px', 
              borderRadius: '8px', 
              fontSize: '0.75rem', 
              fontWeight: 900, 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={14} className={isLogsLoading ? 'spin' : ''} /> ОНОВИТИ
          </button>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '30px', flex: 1, maxWidth: '1250px', margin: '0 auto', width: '100%' }}>
        
        {/* Dashboard Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a' }}>
            <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>
              {activeTab === 'fortnet' ? "Статус З'єднання Fortnet" : "Контур Безпеки RLS"}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>ONLINE</div>
            </div>
            <div style={{ color: '#333', fontSize: '0.7rem', marginTop: '5px' }}>
              {activeTab === 'fortnet' ? (fortnetUrl || 'Внутрішній сервер') : 'Захищений аудит PostgreSQL'}
            </div>
          </div>

          <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a' }}>
            <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>
              {activeTab === 'fortnet' ? 'Подій за сьогодні' : 'Аудит-записів авторизації'}
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.8rem', color: '#ff9000' }}>
              {activeTab === 'fortnet' ? filteredFortnetLogs.length : filteredSystemLogs.length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
            <input 
              style={inputStyle} 
              placeholder={activeTab === 'fortnet' ? "Пошук працівника або коду картки..." : "Пошук користувача, IP або дії..."} 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {activeTab === 'fortnet' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', padding: '0 15px', borderRadius: '14px', border: '1px solid #1a1a1a' }}>
              <Filter size={16} color="#555" />
              <select 
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', padding: '12px 0' }}
                value={filterDoor}
                onChange={e => setFilterDoor(e.target.value)}
              >
                <option value="all">Усі точки доступу</option>
                {doors.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', padding: '0 15px', borderRadius: '14px', border: '1px solid #1a1a1a' }}>
              <Filter size={16} color="#555" />
              <select 
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', padding: '12px 0' }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Усі статусі аудиту</option>
                <option value="success">Успішні авторизації (success)</option>
                <option value="failed_password">Невірний пароль (failed_password)</option>
                <option value="blocked_ip">Заблоковані IP (blocked_ip)</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab 1: Fortnet Logs Table */}
        {activeTab === 'fortnet' && (
          <div className="glass-panel" style={{ background: '#111', borderRadius: '24px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#000', borderBottom: '1px solid #1a1a1a', textAlign: 'left' }}>
                  <th style={thStyle}><Clock size={14} /> ЧАС</th>
                  <th style={thStyle}><User size={14} /> ПРАЦІВНИК</th>
                  <th style={thStyle}><MapPin size={14} /> ТОЧКА ДОСТУПУ</th>
                  <th style={thStyle}><Activity size={14} /> ТИП ПОДІЇ</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>КАРТКА</th>
                </tr>
              </thead>
              <tbody>
                {filteredFortnetLogs.length > 0 ? filteredFortnetLogs.map((log: FortnetLogEntry, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #0a0a0a', transition: '0.2s' }} className="log-row">
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 800 }}>{new Date(log.event_time).toLocaleTimeString('uk-UA')}</div>
                      <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(log.event_time).toLocaleDateString('uk-UA')}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 900, color: '#fff' }}>{log.person_name || 'Невідомо'}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 700 }}>{log.hardware_name || 'Турнікет'}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        background: log.event_kind?.includes('разрешен') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: log.event_kind?.includes('разрешен') ? '#10b981' : '#ef4444',
                        fontWeight: 900,
                        textTransform: 'uppercase'
                      }}>
                        {log.event_kind || 'ПРОХІД'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <code style={{ fontSize: '0.8rem', color: '#555', fontWeight: 900 }}>{log.card_code}</code>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '50px', textAlign: 'center', color: '#444', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                      Подій турнікетів не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: System Access Audit Table */}
        {activeTab === 'system_audit' && (
          <div className="glass-panel" style={{ background: '#111', borderRadius: '24px', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
            {systemLogsError && (
              <div style={{ padding: '15px 20px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid #1a1a1a' }}>
                ⚠️ {systemLogsError}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#000', borderBottom: '1px solid #1a1a1a', textAlign: 'left' }}>
                  <th style={thStyle}><Clock size={14} /> ЧАС</th>
                  <th style={thStyle}><User size={14} /> КОРИСТУВАЧ</th>
                  <th style={thStyle}><Activity size={14} /> ДІЯ</th>
                  <th style={thStyle}><FileText size={14} /> ДЕТАЛІ</th>
                  <th style={thStyle}><ShieldCheck size={14} /> СТАТУС</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>IP АДРЕСА</th>
                </tr>
              </thead>
              <tbody>
                {filteredSystemLogs.length > 0 ? filteredSystemLogs.map((log: SystemAccessLogEntry) => {
                  const isSuccess = log.status === 'success'
                  const isBlocked = log.status === 'blocked_ip'
                  const isFailed = log.status === 'failed_password'

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #0a0a0a', transition: '0.2s' }} className="log-row">
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 800 }}>{new Date(log.created_at).toLocaleTimeString('uk-UA')}</div>
                        <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(log.created_at).toLocaleDateString('uk-UA')}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 900, color: '#fff' }}>{log.user_name || log.user_login}</div>
                        <div style={{ fontSize: '0.7rem', color: '#555' }}>@{log.user_login}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 800 }}>{log.action_type}</span>
                        <div style={{ fontSize: '0.65rem', color: '#444', textTransform: 'uppercase' }}>{log.category}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>{log.details || '—'}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          background: isSuccess ? 'rgba(16,185,129,0.1)' : isBlocked ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)',
                          color: isSuccess ? '#10b981' : isBlocked ? '#ef4444' : '#f59e0b',
                          fontWeight: 900,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          textTransform: 'uppercase'
                        }}>
                          {isSuccess && <CheckCircle2 size={12} />}
                          {isBlocked && <AlertTriangle size={12} />}
                          {isFailed && <Lock size={12} />}
                          {log.status}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <code style={{ fontSize: '0.75rem', color: '#555', fontWeight: 900 }}>{log.ip_address || '127.0.0.1'}</code>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: '#444', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                      {isLogsLoading ? 'Завантаження аудиту безпеки...' : 'Записів аудиту доступу не знайдено'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .hide-mobile { display: inline; }
        @media (max-width: 768px) { .hide-mobile { display: none; } }
        .log-row:hover { background: #161616; }
        .anim-pulse-hover:hover { opacity: 0.8; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}} />
    </div>
  )
}

const thStyle = { padding: '15px 20px', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }
const tdStyle = { padding: '18px 20px', fontSize: '0.9rem' }
const inputStyle: React.CSSProperties = { 
  width: '100%', 
  background: '#111', 
  border: '1px solid #1a1a1a', 
  color: '#fff', 
  padding: '12px 15px 12px 45px', 
  borderRadius: '14px', 
  fontSize: '0.9rem', 
  outline: 'none',
  transition: '0.3s'
}

export default AccessModule
