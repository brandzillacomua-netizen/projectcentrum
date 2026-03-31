import React from 'react'
import { 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  LayoutDashboard,
  Warehouse,
  FileCode
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const DirectorModule = () => {
  const { tasks, orders, approveDirector } = useMES()
  
  // Director sees tasks that are waiting for final approval (not yet director confirmed)
  const pendingTasks = tasks.filter(t => t.status === 'waiting' && !t.director_conf)
  const approvedCount = tasks.filter(t => t.status === 'waiting' && t.director_conf).length

  return (
    <div className="director-module" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0, padding: '0 20px', height: '70px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#000', borderBottom: '1px solid #222' }}>
        <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <ShieldCheck className="text-accent" size={24} color="#10b981" />
          <h1 style={{ fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Директор Виробництва</h1>
        </div>
        <div className="hide-mobile" style={{ fontSize: '0.8rem', color: '#444', fontWeight: 700 }}>MES CONTROL PANEL</div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px' }}>
           <div style={{ flex: 1, minWidth: '160px', background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #222' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>ОЧІКУЮТЬ ПІДПИСУ</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ff9000' }}>{pendingTasks.length}</div>
           </div>
           <div style={{ flex: 1, minWidth: '160px', background: '#111', padding: '20px', borderRadius: '20px', border: '1px solid #222' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>ФІНАЛІЗОВАНО</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981' }}>{approvedCount}</div>
           </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
           {pendingTasks.map(task => {
              const order = orders.find(o => o.id === task.order_id)
              const isSkladOk = task.warehouse_conf === true
              const isEngOk = task.engineer_conf === true
              
              return (
                <div key={task.id} style={{ background: '#111', padding: '30px', borderRadius: '28px', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '25px', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="order-branding">
                         <span style={{ fontSize: '0.7rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Наряд в роботі</span>
                         <h2 style={{ margin: '5px 0', fontSize: '1.6rem', fontWeight: 950 }}>№{order?.order_num}</h2>
                         <div style={{ fontSize: '0.9rem', color: '#888', fontWeight: 600 }}>{order?.customer}</div>
                      </div>
                      <div style={{ color: '#333', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
                         <Clock size={14} /> {new Date(task.created_at).toLocaleDateString()}
                      </div>
                   </div>

                   <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ 
                        flex: 1, 
                        background: isSkladOk ? 'rgba(16, 185, 129, 0.1)' : '#0a0a0a', 
                        padding: '15px', 
                        borderRadius: '16px', 
                        border: '1px solid', 
                        borderColor: isSkladOk ? '#10b981' : '#222',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                         <Warehouse size={20} color={isSkladOk ? '#10b981' : '#333'} />
                         <span style={{ fontSize: '0.65rem', fontWeight: 800, color: isSkladOk ? '#10b981' : '#444' }}>СКЛАД</span>
                         {isSkladOk ? <CheckCircle2 size={14} color="#10b981" /> : <span style={{ fontSize: '0.6rem', color: '#444' }}>Очікує</span>}
                      </div>
                      
                      <div style={{ 
                        flex: 1, 
                        background: isEngOk ? 'rgba(139, 92, 246, 0.1)' : '#0a0a0a', 
                        padding: '15px', 
                        borderRadius: '16px', 
                        border: '1px solid', 
                        borderColor: isEngOk ? '#8b5cf6' : '#222',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                         <FileCode size={20} color={isEngOk ? '#8b5cf6' : '#333'} />
                         <span style={{ fontSize: '0.65rem', fontWeight: 800, color: isEngOk ? '#8b5cf6' : '#444' }}>ІНЖЕНЕР</span>
                         {isEngOk ? <CheckCircle2 size={14} color="#8b5cf6" /> : <span style={{ fontSize: '0.6rem', color: '#444' }}>Очікує</span>}
                      </div>
                   </div>

                   <button 
                     onClick={() => apiService.submitApproveDirector(task.id, approveDirector)}
                     disabled={!(isSkladOk && isEngOk)}
                     style={{ 
                       width: '100%', 
                       padding: '18px', 
                       background: (isSkladOk && isEngOk) ? '#10b981' : '#1a1a1a', 
                       color: (isSkladOk && isEngOk) ? '#000' : '#444', 
                       border: 'none', 
                       borderRadius: '16px', 
                       fontWeight: 1000, 
                       cursor: (isSkladOk && isEngOk) ? 'pointer' : 'not-allowed', 
                       display: 'flex', 
                       alignItems: 'center', 
                       justifyContent: 'center', 
                       gap: '12px', 
                       fontSize: '1rem',
                       transition: '0.3s',
                       textTransform: 'uppercase'
                     }}
                   >
                     <ShieldCheck size={22} /> { (isSkladOk && isEngOk) ? 'ФІНАЛЬНЕ ПІДТВЕРДЖЕННЯ' : 'ОЧІКУВАННЯ КОНТРОЛЮ' }
                   </button>
                </div>
              )
           })}

           {pendingTasks.length === 0 && (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px 20px', color: '#222' }}>
                <CheckCircle2 size={80} style={{ marginBottom: '20px', opacity: 0.05 }} />
                <p style={{ fontSize: '1.4rem', fontWeight: 900, color: '#444' }}>УСІ НАРЯДИ ПІДТВЕРДЖЕНО</p>
                <p style={{ fontSize: '0.9rem', color: '#333' }}>На даний момент нових завдань для директора немає.</p>
             </div>
           )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .text-accent { filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.4)); }
      `}} />
    </div>
  )
}

export default DirectorModule
