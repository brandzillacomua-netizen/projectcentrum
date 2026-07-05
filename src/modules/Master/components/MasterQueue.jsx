import React from 'react'
import { ListChecks, Search, Printer } from 'lucide-react'

export function MasterQueue({
  filteredPending,
  searchQuery,
  setSearchQuery,
  setShowPrepModal,
  handleOpenCustomVirtualNaryad,
  setQuickPlanOrder,
  setTempSets,
  setTempDeadline,
  getPlannedQty,
  nomenclatures,
  tasks,
  orders
}) {
  return (
    <section className="grid-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ fontSize: '0.85rem', color: '#555', margin: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListChecks size={16} /> ЧЕРГА ЗАМОВЛЕНЬ
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowPrepModal(true)}
            style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
          >
            НАРЯД НА ПІДГОТОВКУ
          </button>
          <button
            onClick={handleOpenCustomVirtualNaryad}
            style={{ background: '#ff9000', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
          >
            ВЛАСНА РОБОЧА КАРТКА
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
          <input 
            style={{ background: '#000', border: '1px solid #222', borderRadius: '8px', padding: '4px 8px 4px 25px', color: '#fff', fontSize: '0.75rem', width: '110px' }} 
            placeholder="Пошук..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
      </div>

      <div className="v-stack" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredPending.map(order => (
          <div key={order.id} className="order-p-card glass-panel" style={{ background: '#0a0a0a', padding: '18px', borderRadius: '20px', border: '1px solid #222', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#ff9000' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <strong
                  onClick={() => {
                    setQuickPlanOrder(order);
                    const maxRem = Math.max(...(order.order_items?.map(it => Number(it.quantity) - getPlannedQty(it.id)) || [0]));
                    setTempSets(maxRem);
                    setTempDeadline(order.deadline || '');
                  }}
                  className="interactive-naryad-title"
                  style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  №{order.order_num}
                </strong>
                <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700 }}>
                  {order.order_date ? new Date(order.order_date).toLocaleDateString('uk-UA') : ''}
                </span>
              </div>
              <button
                onClick={() => {
                  setQuickPlanOrder(order);
                  const maxRem = Math.max(...(order.order_items?.map(it => Number(it.quantity) - getPlannedQty(it.id)) || [0]));
                  setTempSets(maxRem);
                  setTempDeadline(order.deadline || '');
                }}
                style={{ background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.2)', color: '#ff9000', cursor: 'pointer', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                title="Відкрити наряд"
              >
                <Printer size={18} />
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ccc', fontWeight: 700, marginBottom: '15px' }}>{order.customer}</div>
            
            <div style={{ marginBottom: '15px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid #1a1a1a' }}>
              {order.order_items?.map(it => {
                const planned = getPlannedQty(it.id)
                const total = Number(it.quantity)
                const nom = nomenclatures.find(n => n.id === it.nomenclature_id)
                return (
                  <div key={it.id} style={{ fontSize: '0.75rem', color: planned >= total ? '#22c55e' : '#fff', display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
                    <span style={{ maxWidth: '75%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nom?.name}:</span>
                    <span style={{ fontWeight: 800 }}>{planned} / {total} шт</span>
                  </div>
                )
              })}
            </div>

            {/* СПИСОК ВЖЕ СТВОРЕНИХ НАРЯДІВ */}
            {(() => {
              const orderTasks = tasks.filter(t => String(t.order_id) === String(order.id));
              if (orderTasks.length === 0) return null;

              const uniqueBatches = {};
              orderTasks.forEach(t => {
                const idx = t.batch_index || '1';
                if (!uniqueBatches[idx]) {
                  uniqueBatches[idx] = {
                    index: idx,
                    isAllCompleted: true
                  };
                }
                if (t.status !== 'completed') {
                  uniqueBatches[idx].isAllCompleted = false;
                }
              });

              return (
                <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid #1a1a1a' }}>
                  <div style={{ fontSize: '0.6rem', color: '#666', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Вже в роботі:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Object.values(uniqueBatches).sort((a, b) => a.index - b.index).map(b => (
                      <span key={b.index} style={{
                        fontSize: '0.7rem',
                        padding: '4px 8px',
                        background: b.isAllCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        color: b.isAllCompleted ? '#10b981' : '#aaa',
                        borderRadius: '6px',
                        border: b.isAllCompleted ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #222',
                        fontWeight: 800
                      }}>
                        ПАРТІЯ /{b.index}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => {
                setQuickPlanOrder(order);
                const maxRem = Math.max(...(order.order_items?.map(it => Number(it.quantity) - getPlannedQty(it.id)) || [0]));
                setTempSets(maxRem);
                setTempDeadline(order.deadline || '');
              }}
              style={{ width: '100%', padding: '12px', background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              Сформувати наряд
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
