import React, { useState, useMemo } from 'react'
import { Package, ArrowLeft, ClipboardList, CheckCircle2, Box, Send, AlertCircle, Wrench, FileArchive, Zap, ListChecks, Layers, Clock, Scan } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const PackagingModule = () => {
  const { orders, tasks, nomenclatures, bomItems, submitPickingRequest, requests, supabase, fetchData, completePackaging } = useMES()
  const [selectedBatch, setSelectedBatch] = useState(null) // { orderId, batchIndex }
  const [isProcessing, setIsProcessing] = useState(false)

  // 1. ГРУПУЄМО НАРЯДИ ДЛЯ ЧЕРГИ
  const batchList = useMemo(() => {
    // Беремо всі завдання (активні та завершені)
    const relevantTasks = tasks.filter(t => t.status === 'completed' || t.plan_snapshot?._metadata?.is_packaged === true);
    
    const batchGroups = {};
    relevantTasks.forEach(task => {
      const order = orders.find(o => o.id === task.order_id);
      if (!order) return;
      
      const bIdx = task.batch_index || '1';
      const key = `${task.order_id}_${bIdx}`;
      
      if (!batchGroups[key]) {
        batchGroups[key] = {
          key,
          orderId: task.order_id,
          orderNum: order.order_num,
          customer: order.customer,
          batchIndex: bIdx,
          plannedSets: task.planned_sets || 0,
          isPackaged: task.plan_snapshot?._metadata?.is_packaged === true,
          tasks: []
        };
      }
      batchGroups[key].tasks.push(task);
    });

    // Для кожного наряду вираховуємо його статус по складу
    return Object.values(batchGroups).map(batch => {
      // Знаходимо всі BOM елементи для цього наряду
      const batchBOM = [];
      const order = orders.find(o => o.id === batch.orderId);
      order?.order_items?.forEach(item => {
        const children = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id));
        children.forEach(b => {
          const nom = nomenclatures.find(n => String(n.id) === String(b.child_id));
          const nameLower = nom?.name?.toLowerCase() || '';
          if (nom && !(nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка')))) {
            batchBOM.push(nom.id);
          }
        });
      });

      // Знаходимо запити для цього наряду
      const batchReqs = (requests || []).filter(r => 
        String(r.order_id) === String(batch.orderId) && 
        (r.task_id === batch.tasks[0]?.id || r.details?.includes(`/${batch.batchIndex}`))
      );

      let packStatus = 'waiting'; // waiting, processing, ready, completed
      if (batch.isPackaged) {
        packStatus = 'completed';
      } else if (batchReqs.length === 0) {
        packStatus = 'waiting';
      } else {
        const confirmedNoms = new Set(batchReqs.filter(r => r.status === 'completed' || r.status === 'issued').map(r => String(r.nomenclature_id)));
        const allCovered = batchBOM.length > 0 && batchBOM.every(id => confirmedNoms.has(String(id)));
        packStatus = allCovered ? 'ready' : 'processing';
      }

      return { ...batch, packStatus };
    }).sort((a, b) => {
      // Пріоритет: спочатку Ready, потім Processing, потім Waiting, в кінці Completed
      const weights = { ready: 0, processing: 1, waiting: 2, completed: 3 };
      if (weights[a.packStatus] !== weights[b.packStatus]) return weights[a.packStatus] - weights[b.packStatus];
      return b.orderNum.localeCompare(a.orderNum);
    });
  }, [tasks, orders, requests, bomItems, nomenclatures]);

  const activeBatchData = useMemo(() => {
    if (!selectedBatch) return null;
    return batchList.find(b => b.key === selectedBatch.key);
  }, [selectedBatch, batchList]);

  // 2. РОЗРАХУНОК BOM ДЛЯ КОНКРЕТНОГО НАРЯДУ
  const { categorizedBOM, hasBOM } = useMemo(() => {
    if (!activeBatchData) return { categorizedBOM: {}, hasBOM: false };

    const order = orders.find(o => o.id === activeBatchData.orderId);
    if (!order || !order.order_items) return { categorizedBOM: {}, hasBOM: false };

    const map = {};
    let foundAnyBom = false;

    order.order_items.forEach(item => {
      const parentBOM = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id));
      if (parentBOM.length > 0) foundAnyBom = true;

      parentBOM.forEach(b => {
        const nom = nomenclatures.find(n => String(n.id) === String(b.child_id));
        if (nom) {
          // ФІЛЬТРАЦІЯ: Не показуємо прес-гайки в пакуванні (вони йдуть в Цех 2)
          const nameLower = nom.name?.toLowerCase() || '';
          if (nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка'))) return;

          const totalQty = Number(b.quantity_per_parent) * Number(activeBatchData.plannedSets);
          if (!map[nom.id]) {
            map[nom.id] = { nom, qty: 0 };
          }
          map[nom.id].qty += totalQty;
        }
      });
    });

    // Групуємо за категоріями (як у специфікації)
    const categories = {
      sgp: { title: '1. ДЕТАЛІ / ГОТОВІ ВИРОБИ (СГП)', items: [], color: '#f43f5e', icon: <Package size={18} /> },
      hardware: { title: '2. МЕТИЗИ (Гвинти/Гайки)', items: [], color: '#06b6d4', icon: <Wrench size={18} /> },
      spacers: { title: '3. СТІЙКИ', items: [], color: '#8b5cf6', icon: <Layers size={18} /> },
      other: { title: '4. НАКЛАДКИ / ТРИМАЧІ / УПАКОВКА', items: [], color: '#eab308', icon: <FileArchive size={18} /> }
    };

    Object.values(map).forEach(item => {
      const type = (item.nom.type || '').toLowerCase();
      const name = (item.nom.name || '').toLowerCase();
      const code = (item.nom.nomenclature_code || '').toLowerCase();
      
      // 1. ДЕТАЛІ (СГП) - Перевіряємо префікс ІП або тип
      if (name.startsWith('іп-') || code.startsWith('іп-') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) {
        categories.sgp.items.push(item);
      } 
      // 2. СТІЙКИ - Окрема категорія
      else if (name.includes('стійка') || type.includes('стійк')) {
        categories.spacers.items.push(item);
      }
      // 3. МЕТИЗИ
      else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка')) {
        categories.hardware.items.push(item);
      } 
      // 4. ІНШЕ
      else {
        categories.other.items.push(item);
      }
    });

    return { categorizedBOM: categories, hasBOM: foundAnyBom };
  }, [activeBatchData, orders, bomItems, nomenclatures]);

  // 3. ПЕРЕВІРКА ЗАПИТІВ НА СКЛАД ДЛЯ ЦЬОГО НАРЯДУ
  const allBOMItems = useMemo(() => {
    return Object.values(categorizedBOM).flatMap(c => c.items);
  }, [categorizedBOM]);

  const { orderRequests, completedRequestsCount, isReadyToFinalize, hasAnyRequests } = useMemo(() => {
    if (!activeBatchData) return { orderRequests: [], completedRequestsCount: 0, isReadyToFinalize: false, hasAnyRequests: false };
    
    const relevant = (requests || []).filter(r => 
      String(r.order_id) === String(activeBatchData.orderId) && 
      (r.details?.includes(`/${activeBatchData.batchIndex}`) || r.task_id === activeBatchData.tasks[0]?.id)
    );
    
    const confirmedNoms = new Set(
      relevant
        .filter(r => r.status === 'completed' || r.status === 'issued')
        .map(r => String(r.nomenclature_id))
    );

    const is100PercentCovered = allBOMItems.length > 0 && allBOMItems.every(req => confirmedNoms.has(String(req.nom.id)));
    const completedCount = relevant.filter(r => r.status === 'completed' || r.status === 'issued').length;

    return {
      orderRequests: relevant,
      completedRequestsCount: completedCount,
      isReadyToFinalize: is100PercentCovered,
      hasAnyRequests: relevant.length > 0
    };
  }, [activeBatchData, requests, allBOMItems]);

  const handleCreateRequest = async () => {
    if (allBOMItems.length === 0) {
      alert("Не знайдено елементів для комплектування.");
      return;
    }

    const itemsToRequest = allBOMItems.map(r => ({ 
      nomId: r.nom.id, 
      name: r.nom.name, 
      qty: r.qty 
    }));

    try {
      setIsProcessing(true);
      await submitPickingRequest(activeBatchData.orderId, itemsToRequest, activeBatchData.tasks[0]?.id);
      alert("Запит успішно відправлено!");
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Помилка створення запиту");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompletePackaging = async () => {
    if (!activeBatchData) return;
    if (!window.confirm(`Підтвердити завершення пакування наряду №${activeBatchData.orderNum}/${activeBatchData.batchIndex}?`)) return;

    try {
      setIsProcessing(true);
      
      for (const task of activeBatchData.tasks) {
        const newSnapshot = { 
          ...(task.plan_snapshot || {}), 
          _metadata: { 
            ...(task.plan_snapshot?._metadata || {}), 
            is_packaged: true,
            packaged_at: new Date().toISOString()
          } 
        };
        await supabase.from('tasks').update({ plan_snapshot: newSnapshot }).eq('id', task.id);
      }

      alert("Наряд успішно запаковано!");
      setSelectedBatch(null);
      await fetchData();

      const { data: freshTasks } = await supabase
        .from('tasks')
        .select('id, status, plan_snapshot')
        .eq('order_id', activeBatchData.orderId);

      const remainingNonPackaged = (freshTasks || []).filter(t => 
        t.status === 'completed' && 
        t.plan_snapshot?._metadata?.is_packaged !== true
      );

      if (remainingNonPackaged.length === 0) {
        await completePackaging(activeBatchData.orderId);
      }
    } catch (e) {
      console.error(e);
      alert("Помилка при закритті пакування");
    } finally {
      setIsProcessing(false);
    }
  };

  const getIconForType = (nom) => {
    const name = (nom.name || '').toLowerCase();
    const type = (nom.type || '').toLowerCase();
    
    if (name.startsWith('іп-') || type.includes('деталь')) return <Package size={16} color="#f43f5e" />
    if (name.includes('стійка')) return <Layers size={16} color="#8b5cf6" />
    if (name.includes('гвинт') || name.includes('гайка') || type.includes('метиз')) return <Wrench size={16} color="#06b6d4" />
    return <Box size={16} color="#444" />
  }

  return (
    <div className="packaging-module" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      <nav className="module-nav" style={{ flexShrink: 0, padding: '0 25px', height: '80px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 800 }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">НА ГОЛОВНУ</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: '#f43f5e', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 950, margin: 0, letterSpacing: '0.5px' }}>ВІДДІЛ ПАКУВАННЯ</h1>
              <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginTop: '2px' }}>Контроль комплектування партій</div>
            </div>
          </div>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '30px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '30px', maxWidth: '1600px', margin: '0 auto', height: 'calc(100vh - 140px)' }}>
          
          {/* SIDEBAR: BATCH QUEUE */}
          <div className="orders-sidebar glass-panel" style={{ background: '#0a0a0a', padding: '25px', borderRadius: '28px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
              <ClipboardList size={22} color="#f43f5e" />
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase' }}>Черга нарядів</h3>
              <span style={{ marginLeft: 'auto', background: '#f43f5e22', color: '#f43f5e', padding: '4px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 950 }}>{batchList.length}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
              {batchList.map(batch => {
                const isSelected = selectedBatch?.key === batch.key;
                const isCompleted = batch.packStatus === 'completed';
                const isReady = batch.packStatus === 'ready';
                const isProcessing = batch.packStatus === 'processing';
                
                let statusColor = '#444';
                let statusBg = '#111';
                let statusLabel = 'ОЧІКУЄ ЗАПИТУ';
                
                if (isCompleted) { statusColor = '#666'; statusLabel = 'ЗАПАКОВАНО'; }
                else if (isReady) { statusColor = '#10b981'; statusBg = '#10b98115'; statusLabel = 'ГОТОВО ДО ПАКУВАННЯ'; }
                else if (isProcessing) { statusColor = '#3b82f6'; statusBg = '#3b82f615'; statusLabel = 'ЗАПИТ В ОБРОБЦІ'; }
                else { statusColor = '#eab308'; statusBg = '#eab30815'; statusLabel = 'ОЧІКУЄ ЗАПИТУ'; }

                return (
                  <div 
                    key={batch.key} 
                    onClick={() => setSelectedBatch(batch)}
                    className={`pack-order-card ${isReady ? 'ready-pulse' : ''}`}
                    style={{ 
                      padding: '20px 20px 20px 25px', 
                      background: isSelected ? `${statusColor}15` : (isCompleted ? '#080808' : '#111'), 
                      border: `1px solid ${isSelected ? statusColor : '#1a1a1a'}`, 
                      borderRadius: '24px', 
                      cursor: 'pointer',
                      transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      opacity: isCompleted ? 0.4 : 1,
                      filter: isCompleted ? 'grayscale(1)' : 'none',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ 
                      position: 'absolute', 
                      left: 0, 
                      top: 0, 
                      bottom: 0, 
                      width: '6px', 
                      background: statusColor,
                      boxShadow: isSelected ? `4px 0 15px ${statusColor}44` : 'none'
                    }}></div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 1000, letterSpacing: '-0.5px', color: isSelected ? '#fff' : '#ccc' }}>№ {batch.orderNum}/{batch.batchIndex}</div>
                      <div style={{ 
                        background: statusBg, 
                        padding: '4px 8px', 
                        borderRadius: '8px', 
                        fontSize: '0.55rem', 
                        color: statusColor, 
                        fontWeight: 950, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        border: `1px solid ${statusColor}33`
                      }}>
                        {isCompleted ? <CheckCircle2 size={10} /> : (isReady ? <Scan size={10} /> : <Clock size={10} />)}
                        {statusLabel}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: isSelected ? '#aaa' : '#555', fontWeight: 700, marginBottom: '12px' }}>{batch.customer}</div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', paddingTop: '12px', borderTop: '1px solid #1a1a1a' }}>
                      <div style={{ fontSize: '0.65rem', color: '#333', fontWeight: 800 }}>КІЛЬКІСТЬ: <span style={{ color: isSelected ? '#fff' : '#666' }}>{batch.plannedSets} шт</span></div>
                    </div>
                  </div>
                )
              })}
              {batchList.length === 0 && (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#333', border: '2px dashed #151515', borderRadius: '24px' }}>
                  <Package size={48} style={{ opacity: 0.1, margin: '0 auto 20px' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>Черга порожня</div>
                </div>
              )}
            </div>
          </div>

          {/* MAIN AREA: BATCH DETAILS */}
          <div className="order-details-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {activeBatchData ? (
              <div className="glass-panel" style={{ background: '#0a0a0a', padding: '40px', borderRadius: '32px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
                   <div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '8px' }}>
                        <h2 style={{ margin: 0, fontSize: '2.8rem', fontWeight: 1000, color: '#fff', letterSpacing: '-1.5px' }}>Наряд № {activeBatchData.orderNum}/{activeBatchData.batchIndex}</h2>
                        <span style={{ background: '#f43f5e', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 950 }}>ПАРТІЯ</span>
                     </div>
                     <p style={{ margin: 0, color: '#555', fontSize: '1.1rem', fontWeight: 600 }}>Замовник: <strong style={{ color: '#888' }}>{activeBatchData.customer}</strong></p>
                   </div>
                   <div style={{ textAlign: 'right', background: '#111', padding: '15px 25px', borderRadius: '20px', border: '1px solid #1a1a1a' }}>
                     <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', fontWeight: 900, marginBottom: '4px' }}>Обсяг пакування</div>
                     <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#10b981' }}>{activeBatchData.plannedSets} <span style={{ fontSize: '0.9rem', color: '#444' }}>шт.</span></div>
                   </div>
                </div>

                <div style={{ background: '#070707', borderRadius: '28px', padding: '30px', flex: 1, border: '1px solid #151515', marginBottom: '30px', overflowY: 'auto' }}>
                  
                  {Object.entries(categorizedBOM).map(([key, cat]) => (
                    cat.items.length > 0 && (
                      <div key={key} style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: `1px solid ${cat.color}22`, paddingBottom: '12px' }}>
                          <div style={{ color: cat.color }}>{cat.icon}</div>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', color: cat.color, fontWeight: 900, letterSpacing: '1px' }}>{cat.title}</h4>
                          <span style={{ marginLeft: 'auto', color: '#333', fontSize: '0.8rem', fontWeight: 800 }}>{cat.items.length} ПОЗИЦІЙ</span>
                        </div>
                        
                        <div className="bom-required-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                          {cat.items.map((item, idx) => {
                            const reqRequest = orderRequests.find(r => String(r.nomenclature_id) === String(item.nom.id))
                            const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
                            const isPending = reqRequest?.status === 'pending'

                            return (
                              <div key={idx} style={{ 
                                background: isPicked ? '#10b98108' : (isPending ? '#eab30805' : '#0d0d0d'), 
                                padding: '18px', 
                                borderRadius: '18px', 
                                border: `1px solid ${isPicked ? '#10b98144' : (isPending ? '#eab30833' : '#1a1a1a')}`,
                                transition: '0.3s',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {getIconForType(item.nom)}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', marginBottom: '2px', lineHeight: 1.2 }}>{item.nom.name}</div>
                                    <div style={{ fontSize: '0.6rem', color: isPicked ? '#10b981' : (isPending ? '#eab308' : '#444'), fontWeight: 900, textTransform: 'uppercase' }}>
                                      {isPicked ? 'Підтверджено' : (isPending ? 'В обробці' : 'Очікує')}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', marginLeft: '15px' }}>
                                  <div style={{ fontSize: '1.3rem', fontWeight: 1000, color: isPicked ? '#10b981' : (isPending ? '#eab308' : '#fff') }}>
                                    {item.qty}
                                  </div>
                                  <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800 }}>{item.nom.unit || 'шт'}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  ))}

                  {Object.values(categorizedBOM).every(c => c.items.length === 0) && (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#444', border: '2px dashed #151515', borderRadius: '20px' }}>
                      <AlertCircle size={40} style={{ margin: '0 auto 15px', opacity: 0.3 }} />
                      <div style={{ fontWeight: 800 }}>Специфікація порожня</div>
                      <p style={{ fontSize: '0.75rem', marginTop: '10px' }}>Перевірте налаштування BOM для цього виробу</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                  <button 
                    onClick={handleCreateRequest}
                    disabled={allBOMItems.length === 0 || isProcessing || hasAnyRequests}
                    style={{ 
                      padding: '25px', 
                      background: '#111', 
                      color: hasAnyRequests ? '#444' : '#fff', 
                      border: '1px solid #222', 
                      borderRadius: '20px', 
                      fontWeight: 950, 
                      cursor: (allBOMItems.length > 0 && !isProcessing && !hasAnyRequests) ? 'pointer' : 'not-allowed', 
                      transition: '0.3s', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '12px', 
                      fontSize: '1rem',
                      opacity: (allBOMItems.length > 0 && !isProcessing && !hasAnyRequests) ? 1 : 0.5
                    }}
                  >
                    {hasAnyRequests ? (
                      <>
                        <CheckCircle2 size={22} color="#10b981" /> ЗАПИТ ТМЦ ВІДПРАВЛЕНО
                      </>
                    ) : (
                      <>
                        <Send size={22} color="#3b82f6" /> СФОРМУВАТИ ЗАПИТ ТМЦ
                      </>
                    )}
                  </button>

                  <button 
                    onClick={handleCompletePackaging}
                    disabled={!isReadyToFinalize || isProcessing}
                    style={{ 
                      padding: '25px', 
                      background: isReadyToFinalize ? '#10b981' : '#111', 
                      color: isReadyToFinalize ? '#000' : '#444', 
                      border: 'none', 
                      borderRadius: '20px', 
                      fontWeight: 1000, 
                      cursor: (isReadyToFinalize && !isProcessing) ? 'pointer' : 'not-allowed', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '12px', 
                      fontSize: '1rem', 
                      boxShadow: isReadyToFinalize ? '0 15px 35px rgba(16,185,129,0.25)' : 'none',
                      transition: '0.3s'
                    }}
                  >
                    <Package size={24} /> {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : 'ЗАВЕРШИТИ ПАКУВАННЯ'}
                  </button>
                </div>

              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #111', borderRadius: '32px', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ textAlign: 'center', color: '#222' }}>
                  <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 30px' }}>
                    <Package size={120} style={{ opacity: 0.1 }} />
                    <div className="anim-pulse" style={{ position: 'absolute', inset: 0, border: '2px solid #f43f5e', borderRadius: '30%', opacity: 0.1 }}></div>
                  </div>
                  <h3 style={{ margin: 0, fontWeight: 900, color: '#333', fontSize: '1.5rem', letterSpacing: '-0.5px' }}>Оберіть наряд для комплектування</h3>
                  <p style={{ margin: '15px 0 0 0', fontSize: '0.9rem', color: '#222', fontWeight: 600 }}>Система відображає лише ті партії, виробництво яких повністю завершено</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .pack-order-card:hover { transform: translateY(-3px) scale(1.01); border-color: #555; background: #121212; }
        .pack-order-card:active { transform: scale(0.99); }
        .ready-pulse { animation: readyPulse 2s infinite; border-color: #10b981 !important; background: #10b98108 !important; }
        @keyframes readyPulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.2); }
          70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .anim-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.1; } 50% { transform: scale(1.1); opacity: 0.2; } 100% { transform: scale(1); opacity: 0.1; } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
      `}} />
    </div>
  )
}

export default PackagingModule
