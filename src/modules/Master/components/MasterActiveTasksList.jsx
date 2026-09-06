import React from 'react'
import { Printer, Play } from 'lucide-react'
import { isShop1Task } from '../utils/masterHelpers'

const MasterActiveTaskCard = React.memo(({ task, order, nomenclatures, handleReprint, isLight }) => {
  const taskProductNames = order?.order_items
    ?.map(it => nomenclatures.find(n => String(n.id) === String(it.nomenclature_id))?.name)
    .filter(Boolean)
    .join(', ') || task.machine_name || 'Виріб...'

  const isSkladConfirmed = task.warehouse_conf === 'true' || task.warehouse_conf === true
  const isTechConfirmed = task.engineer_conf === true
  const isDirectorConfirmed = task.director_conf === true

  const totalSets = Number(task.planned_sets) || order?.order_items?.reduce((sum, it) => sum + Number(it.quantity), 0) || 0

  const createdDateStr = task.created_at 
    ? `${new Date(task.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}, ${new Date(task.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
    : ''

  return (
    <div 
      style={{ 
        position: 'relative', 
        background: isLight ? '#ffffff' : '#0a0a0a', 
        padding: '18px 20px', 
        borderRadius: '16px', 
        border: isLight ? '1px solid #e2e8f0' : '1px solid #222222', 
        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.04)' : 'none'
      }}
    >
      {/* TOP ROW */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <strong style={{ fontSize: '1.15rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', letterSpacing: '-0.01em' }}>
            {order?.order_num ? `№ ${order.order_num}` : (task.plan_snapshot?._prep_num ? `№ ${task.plan_snapshot._prep_num}` : '№ Наряд')}
          </strong>
          <span style={{ fontSize: '0.78rem', color: isLight ? '#64748b' : '#a1a1aa', fontWeight: 700 }}>
            {order?.customer || 'Виробництво'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {createdDateStr && (
              <span style={{ fontSize: '0.62rem', color: isLight ? '#64748b' : '#71717a', fontWeight: 800, textTransform: 'uppercase' }}>
                СТВОРЕНО {createdDateStr}
              </span>
            )}
            <button 
              onClick={() => handleReprint(task)} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: isLight ? '#0f172a' : '#ffffff', 
                cursor: 'pointer', 
                padding: '4px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }} 
              title="Друк наряду"
            >
              <Printer size={16} />
            </button>
          </div>

          {totalSets > 0 && (
            <div style={{ marginTop: '2px', textAlign: 'right' }}>
              <span style={{ fontSize: '0.6rem', color: isLight ? '#64748b' : '#71717a', fontWeight: 900, textTransform: 'uppercase', display: 'block' }}>
                ТИРАЖ
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ff9000' }}>
                {totalSets} <small style={{ fontSize: '0.75rem', fontWeight: 800 }}>од.</small>
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* MIDDLE INSET BOX */}
      <div style={{ 
        background: isLight ? '#ffffff' : '#111111', 
        border: isLight ? '1px solid #e2e8f0' : '1px solid #1f1f23', 
        borderRadius: '10px', 
        padding: '10px 14px', 
        marginBottom: '12px' 
      }}>
        <div style={{ fontSize: '0.78rem', color: isLight ? '#64748b' : '#d4d4d8', fontWeight: 700, marginBottom: '6px' }}>
          {taskProductNames}
        </div>
        <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#a1a1aa', fontWeight: 800, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: isLight ? '#0f172a' : '#ffffff', fontWeight: 900 }}>{task.step || 'Розкрій'}</span>
          <span>ВЕРСТАТ: <strong style={{ color: '#ff9000' }}>{task.machine_name || 'Не призначено'}</strong></span>
        </div>
      </div>

      {/* BOTTOM ROW: 3 BADGES */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <div style={{ 
          fontSize: '0.65rem', 
          padding: '4px 12px', 
          borderRadius: '6px', 
          background: isSkladConfirmed ? '#00b894' : (isLight ? '#e2e8f0' : '#27272a'), 
          color: isSkladConfirmed ? '#ffffff' : (isLight ? '#64748b' : '#a1a1aa'), 
          fontWeight: 900,
          letterSpacing: '0.5px'
        }}>
          СКЛАД
        </div>
        <div style={{ 
          fontSize: '0.65rem', 
          padding: '4px 12px', 
          borderRadius: '6px', 
          background: isTechConfirmed ? '#00b894' : (isLight ? '#e2e8f0' : '#27272a'), 
          color: isTechConfirmed ? '#ffffff' : (isLight ? '#64748b' : '#a1a1aa'), 
          fontWeight: 900,
          letterSpacing: '0.5px'
        }}>
          ІНЖЕНЕР
        </div>
        <div style={{ 
          fontSize: '0.65rem', 
          padding: '4px 12px', 
          borderRadius: '6px', 
          background: isDirectorConfirmed ? '#00b894' : (isLight ? '#e2e8f0' : '#27272a'), 
          color: isDirectorConfirmed ? '#ffffff' : (isLight ? '#64748b' : '#a1a1aa'), 
          fontWeight: 900,
          letterSpacing: '0.5px'
        }}>
          ДИРЕКТОР
        </div>
      </div>
    </div>
  )
})

export function MasterActiveTasksList({
  tasks = [],
  orders = [],
  allOrdersMap = {},
  nomenclatures = [],
  handleReprint,
  showAuxiliary = false,
  setShowAuxiliary,
  theme = 'light'
}) {
  const isLight = theme === 'light'
  
  const activeTasks = React.useMemo(() => (tasks || []).filter(t => {
    if (t.status === 'completed' || t.status === 'pending' || t.status === 'new') return false
    if (!isShop1Task(t)) return false
    
    const isAuxiliary = t.step === 'Підготовка' || t.machine_name === 'PREP-TERM' || String(t.plan_snapshot?._prep_num || '').startsWith('НП') || String(t.order_num || '').startsWith('ВБ')
    if (!showAuxiliary && isAuxiliary) return false
    
    return true
  }), [tasks, showAuxiliary])

  return (
    <section className="grid-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '0.85rem', color: isLight ? '#0f172a' : '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, textTransform: 'uppercase' }}>
          <Play size={14} fill="currentColor" color="#ea580c" /> АКТИВНІ В ЦЕХУ ({activeTasks.length})
        </h3>
        {setShowAuxiliary && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isLight ? '#64748b' : '#a1a1aa', fontWeight: 700, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showAuxiliary} 
              onChange={e => setShowAuxiliary(e.target.checked)} 
              style={{ accentColor: '#ea580c', cursor: 'pointer' }}
            />
            <span>Показати НП та ВБ</span>
          </label>
        )}
      </div>

      <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {activeTasks.length === 0 ? (
          <div style={{ 
            padding: '25px', 
            background: isLight ? '#ffffff' : '#0a0a0a', 
            border: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a', 
            borderRadius: '16px', 
            color: isLight ? '#64748b' : '#555555', 
            textAlign: 'center', 
            fontSize: '0.8rem' 
          }}>
            Немає активних завдань у розкрії
          </div>
        ) : (
          activeTasks.map(task => {
            const order = (orders || []).find(o => String(o.id) === String(task.order_id)) || allOrdersMap[task.order_id]
            return (
              <MasterActiveTaskCard
                key={task.id}
                task={task}
                order={order}
                nomenclatures={nomenclatures}
                handleReprint={handleReprint}
                isLight={isLight}
              />
            )
          })
        )}
      </div>
    </section>
  )
}

