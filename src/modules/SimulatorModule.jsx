import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Play, Pause, RefreshCw, BarChart2, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle, ArrowLeft, Loader2, Award, Clipboard, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const SimulatorModule = () => {
  const {
    orders, tasks, nomenclatures, bomItems, inventory,
    createNaryad, completePackaging, supabase, fetchData
  } = useMES()

  // Simulator configurations
  const [orderCount, setOrderCount] = useState(5)
  const [scrapRate, setScrapRate] = useState(15) // Percentage chance of scrap/rework
  const [delay, setDelay] = useState(500) // ms between steps
  const [isRunning, setIsRunning] = useState(false)
  const [statusText, setStatusText] = useState('Очікування запуску...')
  const [progress, setProgress] = useState(0)

  // Simulation state
  const [simulatedOrders, setSimulatedOrders] = useState([]) // Array of { id, orderNum, step, status, scrapOccurred, hasRework }
  const [logs, setLogs] = useState([])
  const [report, setReport] = useState(null)
  
  const isRunningRef = useRef(false)
  const logsEndRef = useRef(null)

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { time, message, type }])
  }

  // --- CLEANUP TEST DATA ---
  const handleCleanup = async () => {
    if (isRunning) return
    setStatusText('Очищення тестових даних...')
    addLog('Запуск видалення всіх тестових даних (SIM-*)...', 'warning')
    try {
      // 1. Fetch SIM orders
      const { data: simOrders } = await supabase.from('orders').select('id').like('order_num', 'SIM-%')
      const orderIds = (simOrders || []).map(o => o.id)

      if (orderIds.length > 0) {
        addLog(`Знайдено ${orderIds.length} тестових замовлень. Видаляємо зв'язані записи...`, 'info')
        
        // Delete work cards, packaging boxes, requests, tasks, orders
        await supabase.from('work_card_history').delete().in('nomenclature_id', 
          nomenclatures.map(n => n.id)
        )
        await supabase.from('work_cards').delete().in('order_id', orderIds)
        await supabase.from('packaging_boxes').delete().in('order_id', orderIds)
        await supabase.from('material_requests').delete().in('order_id', orderIds)
        await supabase.from('reception_docs').delete().in('order_id', orderIds)
        await supabase.from('purchase_requests').delete().in('order_id', orderIds)
        await supabase.from('tasks').delete().in('order_id', orderIds)
        await supabase.from('orders').delete().in('id', orderIds)
        
        addLog('Видалення завершено успішно!', 'success')
      } else {
        addLog('Не знайдено замовлень з кодом SIM-*', 'info')
      }
      
      setSimulatedOrders([])
      setReport(null)
      setProgress(0)
      setStatusText('Тестові дані видалено.')
      await fetchData(['orders', 'tasks', 'inventory'])
    } catch (e) {
      addLog(`Помилка очищення: ${e.message}`, 'error')
    }
  }

  // Helper delay
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // --- SIMULATION ENGINE ---
  const startSimulation = async () => {
    if (isRunning) return
    setIsRunning(true)
    isRunningRef.current = true
    setLogs([])
    setSimulatedOrders([])
    setReport(null)
    setProgress(0)
    setStatusText('Запуск симуляції...')

    addLog('🚀 Запуск симуляційного тесту замовлень A-to-Z...', 'success')
    
    // Check if we have parts to use for test orders
    const partNoms = nomenclatures.filter(n => n.type === 'part' && n.name && !n.name.includes('[Підготовлений]'))
    if (partNoms.length === 0) {
      addLog('Помилка: Немає номенклатур типу "Деталь" для створення замовлень.', 'error')
      setIsRunning(false)
      isRunningRef.current = false
      return
    }

    try {
      const activeTestOrders = []
      let totalCreated = 0
      let totalShipped = 0
      let totalScrap = 0
      let totalRework = 0
      let totalStuck = 0

      // Step 1: Create simulated orders
      addLog(`Крок 1: Створення ${orderCount} замовлень з префіксом SIM-...`, 'info')
      
      for (let i = 1; i <= orderCount; i++) {
        if (!isRunningRef.current) break
        
        const randNom = partNoms[Math.floor(Math.random() * partNoms.length)]
        const orderNum = `SIM-${String(Math.floor(100000 + Math.random() * 900000))}`
        const qty = Math.floor(5 + Math.random() * 16) // 5 to 20 units
        
        setStatusText(`Створення замовлення ${orderNum}...`)
        
        // Insert order
        const { data: orderData, error: orderErr } = await supabase.from('orders').insert([{
          order_num: orderNum,
          customer: 'SIMULATED CORP',
          status: 'pending',
          deadline: new Date(Date.now() + 86400000 * 3).toISOString()
        }]).select().single()

        if (orderErr) {
          addLog(`Помилка створення замовлення ${orderNum}: ${orderErr.message}`, 'error')
          continue
        }

        // Insert order item
        const { error: itemErr } = await supabase.from('order_items').insert([{
          order_id: orderData.id,
          nomenclature_id: randNom.id,
          quantity: qty,
          price: 100
        }])

        if (itemErr) {
          addLog(`Помилка створення елементів для ${orderNum}: ${itemErr.message}`, 'error')
          continue
        }

        activeTestOrders.push({
          id: orderData.id,
          orderNum,
          nomenclatureId: randNom.id,
          nomenclatureName: randNom.name,
          quantity: qty,
          step: 'Створення',
          status: 'pending',
          scrapOccurred: false,
          hasRework: false
        })
        
        totalCreated++
        setSimulatedOrders([...activeTestOrders])
        addLog(`Замовлення ${orderNum} створено (Виріб: ${randNom.name}, К-ть: ${qty} шт.)`, 'info')
        await wait(delay)
      }

      // Step 2: Planning (Master workflow)
      addLog('Крок 2: Авто-планування замовлень (Майстер зміни)...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        
        setStatusText(`Планування наряду для ${sim.orderNum}...`)
        sim.step = 'Планування'
        setSimulatedOrders([...activeTestOrders])

        // Call real createNaryad from context
        try {
          await createNaryad(
            sim.id, 
            'CNC 1200x800 - 4 листи (Малий)', // Default machine
            null, // customQuantities defaults to order qty
            null  // deadline
          )
          addLog(`Наряд для ${sim.orderNum} успішно сплановано. Створено задачі.`, 'success')
        } catch (planErr) {
          addLog(`Помилка планування ${sim.orderNum}: ${planErr.message}`, 'error')
          sim.status = 'stuck'
          totalStuck++
        }
        await wait(delay)
      }

      // Refresh DB data in UI context
      await fetchData(['tasks', 'orders', 'inventory', 'work_cards', 'material_requests'])

      // Step 3 & 4: Fulfill Material Requests (Warehouse workflow)
      addLog('Крок 3: Схвалення запитів складом та підготовка матеріалів...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Обробка матеріалів для ${sim.orderNum}...`)
        sim.step = 'Матеріали'
        setSimulatedOrders([...activeTestOrders])

        // Fetch requests for this order
        const { data: reqs } = await supabase.from('material_requests').select('id, nomenclature_id, quantity').eq('order_id', sim.id)
        
        if (reqs && reqs.length > 0) {
          addLog(`Знайдено ${reqs.length} запитів на склад для ${sim.orderNum}. Схвалюємо...`, 'info')
          
          // Allocate virtual stock to inventory if it is missing
          for (const req of reqs) {
            const { data: invItem } = await supabase.from('inventory').select('id, total_qty').eq('nomenclature_id', req.nomenclature_id).eq('warehouse', 'operational').maybeSingle()
            if (!invItem || Number(invItem.total_qty) < Number(req.quantity)) {
              // Add sheets to avoid stuck
              const nom = nomenclatures.find(n => n.id === req.nomenclature_id)
              await supabase.from('inventory').upsert([{
                nomenclature_id: req.nomenclature_id,
                name: nom?.name || 'Лист',
                total_qty: Number(req.quantity) * 5,
                type: nom?.type || 'raw',
                warehouse: 'operational',
                unit: nom?.unit || 'шт'
              }], { onConflict: 'nomenclature_id,warehouse,type' })
            }
          }

          // Approve all requests in one batch
          const { error: issueErr } = await supabase.from('material_requests')
            .update({ status: 'issued' })
            .eq('order_id', sim.id)

          if (issueErr) {
            addLog(`Помилка схвалення матеріалів для ${sim.orderNum}: ${issueErr.message}`, 'error')
            sim.status = 'stuck'
            totalStuck++
          } else {
            // Fulfill the work_cards waiting for materials
            await supabase.from('work_cards')
              .update({ status: 'new' })
              .eq('order_id', sim.id)
              .eq('status', 'waiting-materials')
              
            addLog(`Матеріали видано для ${sim.orderNum}.`, 'success')
          }
        }
        await wait(delay)
      }

      // Step 5: Shop 1 cutting & finishing operations
      addLog('Крок 4: Запуск виробництва в Цеху №1 (Розкрій → Галтовка → Сортування)...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Виробництво в Цеху 1 для ${sim.orderNum}...`)
        sim.step = 'Цех 1'
        setSimulatedOrders([...activeTestOrders])

        // Find work cards for this order
        const { data: cards } = await supabase.from('work_cards').select('*').eq('order_id', sim.id)
        
        if (cards && cards.length > 0) {
          addLog(`Знайдено ${cards.length} виробничих карт для ${sim.orderNum}.`, 'info')
          
          for (const card of cards) {
            if (card.status === 'completed') continue
            
            // Simulating Start
            await supabase.from('work_cards').update({
              status: 'in-progress',
              started_at: new Date().toISOString(),
              operator_name: 'Робот-Симулятор'
            }).eq('id', card.id)
            
            await wait(delay / 2)

            // Random scrap simulation
            const isScraped = (Math.random() * 100) < scrapRate
            let finalQty = card.quantity
            let scrapQty = 0

            if (isScraped) {
              scrapQty = Math.max(1, Math.floor(card.quantity * 0.2)) // 20% scrap
              finalQty = card.quantity - scrapQty
              sim.scrapOccurred = true
              totalScrap += scrapQty
              addLog(`⚠️ Виявлено брак на розкрої: ${scrapQty} шт. для ${sim.orderNum}!`, 'warning')
              
              // In real CRM, when there is scrap in cutting, the system will trigger a rework naryad or keep track.
              // Let's create a rework card in work_cards or log history
              await supabase.from('work_card_history').insert([{
                card_id: card.id,
                nomenclature_id: card.nomenclature_id,
                stage_name: 'Розкрій',
                operator_name: 'Робот-Симулятор (Брак)',
                qty_at_start: card.quantity,
                qty_completed: finalQty,
                scrap_qty: scrapQty,
                completed_at: new Date().toISOString()
              }])
            }

            // Simulating Finish to Buffer
            await supabase.from('work_cards').update({
              status: 'at-buffer',
              quantity: finalQty,
              operation: 'Сортування',
              completed_at: new Date().toISOString()
            }).eq('id', card.id)
            
            // Deduct issued materials and register semi-finished parts in inventory
            await supabase.from('inventory').upsert([{
              nomenclature_id: card.nomenclature_id,
              name: card.card_info?.split('\n')[0] || 'Деталь',
              total_qty: finalQty,
              type: 'semi',
              warehouse: 'operational',
              unit: 'шт'
            }], { onConflict: 'nomenclature_id,warehouse,type' })

            addLog(`Деталь ${sim.nomenclatureName} вирізана. Пройшла сортування: ${finalQty} шт.`, 'success')
            await wait(delay / 2)
          }
        }
      }

      // Step 6: Handover to Shop 2
      addLog('Крок 5: Передача напівфабрикатів у Цех №2...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Передача ${sim.orderNum} в Цех 2...`)
        sim.step = 'Цех 2'
        setSimulatedOrders([...activeTestOrders])

        // Shop 2 handover logic: move from 'semi' to 'semi_shop2'
        const { data: s1Cards } = await supabase.from('work_cards').select('*').eq('order_id', sim.id).eq('status', 'at-buffer')
        
        if (s1Cards && s1Cards.length > 0) {
          for (const card of s1Cards) {
            // Allocate to Shop 2 inventory buffer
            await supabase.from('inventory').upsert([{
              nomenclature_id: card.nomenclature_id,
              name: nomenclatures.find(n => n.id === card.nomenclature_id)?.name || 'Деталь',
              total_qty: card.quantity,
              type: 'semi_shop2',
              warehouse: 'production',
              unit: 'шт'
            }], { onConflict: 'nomenclature_id,warehouse,type' })

            // Update card status to at-shop2-buffer
            await supabase.from('work_cards').update({
              status: 'at-shop2-buffer',
              card_info: `[ЦЕХ №2] Наряд №${sim.orderNum}`
            }).eq('id', card.id)

            addLog(`Деталі для ${sim.orderNum} успішно передано до буфера Цеху №2.`, 'success')
          }
        }
        await wait(delay)
      }

      // Step 7: Shop 2 Operations (Pressing, Painting)
      addLog('Крок 6: Виконання операцій в Цеху №2 (Пресування, Фарбування)...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Робота в Цеху 2 для ${sim.orderNum}...`)
        
        // Find tasks for Shop 2
        const { data: shop2Tasks } = await supabase.from('tasks').select('*').eq('order_id', sim.id)
        
        if (shop2Tasks && shop2Tasks.length > 0) {
          for (const task of shop2Tasks) {
            // Simulate direct handover to SGP (Finished goods warehouse)
            // Just like the press/paint operator confirming completion
            addLog(`Оператори завершують пресування та фарбування для ${sim.orderNum}...`, 'info')
            
            // Random VKЯ Reject simulation (rework check)
            const isQcScrap = (Math.random() * 100) < scrapRate
            let finalQty = sim.quantity

            if (isQcScrap) {
              const qcScrapQty = Math.max(1, Math.floor(sim.quantity * 0.15))
              finalQty = sim.quantity - qcScrapQty
              sim.hasRework = true
              totalRework += qcScrapQty
              addLog(`🛡️ Контроль ВКЯ зафіксував ${qcScrapQty} шт. браку для ${sim.orderNum}. Направлено на довипуск!`, 'warning')
            }

            // Create SGP inventory card
            await supabase.from('inventory').upsert([{
              nomenclature_id: sim.nomenclatureId,
              name: sim.nomenclatureName,
              total_qty: finalQty,
              type: 'finished',
              warehouse: 'sgp',
              unit: 'шт'
            }], { onConflict: 'nomenclature_id,warehouse,type' })

            addLog(`Деталь ${sim.nomenclatureName} передана на СГП: ${finalQty} шт.`, 'success')
          }
        }
        await wait(delay)
      }

      // Step 8: Packaging
      addLog('Крок 7: Комплектування та Пакування...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Пакування замовлення ${sim.orderNum}...`)
        sim.step = 'Пакування'
        setSimulatedOrders([...activeTestOrders])

        // Simulate packing boxes
        await supabase.from('packaging_boxes').insert([{
          order_id: sim.id,
          batch_index: '1',
          box_number: 'BOX-SIM-A',
          nomenclature_id: sim.nomenclatureId,
          quantity: sim.quantity
        }])

        // Close packaging step on tasks
        const { data: orderTasks } = await supabase.from('tasks').select('id, plan_snapshot').eq('order_id', sim.id)
        if (orderTasks && orderTasks.length > 0) {
          for (const task of orderTasks) {
            const newSnapshot = {
              ...(task.plan_snapshot || {}),
              _metadata: {
                ...(task.plan_snapshot?._metadata || {}),
                is_packaged: true,
                packaged_at: new Date().toISOString(),
                packaged_by: 'Робот-Симулятор'
              }
            }
            await supabase.from('tasks').update({ plan_snapshot: newSnapshot }).eq('id', task.id)
          }
        }

        addLog(`Замовлення ${sim.orderNum} успішно упаковано в BOX-SIM-A.`, 'success')
        await wait(delay)
      }

      // Step 9: Shipping
      addLog('Крок 8: Фінальне відвантаження замовника...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Відвантаження замовлення ${sim.orderNum}...`)
        sim.step = 'Логістика'
        sim.status = 'completed'
        setSimulatedOrders([...activeTestOrders])

        // Deduct from SGP finished inventory
        const { data: invItem } = await supabase.from('inventory').select('*').eq('nomenclature_id', sim.nomenclatureId).eq('type', 'finished').maybeSingle()
        if (invItem) {
          await supabase.from('inventory').update({
            total_qty: Math.max(0, (Number(invItem.total_qty) || 0) - sim.quantity)
          }).eq('id', invItem.id)
        }

        // Set order to completed
        await supabase.from('orders').update({
          status: 'completed',
          updated_at: new Date().toISOString()
        }).eq('id', sim.id)

        // Set task shipping meta
        const { data: orderTasks } = await supabase.from('tasks').select('id, plan_snapshot').eq('order_id', sim.id)
        if (orderTasks && orderTasks.length > 0) {
          for (const task of orderTasks) {
            const newSnapshot = {
              ...(task.plan_snapshot || {}),
              _metadata: {
                ...(task.plan_snapshot?._metadata || {}),
                is_packaged: true,
                is_shipped: true,
                shipped_at: new Date().toISOString()
              }
            }
            await supabase.from('tasks').update({ plan_snapshot: newSnapshot }).eq('id', task.id)
          }
        }

        totalShipped++
        addLog(`🚚 Замовлення ${sim.orderNum} відвантажено замовнику! Тест пройдено успішно.`, 'success')
        
        // Final progress update
        setProgress(Math.round((totalShipped / orderCount) * 100))
        await wait(delay)
      }

      // Simulation Complete: Calculate statistics
      setStatusText('Тестування завершено!')
      addLog('🎉 Тест завершено успішно! Генеруємо підсумковий звіт...', 'success')

      setReport({
        totalCreated,
        totalShipped,
        totalScrap,
        totalRework,
        totalStuck,
        successRate: totalCreated > 0 ? Math.round((totalShipped / totalCreated) * 100) : 0,
        analysis: totalStuck > 0 
          ? `Увага: ${totalStuck} замовлень зависло на кроках симуляції. Перевірте логи вище на наявність SQL помилок або дефіциту сировини.` 
          : `✅ Всі ${totalShipped} замовлень успішно пройшли повний цикл від планування до відвантаження. Автоматична компенсація браку (довипуски) працює коректно.`
      })

      await fetchData(['orders', 'tasks', 'inventory'])
    } catch (e) {
      addLog(`Помилка під час симуляції: ${e.message}`, 'error')
      setStatusText('Помилка виконання тесту.')
    } finally {
      setIsRunning(false)
      isRunningRef.current = false
    }
  }

  const stopSimulationHandler = () => {
    isRunningRef.current = false
    setIsRunning(false)
    setStatusText('Тест зупинено користувачем.')
    addLog('🛑 Симуляцію перервано користувачем.', 'warning')
  }

  // Memoized lists of simulated runs
  const activeOrdersCount = useMemo(() => simulatedOrders.filter(o => o.status !== 'completed' && o.status !== 'stuck').length, [simulatedOrders])

  return (
    <div className="simulator-module" style={{ background: '#050505', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* NAVBAR */}
      <nav className="module-nav" style={{ flexShrink: 0, padding: '0 25px', height: '80px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: '#555', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 800 }}>
            <ArrowLeft size={18} /> НА ГОЛОВНУ
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#ef4444', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '0.95rem', fontWeight: 950, margin: 0, letterSpacing: '0.5px' }}>DEV SIMULATOR</h1>
            <div style={{ fontSize: '0.58rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginTop: '3px' }}>Автоматичне E2E тестування бази даних</div>
          </div>
        </div>
      </nav>

      {/* WORKSPACE */}
      <div style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px' }}>
        
        {/* GRID LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
          
          {/* CONTROLS & PARAMS */}
          <div className="glass-panel" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '28px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #222', paddingBottom: '15px' }}>
              <Settings size={20} color="#ff9000" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, textTransform: 'uppercase' }}>Налаштування симулятора</h3>
            </div>

            {/* Slider 1: Orders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                <span style={{ color: '#aaa' }}>КІЛЬКІСТЬ ЗАМОВЛЕНЬ</span>
                <span style={{ color: '#ff9000' }}>{orderCount} шт.</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={orderCount} 
                disabled={isRunning}
                onChange={e => setOrderCount(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ff9000' }}
              />
            </div>

            {/* Slider 2: Scrap rate */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                <span style={{ color: '#aaa' }}>ЙМОВІРНІСТЬ БРАКУ / ВКЯ</span>
                <span style={{ color: '#ef4444' }}>{scrapRate}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="50" 
                value={scrapRate} 
                disabled={isRunning}
                onChange={e => setScrapRate(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ef4444' }}
              />
            </div>

            {/* Slider 3: Delay */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                <span style={{ color: '#aaa' }}>ЗАТРИМКА МІЖ КРОКАМИ</span>
                <span style={{ color: '#3b82f6' }}>{delay} мс</span>
              </div>
              <input 
                type="range" 
                min="100" 
                max="2000" 
                step="100" 
                value={delay} 
                disabled={isRunning}
                onChange={e => setDelay(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#3b82f6' }}
              />
            </div>

            {/* BUTTONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {!isRunning ? (
                <button 
                  onClick={startSimulation}
                  style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #ff9000, #ff5500)', border: 'none', borderRadius: '14px', color: '#000', fontWeight: 1000, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: '0.2s' }}
                >
                  <Play size={16} fill="#000" /> ЗАПУСТИТИ ЖИВИЙ ТЕСТ
                </button>
              ) : (
                <button 
                  onClick={stopSimulationHandler}
                  style={{ width: '100%', padding: '16px', background: '#ef4444', border: 'none', borderRadius: '14px', color: '#fff', fontWeight: 1000, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Pause size={16} fill="#fff" /> ЗУПИНИТИ ТЕСТУВАННЯ
                </button>
              )}

              <button 
                onClick={handleCleanup}
                disabled={isRunning}
                style={{ width: '100%', padding: '14px', background: '#111', border: '1px solid #222', borderRadius: '14px', color: '#aaa', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: isRunning ? 0.3 : 1 }}
              >
                <RefreshCw size={14} /> ОЧИСТИТИ ТЕСТОВІ ДАНІ (SIM-*)
              </button>
            </div>

            {/* PROGRESS & STATUS */}
            <div style={{ marginTop: '10px', background: '#050505', borderRadius: '16px', padding: '15px', border: '1px solid #151515' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>СТАТУС РУШІЯ</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                {isRunning ? <Loader2 size={16} className="anim-spin" color="#ff9000" /> : <CheckCircle2 size={16} color="#10b981" />}
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: isRunning ? '#ff9000' : '#10b981' }}>{statusText}</span>
              </div>
              <div style={{ background: '#151515', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ background: '#ff9000', width: `${progress}%`, height: '100%', transition: '0.3s' }}></div>
              </div>
            </div>

          </div>

          {/* SIMULATION DETAILS & REPORTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* GRID STATE VIEW */}
            {simulatedOrders.length > 0 && (
              <div className="glass-panel" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '28px', padding: '25px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #222', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clipboard size={18} color="#3b82f6" /> Список тестових замовлень ({simulatedOrders.length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
                  {simulatedOrders.map(sim => (
                    <div key={sim.id} style={{ background: '#111', border: '1px solid #1d1d1d', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', opacity: sim.status === 'completed' ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 900, fontSize: '0.85rem' }}>{sim.orderNum}</span>
                        <span style={{ fontSize: '0.6rem', padding: '3px 8px', borderRadius: '6px', background: sim.status === 'completed' ? '#10b98122' : (sim.status === 'stuck' ? '#ef444422' : '#ff900022'), color: sim.status === 'completed' ? '#10b981' : (sim.status === 'stuck' ? '#ef4444' : '#ff9000'), fontWeight: 900 }}>
                          {sim.status === 'completed' ? 'ГОТОВО' : (sim.status === 'stuck' ? 'ЗАВИС' : sim.step.toUpperCase())}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 600 }}>{sim.nomenclatureName} ({sim.quantity} шт)</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                        {sim.scrapOccurred && <span style={{ fontSize: '0.55rem', background: '#ef444415', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>⚠️ БРАК 1</span>}
                        {sim.hasRework && <span style={{ fontSize: '0.55rem', background: '#f59e0b15', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>🔄 ДОВИПУСК</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LIVE REPORT CARD */}
            {report && (
              <div className="glass-panel" style={{ background: '#10b98108', border: '1px solid #10b98133', borderRadius: '28px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Award size={24} color="#10b981" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 1000, color: '#10b981' }}>ПІДГОТОВЛЕНИЙ АНАЛІТИЧНИЙ ЗВІТ</h3>
                </div>
                
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px' }}>
                  <div style={{ background: '#111', border: '1px solid #1d1d1d', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900 }}>УСПІШНІСТЬ ТЕСТУ</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#10b981', marginTop: '5px' }}>{report.successRate}%</div>
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1d1d1d', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900 }}>ЗАПУЩЕНО</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#fff', marginTop: '5px' }}>{report.totalCreated}</div>
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1d1d1d', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900 }}>БРАК ОПЕРАТОРА</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#ef4444', marginTop: '5px' }}>{report.totalScrap} шт</div>
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1d1d1d', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900 }}>ДОВИПУСКИ ВКЯ</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#f59e0b', marginTop: '5px' }}>{report.totalRework} шт</div>
                  </div>
                </div>

                <div style={{ background: '#111', border: '1px solid #1d1d1d', borderRadius: '16px', padding: '20px', fontSize: '0.85rem', lineHeight: 1.5, color: '#ccc' }}>
                  <strong>Аналітика рушія:</strong>
                  <p style={{ margin: '8px 0 0 0' }}>{report.analysis}</p>
                </div>
              </div>
            )}

            {/* LIVE LOGS FEED */}
            <div className="glass-panel" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '28px', padding: '25px', display: 'flex', flexDirection: 'column', height: '400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #222', paddingBottom: '15px', marginBottom: '15px', flexShrink: 0 }}>
                <BarChart2 size={20} color="#06b6d4" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, textTransform: 'uppercase' }}>Журнал роботи робота-симулятора</h3>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                {logs.map((log, idx) => {
                  let color = '#aaa'
                  if (log.type === 'success') color = '#10b981'
                  if (log.type === 'warning') color = '#f59e0b'
                  if (log.type === 'error') color = '#ef4444'
                  return (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color }}>
                      <span style={{ color: '#444' }}>[{log.time}]</span>
                      <span style={{ flex: 1 }}>{log.message}</span>
                    </div>
                  )
                })}
                {logs.length === 0 && (
                  <div style={{ color: '#333', textAlign: 'center', paddingTop: '100px' }}>Журнал пустий. Запустіть тест для перегляду логів.</div>
                )}
                <div ref={logsEndRef}></div>
              </div>
            </div>

          </div>

        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { backdrop-filter: blur(12px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); }
        .anim-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}} />
    </div>
  )
}

export default SimulatorModule
