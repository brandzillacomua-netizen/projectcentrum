import React, { useState } from 'react'
import { 
  Settings, 
  ArrowLeft, 
  BookOpen, 
  Database, 
  FileUp, 
  Sliders 
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { useV2NomenclaturesData } from './Engineer/utils/engineerHelpers.jsx'
import { EngineerQueueTab } from './Engineer/components/EngineerQueueTab'
import { MachineOperationsTab } from './Engineer/components/MachineOperationsTab'
import { SpecBuilderTab } from './Engineer/components/SpecBuilderTab'
import { ImportSpecTab } from './Engineer/components/ImportSpecTab'
import { EngineerCuttersTab } from './Engineer/components/EngineerCuttersTab'

const EngineerV2Module = () => {
  const { tasks, orders, approveEngineer, machineCalls, machines, currentUser, supabase, theme } = useMES()
  const nomenclatures = useV2NomenclaturesData(supabase)
  const isSuperAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.position === 'Адмін' || currentUser?.access_rights?.director
  const [activeTab, setActiveTab] = useState('tasks')

  const [isLight, setIsLight] = useState(() => {
    if (theme) return theme === 'light'
    if (typeof document !== 'undefined') return document.body.classList.contains('light-theme')
    return false
  })

  React.useEffect(() => {
    const check = () => {
      if (theme) {
        setIsLight(theme === 'light')
      } else if (typeof document !== 'undefined') {
        setIsLight(document.body.classList.contains('light-theme'))
      }
    }
    check()
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(check)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [theme])
  
  const pendingTasks = (tasks || []).filter(t => t.status === 'waiting' && !t.engineer_conf && !t.step?.includes('Пресування'))
  const approvedCount = (tasks || []).filter(t => t.status === 'waiting' && t.engineer_conf).length

  const activeCalls = (machineCalls || []).filter(c => 
    c.status === 'pending' && 
    c.called_role === 'engineer' && 
    (!c.called_employee_id || c.called_employee_id === currentUser?.id)
  )

  const handleResolveCall = async (callId) => {
    const resolverName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'Інженер ЧПК'
    const { error } = await supabase
      .from('machine_calls')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: resolverName
      })
      .eq('id', callId)
    if (error) {
      alert('Помилка при вирішенні виклику: ' + error.message)
    }
  }

  return (
    <div className="engineer-module-v2" style={{ background: isLight ? 'var(--bg, #f0f2f7)' : '#080808', minHeight: '100vh', color: isLight ? '#0f172a' : '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0, background: isLight ? '#ffffff' : undefined, borderBottom: isLight ? '1px solid #cbd5e1' : undefined }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">На головну</span></Link>
        <div className="module-title-group">
          <Settings className="text-secondary" size={24} />
          <h1 className="hide-mobile" style={{ color: isLight ? '#0f172a' : '#fff' }}>Робоче місце Інженера (V2)</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem', color: isLight ? '#0f172a' : '#fff' }}>ІНЖЕНЕР V2</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {activeCalls.length > 0 && (
          <div style={{ background: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '15px 20px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 900, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-indicator" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', boxShadow: '0 0 8px #ef4444' }} />
              АКТИВНІ ВИКЛИКИ ДО ВЕРСТАТІВ ({activeCalls.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeCalls.map(c => {
                const mach = (machines || []).find(m => m.id === c.machine_id)
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isLight ? '#ffffff' : '#111', border: `1px solid ${isLight ? '#cbd5e1' : '#222'}`, borderRadius: '12px', padding: '12px 15px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isLight ? '#0f172a' : '#fff' }}>
                        {mach ? mach.name : 'Верстат'} (пор. №{mach?.sequence_number || '—'})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                        Локація: {mach?.floor || '—'} поверх | Викликав: {c.operator_name || 'Оператор'}
                        {c.called_employee_name && <span style={{ color: '#8b5cf6', fontWeight: 800 }}> | Цільовий для: {c.called_employee_name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontSize: '0.75rem', color: isLight ? '#64748b' : '#666', fontWeight: 700 }}>
                        {new Date(c.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button 
                        onClick={() => handleResolveCall(c.id)}
                        style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Я йду
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('tasks')}
            style={{ padding: '10px 20px', background: activeTab === 'tasks' ? '#3b82f6' : (isLight ? '#ffffff' : '#111'), color: activeTab === 'tasks' ? '#fff' : (isLight ? '#0f172a' : '#fff'), border: `1px solid ${activeTab === 'tasks' ? '#3b82f6' : (isLight ? '#cbd5e1' : '#222')}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 700, boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}
          >
            Черга ЧПК ({pendingTasks.length})
          </button>
          {isSuperAdmin && (
            <button 
              onClick={() => setActiveTab('operations')}
              style={{ padding: '10px 20px', background: activeTab === 'operations' ? '#3b82f6' : (isLight ? '#ffffff' : '#111'), color: activeTab === 'operations' ? '#fff' : (isLight ? '#0f172a' : '#fff'), border: `1px solid ${activeTab === 'operations' ? '#3b82f6' : (isLight ? '#cbd5e1' : '#222')}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 700, boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}
            >
              <Database size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
              Операції станків
            </button>
          )}
          <button 
            onClick={() => setActiveTab('spec')}
            style={{ padding: '10px 20px', background: activeTab === 'spec' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : (isLight ? '#ffffff' : '#111'), color: activeTab === 'spec' ? '#fff' : (isLight ? '#0f172a' : '#fff'), border: `1px solid ${activeTab === 'spec' ? '#6366f1' : (isLight ? '#cbd5e1' : '#222')}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px', boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}
          >
            <BookOpen size={15} style={{ display: 'inline' }} />
            Специфікації BOM
          </button>
          <button 
            onClick={() => setActiveTab('import')}
            style={{ padding: '10px 20px', background: activeTab === 'import' ? 'linear-gradient(135deg,#059669,#10b981)' : (isLight ? '#ffffff' : '#111'), color: activeTab === 'import' ? '#fff' : (isLight ? '#0f172a' : '#aaa'), border: `1px solid ${activeTab === 'import' ? '#10b981' : (isLight ? '#cbd5e1' : '#222')}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px', boxShadow: activeTab === 'import' ? '0 4px 15px rgba(16,185,129,0.25)' : (isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none') }}
          >
            <FileUp size={15} style={{ display: 'inline' }} />
            Імпорт CSV
          </button>
          <button 
            onClick={() => setActiveTab('cutters')}
            style={{ padding: '10px 20px', background: activeTab === 'cutters' ? '#3b82f6' : (isLight ? '#ffffff' : '#111'), color: activeTab === 'cutters' ? '#fff' : (isLight ? '#0f172a' : '#fff'), border: `1px solid ${activeTab === 'cutters' ? '#3b82f6' : (isLight ? '#cbd5e1' : '#222')}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px', boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}
          >
            <Sliders size={15} style={{ display: 'inline' }} />
            Налаштування фрез
          </button>
        </div>

        {activeTab === 'tasks' ? (
          <EngineerQueueTab
            pendingTasks={pendingTasks}
            approvedCount={approvedCount}
            orders={orders}
            nomenclatures={nomenclatures}
            approveEngineer={approveEngineer}
          />
        ) : (activeTab === 'operations' && isSuperAdmin) ? (
          <MachineOperationsTab />
        ) : activeTab === 'import' ? (
          <ImportSpecTab />
        ) : activeTab === 'cutters' ? (
          <EngineerCuttersTab />
        ) : (
          <SpecBuilderTab />
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .eng-task-card { transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .eng-task-card:hover { transform: translateY(-5px); border-color: #3b82f6; box-shadow: 0 15px 40px rgba(59, 130, 246, 0.15); }
      `}} />
    </div>
  )
}

export default EngineerV2Module
