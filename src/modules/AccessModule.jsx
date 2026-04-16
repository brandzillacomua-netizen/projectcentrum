import React, { useState, useMemo } from 'react'
import { 
  ShieldCheck, 
  ArrowLeft, 
  Search, 
  Clock, 
  User, 
  MapPin, 
  Activity,
  RefreshCw,
  Filter
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const AccessModule = () => {
  const { accessLogs, syncFortnetEvents, fortnetUrl } = useMES()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDoor, setFilterDoor] = useState('all')

  const filteredLogs = useMemo(() => {
    return (accessLogs || []).filter(log => {
      const matchesSearch = 
        log.person_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.card_code?.includes(searchTerm)
      
      const matchesDoor = filterDoor === 'all' || log.hardware_name === filterDoor
      
      return matchesSearch && matchesDoor
    })
  }, [accessLogs, searchTerm, filterDoor])

  const doors = useMemo(() => {
    const d = new Set((accessLogs || []).map(l => l.hardware_name))
    return Array.from(d).filter(Boolean)
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
            <h1 style={{ fontSize: '1rem', fontWeight: 950, textTransform: 'uppercase', margin: 0 }}>Система Доступу <span style={{ color: '#333', fontSize: '0.7rem' }}>Fortnet</span></h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={syncFortnetEvents}
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
            <RefreshCw size={14} /> ОНОВИТИ
          </button>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '30px', flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Dashboard Status */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
           <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a' }}>
              <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>Статус З'єднання</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
                 <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>ONLINE</div>
              </div>
              <div style={{ color: '#333', fontSize: '0.7rem', marginTop: '5px' }}>{fortnetUrl}</div>
           </div>
           <div className="glass-panel" style={{ background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a' }}>
              <div style={{ color: '#555', fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>Подій за сьогодні</div>
              <div style={{ fontWeight: 800, fontSize: '1.8rem', color: '#ff9000' }}>{filteredLogs.length}</div>
           </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
           <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#333' }} />
              <input 
                style={inputStyle} 
                placeholder="Пошук працівника або коду картки..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
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
        </div>

        {/* Logs Table */}
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
              {filteredLogs.length > 0 ? filteredLogs.map((log, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #0a0a0a', transition: '0.2s' }} className="log-row">
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 800 }}>{new Date(log.event_time).toLocaleTimeString('uk-UA')}</div>
                    <div style={{ fontSize: '0.65rem', color: '#444' }}>{new Date(log.event_time).toLocaleDateString('uk-UA')}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 900, color: '#fff' }}>{log.person_name}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '0.8rem', color: '#ff9000', fontWeight: 700 }}>{log.hardware_name}</span>
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
                      {log.event_kind}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <code style={{ fontSize: '0.8rem', color: '#333', fontWeight: 900 }}>{log.card_code}</code>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: '#333', fontWeight: 900, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                    Подій не знайдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .hide-mobile { display: inline; }
        @media (max-width: 768px) { .hide-mobile { display: none; } }
        .log-row:hover { background: #161616; }
        .anim-pulse-hover:hover { opacity: 0.8; }
      `}} />
    </div>
  )
}

const thStyle = { padding: '15px 20px', fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }
const tdStyle = { padding: '18px 20px', fontSize: '0.9rem' }
const inputStyle = { 
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
