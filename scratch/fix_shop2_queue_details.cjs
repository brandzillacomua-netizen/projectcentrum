const fs = require('fs');

const filePath = 'a:/centrum/src/modules/Shop2Module.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `<div style={{ fontSize: '0.75rem', color: isCompleted ? '#222' : '#555', marginTop: '4px' }}>{order?.customer}</div>`;

const replacement = `{(() => {
                    const snap = task.plan_snapshot || {}
                    // Визначаємо назву виробу
                    const prodName = (order?.order_items || [])
                      .map(it => (nomenclatures || []).find(n => n.id === it.nomenclature_id)?.name)
                      .filter(Boolean)
                      .join(', ') || '—'
                    
                    // Сумуємо потребу деталей
                    const totalQty = Object.values(snap)
                      .filter(v => v && typeof v === 'object' && v.need)
                      .reduce((s, v) => s + (Number(v.need) || 0), 0)

                    return (
                      <div style={{ marginTop: '6px', borderTop: '1px dashed #222', paddingTop: '6px' }}>
                        {order?.customer && (
                          <div style={{ fontSize: '0.75rem', color: isCompleted ? '#333' : '#a1a1aa', fontWeight: 700 }}>
                            {order.customer}
                          </div>
                        )}
                        {prodName !== '—' && (
                          <div style={{ fontSize: '0.72rem', color: isCompleted ? '#2a2a2a' : '#71717a', marginTop: '2px', fontWeight: 600 }}>
                            Виріб: <span style={{ color: isCompleted ? '#444' : '#fff' }}>{prodName}</span>
                          </div>
                        )}
                        {totalQty > 0 && (
                          <div style={{ fontSize: '0.72rem', color: isCompleted ? '#2a2a2a' : '#71717a', marginTop: '2px', fontWeight: 600 }}>
                            Кількість: <span style={{ color: '#8b5cf6', fontWeight: 900 }}>{totalQty} шт</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Shop2Module.jsx queue list info updated successfully!');
} else {
  console.log('❌ Could not find queue customer node in file!');
}
