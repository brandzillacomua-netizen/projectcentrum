import React from 'react'
import { ListChecks, Search, Printer, Trash2 } from 'lucide-react'

const MasterOrderCard = React.memo(({
  order,
  isLight,
  setQuickPlanOrder,
  getPlannedQty,
  setTempSets,
  setTempDeadline,
  handleDeleteOrder,
  tasks,
  nomenclatures
}) => {
  const orderTasks = React.useMemo(() => {
    return (tasks || []).filter(t => String(t.order_id) === String(order.id));
  }, [tasks, order.id]);

  const uniqueBatches = React.useMemo(() => {
    if (orderTasks.length === 0) return null;
    const batches = {};
    orderTasks.forEach(t => {
      const idx = t.batch_index || '1';
      if (!batches[idx]) {
        batches[idx] = { index: idx, isAllCompleted: true };
      }
      if (t.status !== 'completed') {
        batches[idx].isAllCompleted = false;
      }
    });
    return Object.values(batches).sort((a, b) => Number(a.index) - Number(b.index));
  }, [orderTasks]);

  const handleOpenPlan = () => {
    setQuickPlanOrder(order);
    const maxRem = Math.max(...(order.order_items?.map(it => Number(it.quantity) - getPlannedQty(it.id)) || [0]));
    setTempSets(maxRem);
    setTempDeadline(order.deadline || '');
  };

  return (
    <div 
      className="order-p-card glass-panel" 
      style={{ 
        background: isLight ? '#ffffff' : '#0a0a0a', 
        padding: '16px', 
        borderRadius: '16px', 
        border: isLight ? '1px solid #e2e8f0' : '1px solid #222222', 
        position: 'relative', 
        overflow: 'hidden',
        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.04)' : 'none'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ff9000' }}></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <strong
            onClick={handleOpenPlan}
            className="interactive-naryad-title"
            style={{ fontSize: '1.15rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            №{order.order_num}
          </strong>
          <span style={{ fontSize: '0.65rem', color: isLight ? '#94a3b8' : '#666666', fontWeight: 700 }}>
            {order.order_date ? new Date(order.order_date).toLocaleDateString('uk-UA') : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={handleOpenPlan}
            style={{ 
              background: isLight ? '#ffedd5' : 'rgba(255,144,0,0.1)', 
              border: isLight ? '1px solid #fed7aa' : '1px solid rgba(255,144,0,0.2)', 
              color: isLight ? '#ea580c' : '#ff9000', 
              cursor: 'pointer', 
              padding: '6px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              transition: 'all 0.2s' 
            }}
            title="Відкрити наряд"
          >
            <Printer size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteOrder(order.id, order.order_num);
            }}
            style={{ 
              background: 'rgba(239,68,68,0.1)', 
              border: '1px solid rgba(239,68,68,0.2)', 
              color: '#ef4444', 
              cursor: 'pointer', 
              padding: '6px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              transition: 'all 0.2s' 
            }}
            title="Видалити/Закрити замовлення"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.8rem', color: isLight ? '#475569' : '#cccccc', fontWeight: 700, marginBottom: '12px' }}>{order.customer}</div>

      <div style={{ 
        marginBottom: '12px', 
        background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', 
        padding: '10px', 
        borderRadius: '10px', 
        border: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a' 
      }}>
        {order.order_items?.map(it => {
          const planned = getPlannedQty(it.id)
          const total = Number(it.quantity)
          const nom = (nomenclatures || []).find(n => n.id === it.nomenclature_id)
          return (
            <div key={it.id} style={{ fontSize: '0.72rem', color: planned >= total ? '#16a34a' : (isLight ? '#0f172a' : '#ffffff'), display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
              <span style={{ maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nom?.name}:</span>
              <span style={{ fontWeight: 800 }}>{planned} / {total} шт</span>
            </div>
          )
        })}
      </div>

      {uniqueBatches && (
        <div style={{ 
          marginBottom: '12px', 
          padding: '8px', 
          background: isLight ? '#f8fafc' : 'rgba(255,255,255,0.02)', 
          borderRadius: '10px', 
          border: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a' 
        }}>
          <div style={{ fontSize: '0.6rem', color: isLight ? '#64748b' : '#666666', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>Вже в роботі:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {uniqueBatches.map(b => (
              <span key={b.index} style={{
                fontSize: '0.65rem',
                padding: '3px 6px',
                background: b.isAllCompleted ? (isLight ? '#dcfce7' : 'rgba(16, 185, 129, 0.1)') : (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.05)'),
                color: b.isAllCompleted ? (isLight ? '#15803d' : '#10b981') : (isLight ? '#475569' : '#aaaaaa'),
                borderRadius: '6px',
                border: b.isAllCompleted ? (isLight ? '1px solid #bbf7d0' : '1px solid rgba(16, 185, 129, 0.2)') : (isLight ? '1px solid #cbd5e1' : '1px solid #222222'),
                fontWeight: 800
              }}>
                ПАРТІЯ /{b.index}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleOpenPlan}
        style={{ 
          width: '100%', 
          padding: '10px', 
          background: '#ff9000', 
          color: '#ffffff', 
          border: 'none', 
          borderRadius: '10px', 
          fontWeight: 900, 
          cursor: 'pointer', 
          fontSize: '0.8rem', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px' 
        }}
      >
        Сформувати наряд
      </button>
    </div>
  )
})

export function MasterOrderQueueList({
  filteredPending = [],
  searchQuery = '',
  setSearchQuery,
  setShowPrepModal,
  handleOpenCustomVirtualNaryad,
  setQuickPlanOrder,
  getPlannedQty,
  setTempSets,
  setTempDeadline,
  handleDeleteOrder,
  tasks = [],
  nomenclatures = [],
  theme = 'light'
}) {
  const isLight = theme === 'light'

  return (
    <section className="grid-col">
      {/* HEADER TITLE */}
      <h3 style={{ fontSize: '0.85rem', color: isLight ? '#0f172a' : '#ffffff', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 900, textTransform: 'uppercase' }}>
        <ListChecks size={16} /> ЧЕРГА ЗАМОВЛЕНЬ {filteredPending.length > 0 && `(${filteredPending.length})`}
      </h3>

      {/* TWO ACTION BUTTONS SIDE BY SIDE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={() => setShowPrepModal(true)}
          style={{ 
            background: '#00b894', 
            color: '#ffffff', 
            border: 'none', 
            padding: '8px 4px', 
            borderRadius: '8px', 
            fontSize: '0.7rem', 
            fontWeight: 900, 
            cursor: 'pointer',
            textAlign: 'center',
            lineHeight: 1.2
          }}
        >
          НАРЯД НА ПІДГОТОВКУ
        </button>
        <button
          onClick={handleOpenCustomVirtualNaryad}
          style={{ 
            background: '#ff9000', 
            color: '#ffffff', 
            border: 'none', 
            padding: '8px 4px', 
            borderRadius: '8px', 
            fontSize: '0.7rem', 
            fontWeight: 900, 
            cursor: 'pointer',
            textAlign: 'center',
            lineHeight: 1.2
          }}
        >
          ВЛАСНА РОБОЧА КАРТКА
        </button>
      </div>

      {/* FULL WIDTH SEARCH INPUT */}
      <div style={{ position: 'relative', marginBottom: '15px' }}>
        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: isLight ? '#94a3b8' : '#64748b' }} />
        <input 
          style={{ 
            width: '100%', 
            background: isLight ? '#ffffff' : '#000000', 
            border: isLight ? '1px solid #cbd5e1' : '1px solid #222222', 
            borderRadius: '20px', 
            padding: '6px 12px 6px 30px', 
            color: isLight ? '#0f172a' : '#ffffff', 
            fontSize: '0.75rem',
            outline: 'none',
            boxSizing: 'border-box'
          }} 
          placeholder="Пошук..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
        />
      </div>

      {/* QUEUE CARDS */}
      <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredPending.length === 0 ? (
          <div style={{ 
            padding: '25px', 
            background: isLight ? '#ffffff' : '#0a0a0a', 
            border: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a', 
            borderRadius: '16px', 
            color: isLight ? '#64748b' : '#555555', 
            textAlign: 'center', 
            fontSize: '0.8rem' 
          }}>
            Немає замовлень у черзі
          </div>
        ) : (
          filteredPending.map(order => (
            <MasterOrderCard
              key={order.id}
              order={order}
              isLight={isLight}
              setQuickPlanOrder={setQuickPlanOrder}
              getPlannedQty={getPlannedQty}
              setTempSets={setTempSets}
              setTempDeadline={setTempDeadline}
              handleDeleteOrder={handleDeleteOrder}
              tasks={tasks}
              nomenclatures={nomenclatures}
            />
          ))
        )}
      </div>
    </section>
  )
}

