import React, { useState } from 'react'
import { ArrowLeft, AlertTriangle, CheckCircle2, Package, Layers, ChevronRight, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'

export default function BrakModule() {
  const { inventory, nomenclatures, fetchData, currentUser, disposeScrapItem, createReworkNaryad, productionStages } = useMES()
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [distribution, setDistribution] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 })
  const [viewingCategory, setViewingCategory] = useState(null)
  const [stepToRework, setStepToRework] = useState(null)

  // Reset distribution when selected item changes
  React.useEffect(() => {
    setDistribution({ 1: 0, 2: 0, 3: 0, 4: 0 })
  }, [selectedItem])

  const totalDistributed = Object.values(distribution).reduce((a, b) => a + b, 0)
  const remainingInBatch = selectedItem ? Number(selectedItem.total_qty) - totalDistributed : 0

  // Filter for items ready for classification
  const readyItems = (inventory || []).filter(i => i.type === 'scrap_ready')
  
  // Stats for categorized scrap
  const categorizedStats = {
    cat1: (inventory || []).filter(i => i.type === 'scrap_cat_1').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
    cat2: (inventory || []).filter(i => i.type === 'scrap_cat_2').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
    cat3: (inventory || []).filter(i => i.type === 'scrap_cat_3').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
    cat4: (inventory || []).filter(i => i.type === 'scrap_cat_4').reduce((a, b) => a + (Number(b.total_qty) || 0), 0),
  }

  const itemsInCat = viewingCategory 
    ? (inventory || []).filter(i => i.type === `scrap_cat_${viewingCategory}`)
    : []

  const handleBulkClassify = async () => {
    if (!selectedItem || totalDistributed <= 0) return
    if (totalDistributed > Number(selectedItem.total_qty)) {
      alert('Розподілено більше ніж є в наявності!')
      return
    }

    setIsProcessing(true)
    try {
      const categoriesToProcess = Object.entries(distribution).filter(([_, qty]) => Number(qty) > 0)
      
      for (const [cat, qty] of categoriesToProcess) {
        const type = `scrap_cat_${cat}`
        const numQty = Number(qty)
        
        const { data: existing } = await supabase.from('inventory')
          .select('*')
          .eq('nomenclature_id', selectedItem.nomenclature_id)
          .eq('type', type)
          .maybeSingle()
          
        if (existing) {
          await supabase.from('inventory').update({
            total_qty: (Number(existing.total_qty) || 0) + numQty,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id)
        } else {
          await supabase.from('inventory').insert([{
            nomenclature_id: selectedItem.nomenclature_id,
            name: selectedItem.name,
            unit: selectedItem.unit || 'шт',
            total_qty: numQty,
            type: type,
            updated_at: new Date().toISOString()
          }])
        }
      }
      
      const absoluteRemaining = Number(selectedItem.total_qty) - totalDistributed
      if (absoluteRemaining > 0) {
        await supabase.from('inventory').update({
          total_qty: absoluteRemaining,
          updated_at: new Date().toISOString()
        }).eq('id', selectedItem.id)
        
        setSelectedItem({ ...selectedItem, total_qty: absoluteRemaining })
      } else {
        await supabase.from('inventory').delete().eq('id', selectedItem.id)
        setSelectedItem(null)
      }
      
      await fetchData()
    } catch (e) {
      alert('Помилка при класифікації: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDispose = async (item) => {
    if (!window.confirm(`Ви дійсно хочете списати ${item.total_qty} шт ${item.name}?`)) return
    setIsProcessing(true)
    await disposeScrapItem(item.id, item.total_qty)
    setIsProcessing(false)
  }

  const handleRework = async (item, stage) => {
    setIsProcessing(true)
    await createReworkNaryad(item.id, item.total_qty, stage)
    setStepToRework(null)
    setIsProcessing(false)
    alert(`Створено незалежний наряд на ${stage} для ${item.total_qty} шт.`)
  }

  return (
    <div style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <nav style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '0 25px', height: '75px', background: '#000', borderBottom: '1px solid #1a1a1a', flexShrink: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span>Назад</span>
          </Link>
          <div style={{ width: '2px', height: '24px', background: '#1a1a1a' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle color="#ef4444" size={22} />
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.5px' }}>Круте управління БРАКОМ</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', fontWeight: 900 }}>Класифікатор</div>
          </div>
        </div>
      </nav>

      <div style={{ flex: 1, padding: '30px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Stats Dashboard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {[
            { cat: 1, label: 'Категорія 1', val: categorizedStats.cat1, color: '#10b981', desc: 'Мінімальний брак' },
            { cat: 2, label: 'Категорія 2', val: categorizedStats.cat2, color: '#eab308', desc: 'Середній брак' },
            { cat: 3, label: 'Категорія 3', val: categorizedStats.cat3, color: '#f97316', desc: 'Серйозний брак' },
            { cat: 4, label: 'Категорія 4', val: categorizedStats.cat4, color: '#ef4444', desc: 'Критичний брак' },
          ].map(s => (
            <div key={s.label} 
              onClick={() => {
                setViewingCategory(s.cat === viewingCategory ? null : s.cat)
                setSelectedItem(null)
              }}
              className="glass-panel" 
              style={{ 
                background: viewingCategory === s.cat ? `${s.color}10` : 'rgba(20,20,20,0.6)', 
                borderRadius: '24px', padding: '24px', cursor: 'pointer',
                borderLeft: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderRight: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderBottom: `1px solid ${viewingCategory === s.cat ? s.color : s.color + '15'}`, 
                borderTop: `4px solid ${s.color}`,
                transition: 'all 0.3s ease'
              }}>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{s.label}</div>
              <div style={{ fontSize: '2.4rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{s.val} <small style={{ fontSize: '0.9rem', opacity: 0.3 }}>шт</small></div>
              <div style={{ fontSize: '0.65rem', color: '#444', marginTop: '10px', fontWeight: 600 }}>{s.desc}</div>
              {viewingCategory === s.cat && <div style={{ marginTop: '15px', fontSize: '0.6rem', color: s.color, fontWeight: 900 }}>ВІДКРИТО ДЕТАЛЬНИЙ ПЕРЕГЛЯД ↓</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px' }}>
          
          {/* List of Pending Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 950 }}>
                {viewingCategory ? `Деталі Категорії ${viewingCategory}` : 'Черга на класифікацію'}
              </h2>
              <div style={{ background: viewingCategory ? '#444' : '#ef444415', padding: '6px 14px', borderRadius: '10px', color: viewingCategory ? '#fff' : '#ef4444', fontSize: '0.75rem', fontWeight: 1000 }}>
                {viewingCategory ? `${itemsInCat.length} ПОЗИЦІЙ` : `${readyItems.length} ПОЗИЦІЙ`}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!viewingCategory && readyItems.length === 0) && (
                <div style={{ 
                  background: '#0a0a0a', border: '2px dashed #1a1a1a', borderRadius: '24px', 
                  padding: '60px 40px', textAlign: 'center', color: '#444' 
                }}>
                  <CheckCircle2 size={48} style={{ opacity: 0.1, marginBottom: '20px' }} />
                  <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem' }}>Поки що браку немає</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>Як тільки Майстер перенесе брак з прийомки, він з'явиться тут</div>
                </div>
              )}

              {viewingCategory && itemsInCat.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#444', background: '#0a0a0a', borderRadius: '20px' }}>
                  Ця категорія порожня
                </div>
              )}

              {/* RENDER LIST: Either classifications OR category details */}
              {viewingCategory ? (
                itemsInCat.map(item => (
                  <div key={item.id} style={{ 
                    background: '#111', borderRadius: '20px', padding: '20px', border: '1px solid #1a1a1a',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '2px' }}>{item.name}</div>
                      <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800 }}>Обліковується як: {item.type}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                       <div style={{ textAlign: 'right', marginRight: '10px' }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 1000 }}>{item.total_qty} <small style={{ fontSize: '0.7rem', opacity: 0.3 }}>шт</small></div>
                       </div>
                       {viewingCategory === 4 ? (
                         <button 
                           onClick={() => handleDispose(item)}
                           style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                         >СПИСАТИ</button>
                       ) : (
                         <div style={{ position: 'relative' }}>
                            <button 
                              onClick={() => setStepToRework(stepToRework === item.id ? null : item.id)}
                              style={{ background: '#10b981', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '12px', fontWeight: 900, fontSize: '0.75rem', cursor: 'pointer' }}
                            >НА ДОВЕДЕННЯ</button>
                            
                            {stepToRework === item.id && (
                              <div style={{ position: 'absolute', right: 0, top: '45px', background: '#000', border: '1px solid #222', borderRadius: '12px', padding: '10px', minWidth: '180px', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: '8px', fontWeight: 900 }}>ОБЕРІТЬ ЕТАП:</div>
                                {productionStages.map(s => (
                                  <div key={s} 
                                    onClick={() => handleRework(item, s)}
                                    style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderRadius: '8px', transition: '0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >{s}</div>
                                ))}
                              </div>
                            )}
                         </div>
                       )}
                    </div>
                  </div>
                ))
              ) : (
                readyItems.map(item => {
                  const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                  const isActive = selectedItem?.id === item.id
                  return (
                    <div key={item.id} 
                      onClick={() => setSelectedItem(item)}
                      style={{ 
                        background: isActive ? 'rgba(239, 68, 68, 0.05)' : '#111', 
                        borderRadius: '20px', padding: '20px', cursor: 'pointer',
                        border: `1px solid ${isActive ? '#ef444450' : '#1a1a1a'}`,
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transform: isActive ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: isActive ? '0 10px 30px rgba(239, 68, 68, 0.1)' : 'none'
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ 
                          background: '#000', width: '50px', height: '50px', borderRadius: '14px', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' 
                         }}>
                          <Package size={22} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '2px' }}>{nom?.name || item.name}</div>
                          <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800 }}>Отримано: {new Date(item.updated_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#fff' }}>{item.total_qty} <small style={{ fontSize: '0.7rem', opacity: 0.3 }}>шт</small></div>
                        {!isActive && <div style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 1000, textTransform: 'uppercase', marginTop: '5px' }}>Натисніть для класифікації</div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Classification Action Panel */}
          <div>
            <div style={{ position: 'sticky', top: '30px' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: '1.4rem', fontWeight: 950 }}>{viewingCategory ? 'Довідка' : 'Обробка деталі'}</h2>
              
              <div style={{ 
                background: 'linear-gradient(145deg, #111 0%, #0a0a0a 100%)', 
                borderRadius: '30px', padding: '35px', border: '1px solid #1a1a1a', minHeight: '400px',
                display: 'flex', flexDirection: 'column', justifyContent: (selectedItem || viewingCategory) ? 'flex-start' : 'center',
                alignItems: (selectedItem || viewingCategory) ? 'stretch' : 'center', textAlign: (selectedItem || viewingCategory) ? 'left' : 'center'
              }}>
                {viewingCategory && !selectedItem && (
                   <div style={{ textAlign: 'center' }}>
                      <div style={{ width: '80px', height: '80px', background: '#111', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 25px', color: '#666' }}>
                        <Layers size={40} />
                      </div>
                      <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem', marginBottom: '10px' }}>Аналіз Категорії {viewingCategory}</div>
                      <p style={{ color: '#555', fontSize: '0.8rem', lineHeight: 1.5 }}>
                        {viewingCategory === 4 
                          ? 'У цій категорії знаходиться безнадійний брак. Ви можете списати ці деталі, і вони будуть назавжди враховані як збитки у відповідному документі.' 
                          : 'Деталі у цій категорії підлягають доведенню до ладу. Ви можете створити наряд, який запустить ці деталі знову в роботу, а по завершенню вони потраплять на склад БЗ.'}
                      </p>
                      <button 
                        onClick={() => setViewingCategory(null)}
                        style={{ marginTop: '30px', background: 'transparent', border: '1px solid #222', color: '#94a3b8', padding: '12px 25px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' }}
                      >ПОВЕРНУТИСЬ ДО КЛАСИФІКАЦІЇ</button>
                   </div>
                )}

                {!selectedItem && !viewingCategory && (
                  <>
                    <div style={{ width: '80px', height: '80px', background: '#111', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '25px', color: '#222' }}>
                      <Info size={40} />
                    </div>
                    <div style={{ color: '#333', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>Оберіть деталь з черги</div>
                    <p style={{ color: '#222', fontSize: '0.75rem', marginTop: '10px', maxWidth: '240px' }}>Кожна деталь браку має бути присвоєна певній категорії для коректного обліку та аналітики</p>
                  </>
                )}

                {selectedItem && (
                  <>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
                       <div style={{ background: '#000', width: '64px', height: '64px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                          <AlertTriangle size={32} />
                       </div>
                       <div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 1000, lineHeight: 1.1 }}>{selectedItem.name}</div>
                          <div style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 1000, marginTop: '8px' }}>
                            {selectedItem.total_qty} шт до розподілу
                          </div>
                       </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '25px', marginBottom: '30px', border: '1px solid #1a1a1a' }}>
                        <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginBottom: '20px' }}>РОЗПОДІЛ ЗА КАТЕГОРІЯМИ:</div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                          {[
                            { cat: 1, label: 'Категорія 1', color: '#10b981', desc: 'Мінімальний брак (можна виправити)' },
                            { cat: 2, label: 'Категорія 2', color: '#eab308', desc: 'Середній брак (переробка)' },
                            { cat: 3, label: 'Категорія 3', color: '#f97316', desc: 'Серйозний брак (геометрія)' },
                            { cat: 4, label: 'Категорія 4', color: '#ef4444', desc: 'Критичний брак (брухт)' },
                          ].map(c => (
                            <div key={c.cat} style={{ 
                              background: '#0a0a0a', 
                              borderLeft: '1px solid #1a1a1a', 
                              borderRight: '1px solid #1a1a1a', 
                              borderBottom: '1px solid #1a1a1a', 
                              borderRadius: '18px', padding: '15px 20px', 
                              display: 'flex', alignItems: 'center', gap: '15px', 
                              position: 'relative', overflow: 'hidden' 
                            }}>
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: c.color }}></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 1000, color: c.color }}>{c.label}</div>
                                  <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 600 }}>{c.desc}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   <button 
                                     onClick={() => setDistribution(prev => ({ ...prev, [c.cat]: Math.max(0, prev[c.cat] - 1) }))}
                                     style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#111', border: '1px solid #222', color: '#fff', cursor: 'pointer' }}
                                   >-</button>
                                   <input 
                                      type="number"
                                      value={distribution[c.cat] || ''}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0
                                        setDistribution(prev => ({ ...prev, [c.cat]: Math.max(0, val) }))
                                      }}
                                      placeholder="0"
                                      style={{ width: '50px', textAlign: 'center', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', fontWeight: 1000, outline: 'none' }}
                                   />
                                   <button 
                                     onClick={() => setDistribution(prev => ({ ...prev, [c.cat]: prev[c.cat] + 1 }))}
                                     style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#111', border: '1px solid #222', color: '#fff', cursor: 'pointer' }}
                                   >+</button>
                                </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ 
                          marginTop: '25px', padding: '15px', borderRadius: '15px', background: '#000', border: '1px solid #222',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                           <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#444' }}>ВИБРАНО: <span style={{ color: remainingInBatch < 0 ? '#ef4444' : '#fff' }}>{totalDistributed} / {selectedItem.total_qty}</span></div>
                           <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#444' }}>ЗАЛИШОК: <span style={{ color: remainingInBatch < 0 ? '#ef4444' : '#10b981' }}>{remainingInBatch} шт</span></div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        disabled={isProcessing || totalDistributed <= 0 || remainingInBatch < 0}
                        onClick={handleBulkClassify}
                        style={{ flex: 2, background: '#8b5cf6', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: 1000, cursor: 'pointer', opacity: (totalDistributed <= 0 || remainingInBatch < 0) ? 0.3 : 1 }}
                      >
                        {isProcessing ? 'ОБРОБКА...' : 'ПІДТВЕРДИТИ РОЗПОДІЛ'}
                      </button>
                      <button 
                        onClick={() => setSelectedItem(null)}
                        style={{ flex: 1, background: 'transparent', border: '1px solid #222', color: '#444', padding: '15px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        СКАСУВАТИ
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { backdrop-filter: blur(10px); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}} />
    </div>
  )
}
