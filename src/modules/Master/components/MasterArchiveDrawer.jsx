import React from 'react'
import { CheckCircle2 } from 'lucide-react'

export function MasterArchiveDrawer({
  tasks = [],
  orders = [],
  allOrdersMap = {},
  handleReprint,
  setIsDrawerOpen,
  theme = 'light'
}) {
  const isLight = theme === 'light'
  const archiveTasks = (tasks || []).filter(t => {
    if (t.status !== 'completed' || !t.completed_at) return false
    const d = new Date(t.completed_at)
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    return d >= threeDaysAgo
  });

  if (archiveTasks.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px', color: isLight ? '#64748b' : '#555555', fontSize: '0.75rem' }}>Архів порожній</div>;
  }

  const groups = {};
  archiveTasks.forEach(task => {
    const order = (orders || []).find(o => o.id === task.order_id) || allOrdersMap[task.order_id];
    const key = `${task.order_id}_${task.batch_index || '1'}`;
    if (!groups[key]) {
      groups[key] = {
        orderNum: order?.order_num || (task.plan_snapshot?._prep_num ? task.plan_snapshot._prep_num : '?'),
        customer: order?.customer || '?',
        batchIndex: task.batch_index || '1',
        lastCompletedAt: task.completed_at,
        stages: [],
        task: task
      };
    }
    let shopName = task.step;
    if (task.step?.includes('Розкрій') || task.step?.includes('Різка')) {
      shopName = 'ЦЕХ №1';
    } else if (task.step?.includes('Пресування') || task.step?.includes('№2') || task.step?.includes('Фарбування')) {
      shopName = 'ЦЕХ №2';
    } else if (task.step === 'Підготовка') {
      shopName = 'ПІДГОТОВКА';
    }

    if (!groups[key].stages.includes(shopName)) {
      groups[key].stages.push(shopName);
    }
    if (new Date(task.completed_at) > new Date(groups[key].lastCompletedAt)) {
      groups[key].lastCompletedAt = task.completed_at;
    }
  });

  return (
    <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Object.values(groups).sort((a, b) => new Date(b.lastCompletedAt) - new Date(a.lastCompletedAt)).map((group, gIdx) => (
        <div 
          key={gIdx} 
          style={{ 
            background: isLight ? '#ffffff' : '#0a0a0a', 
            padding: '14px 16px', 
            borderRadius: '14px', 
            border: isLight ? '1px solid #e2e8f0' : '1px solid #1a1a1a', 
            marginBottom: '4px',
            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.03)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', alignItems: 'flex-start' }}>
            <strong
              onClick={() => {
                if (group.task) {
                  handleReprint(group.task);
                  if (setIsDrawerOpen) setIsDrawerOpen(false);
                }
              }}
              className="interactive-naryad-title"
              style={{ fontSize: '0.95rem', color: isLight ? '#0f172a' : '#ffffff', cursor: 'pointer', fontWeight: 900 }}
            >
              №{group.orderNum}/{group.batchIndex}
            </strong>
            <span style={{ fontSize: '0.65rem', color: isLight ? '#94a3b8' : '#64748b', fontWeight: 700 }}>
              {new Date(group.lastCompletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: isLight ? '#64748b' : '#a1a1aa', marginBottom: '8px', fontWeight: 700 }}>
            {group.customer}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {group.stages.map((s, sIdx) => (
              <div key={sIdx} style={{ fontSize: '0.65rem', color: isLight ? '#00b894' : '#10b981', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={11} /> {s}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
