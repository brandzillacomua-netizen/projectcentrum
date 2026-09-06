import React from 'react'
import { Package, ClipboardList, AlertTriangle, X } from 'lucide-react'

export function Shop1StorageExplorerModal({
  showStorageExplorer,
  onClose,
  activeExplorerTab,
  setActiveExplorerTab,
  workCards = [],
  inventory = [],
  nomenclatures = [],
  getNom,
  isBulkMoving,
  setIsBulkMoving,
  movingScrapIds = new Set(),
  setMovingScrapIds,
  fetchData,
  supabase
}) {
  if (!showStorageExplorer) return null

  const explorerTabs = [
    { id: 'reception', label: 'ПРИЙОМКА', icon: <Package size={16} />, color: '#3b82f6' },
    { id: 'sorting', label: 'СОРТУВАННЯ', icon: <ClipboardList size={16} />, color: '#8b5cf6' },
    { id: 'scrap', label: 'БРАК / ВІДХОДИ', icon: <AlertTriangle size={16} />, color: '#ef4444' },
  ]

  let filteredItems = []

  if (activeExplorerTab === 'reception') {
    // Get cards at operation 'Прийомка' in status 'at-buffer' or 'in-progress'
    const receptionCards = (workCards || []).filter(c => {
      const nom = getNom ? getNom(c) : nomenclatures.find(n => n.id === c.nomenclature_id)
      if (nom && nom.type && nom.type !== 'part') return false
      return c.operation === 'Прийомка' && (c.status === 'at-buffer' || c.status === 'in-progress')
    })
    // Group by nomenclature
    const grouped = receptionCards.reduce((acc, card) => {
      const nomId = card.nomenclature_id
      if (!acc[nomId]) {
        const nom = nomenclatures.find(n => n.id === nomId)
        acc[nomId] = {
          id: `reception-${nomId}`,
          nomenclature_id: nomId,
          name: nom?.name || '—',
          unit: nom?.unit || 'од',
          total_qty: 0,
          updated_at: card.updated_at || card.created_at || new Date().toISOString(),
          type: 'reception'
        }
      }
      acc[nomId].total_qty += Number(card.quantity) || 0
      const cardTime = new Date(card.updated_at || card.created_at || 0)
      if (cardTime > new Date(acc[nomId].updated_at)) {
        acc[nomId].updated_at = card.updated_at || card.created_at
      }
      return acc
    }, {})
    filteredItems = Object.values(grouped)
  } else if (activeExplorerTab === 'sorting') {
    // Get cards at operation 'Сортування' in status 'at-buffer' or 'in-progress'
    const sortingCards = (workCards || []).filter(c => {
      const nom = getNom ? getNom(c) : nomenclatures.find(n => n.id === c.nomenclature_id)
      if (nom && nom.type && nom.type !== 'part') return false
      return c.operation === 'Сортування' && (c.status === 'at-buffer' || c.status === 'in-progress')
    })
    // Group by nomenclature
    const grouped = sortingCards.reduce((acc, card) => {
      const nomId = card.nomenclature_id
      if (!acc[nomId]) {
        const nom = nomenclatures.find(n => n.id === nomId)
        acc[nomId] = {
          id: `sorting-${nomId}`,
          nomenclature_id: nomId,
          name: nom?.name || '—',
          unit: nom?.unit || 'од',
          total_qty: 0,
          updated_at: card.updated_at || card.created_at || new Date().toISOString(),
          type: 'sorting'
        }
      }
      acc[nomId].total_qty += Number(card.quantity) || 0
      const cardTime = new Date(card.updated_at || card.created_at || 0)
      if (cardTime > new Date(acc[nomId].updated_at)) {
        acc[nomId].updated_at = card.updated_at || card.created_at
      }
      return acc
    }, {})
    filteredItems = Object.values(grouped)
  } else {
    filteredItems = (inventory || []).filter(i => {
      const nom = nomenclatures.find(n => n.id === i.nomenclature_id)
      if (nom && nom.type && nom.type !== 'part') return false
      return i.type === activeExplorerTab
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a0a0a', display: 'flex', flexDirection: 'column', height: '100%', paddingTop: '75px' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#3b82f620', padding: '8px', borderRadius: '10px' }}><Package size={20} color="#3b82f6" /></div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 1000 }}>ХАБ-СКЛАД ЦЕХУ 1</h2>
            <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800, textTransform: 'uppercase' }}>Моніторинг деталей на прийомці, сортуванні та складі</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: '#1a1a1a', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', padding: '15px 20px', background: '#0d0d0d', overflowX: 'auto' }}>
        {explorerTabs.map(t => (
          <button key={t.id} onClick={() => setActiveExplorerTab(t.id)}
            style={{
              flex: 1, minWidth: '110px', background: activeExplorerTab === t.id ? t.color : '#0a0a0a',
              color: activeExplorerTab === t.id ? '#000' : '#444', border: 'none',
              padding: '12px', borderRadius: '12px', fontWeight: 900, fontSize: '0.65rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s', cursor: 'pointer'
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeExplorerTab === 'scrap' && filteredItems.filter(i => Number(i.total_qty) > 0).length > 0 && (
        <div style={{ padding: '0 20px 20px' }}>
          <button
            onClick={async () => {
              const scrapItemsToMove = filteredItems.filter(i => Number(i.total_qty) > 0)
              if (!window.confirm(`Перенести всі позиції (${scrapItemsToMove.length}) у розділ БРАК?`)) return
              setIsBulkMoving(true)
              try {
                await Promise.all(scrapItemsToMove.map(async (item) => {
                  const { data: historyToArchive } = await supabase.from('work_card_history')
                    .select('id')
                    .eq('nomenclature_id', item.nomenclature_id)
                    .eq('is_archived_scrap', false)
                    .gt('scrap_qty', 0);
                    
                  if (historyToArchive && historyToArchive.length > 0) {
                    await supabase.from('work_card_history')
                      .update({ is_archived_scrap: true })
                      .in('id', historyToArchive.map(h => h.id));
                  }
                  
                  await supabase.from('inventory').delete().eq('id', item.id);
                }))
                fetchData && fetchData('inventory').catch(() => {})
              } catch (e) { alert('Помилка: ' + e.message) }
              finally { setIsBulkMoving(false) }
            }}
            disabled={isBulkMoving}
            style={{
              width: '100%', background: '#ef4444', color: '#000', border: 'none',
              padding: '16px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 1000,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '10px', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.2)'
            }}>
            <AlertTriangle size={18} /> {isBulkMoving ? 'ПЕРЕНЕСЕННЯ...' : `ПЕРЕНЕСТИ ВСІ ПОЗИЦІЇ (${filteredItems.filter(i => Number(i.total_qty) > 0).length}) В РОЗДІЛ БРАК`}
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
          {Object.values(filteredItems.reduce((acc, item) => {
            if (!acc[item.nomenclature_id]) {
              acc[item.nomenclature_id] = { ...item }
            } else {
              acc[item.nomenclature_id].total_qty = (Number(acc[item.nomenclature_id].total_qty) || 0) + (Number(item.total_qty) || 0)
              if (new Date(item.updated_at) > new Date(acc[item.nomenclature_id].updated_at)) {
                acc[item.nomenclature_id].updated_at = item.updated_at
              }
            }
            return acc
          }, {})).filter(item => Number(item.total_qty) > 0).map(item => {
            const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
            return (
              <div key={item.id} style={{ background: '#111', borderRadius: '18px', padding: '18px', border: '1px solid #1a1a1a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '2px' }}>{nom?.name || item.name}</div>
                    <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 900 }}>{item.unit || 'од'} | {new Date(item.updated_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: explorerTabs.find(t => t.id === activeExplorerTab)?.color }}>{item.total_qty}</div>
                    <div style={{ fontSize: '0.5rem', color: '#333', fontWeight: 900 }}>
                      {activeExplorerTab === 'reception' ? 'В ПРИЙОМЦІ' : activeExplorerTab === 'sorting' ? 'СОРТУВАННЯ' : 'ЗАЛИШОК'}
                    </div>
                  </div>
                </div>

                {item.type === 'scrap' && (
                  <button
                    onClick={async () => {
                      setMovingScrapIds && setMovingScrapIds(prev => new Set([...prev, item.id]))
                      try {
                        const { data: historyToArchive } = await supabase.from('work_card_history')
                          .select('id')
                          .eq('nomenclature_id', item.nomenclature_id)
                          .eq('is_archived_scrap', false)
                          .gt('scrap_qty', 0);
                          
                        if (historyToArchive && historyToArchive.length > 0) {
                          await supabase.from('work_card_history')
                            .update({ is_archived_scrap: true })
                            .in('id', historyToArchive.map(h => h.id));
                        }
                        
                        await supabase.from('inventory').delete().eq('id', item.id);
                        fetchData && fetchData('inventory').catch(() => {})
                      } catch (e) { alert('Помилка: ' + e.message) }
                      finally { setMovingScrapIds && setMovingScrapIds(prev => { const next = new Set(prev); next.delete(item.id); return next }) }
                    }}
                    disabled={movingScrapIds.has(item.id) || isBulkMoving}
                    style={{
                      width: '100%', background: '#ef444415', border: '1px solid #ef444430',
                      color: '#ef4444', padding: '10px', borderRadius: '10px',
                      fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      opacity: (movingScrapIds.has(item.id) || isBulkMoving) ? 0.5 : 1
                    }}>
                    {movingScrapIds.has(item.id) ? 'Перенесення...' : '⚡ ПЕРЕНЕСТИ В РОЗДІЛ БРАК'}
                  </button>
                )}
              </div>
            )
          })}
          {filteredItems.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#222' }}>
              <Package size={48} style={{ marginBottom: '15px', opacity: 0.1 }} />
              <div style={{ fontWeight: 800 }}>ПОЗИЦІЙ НЕ ЗНАЙДЕНО</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
