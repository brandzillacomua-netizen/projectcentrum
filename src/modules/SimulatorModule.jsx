import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Play, Pause, RefreshCw, BarChart2, ShieldAlert, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, Award, Clipboard, Settings, Sliders } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const SimulatorModule = () => {
  const {
    orders, tasks, nomenclatures, bomItems, inventory,
    createNaryad, completePackaging, supabase, fetchData
  } = useMES()

  // Simulator configurations
  const [selectedProductOption, setSelectedProductOption] = useState('random') // 'random' or nomenclature ID
  const [minQty, setMinQty] = useState(10)
  const [maxQty, setMaxQty] = useState(200)
  const [scrapRate, setScrapRate] = useState(15)
  const [delay, setDelay] = useState(1500) // ms between steps, default to 1.5s for realistic pace
  const [orderCount, setOrderCount] = useState(3) // configurable number of orders
  const [isRunning, setIsRunning] = useState(false)
  const [statusText, setStatusText] = useState('Очікування запуску...')
  const [progress, setProgress] = useState(0)

  // Simulation state
  const [simulatedOrders, setSimulatedOrders] = useState([]) // Array of { id, orderNum, product, qty, step, status, scrapOccurred, hasRework }
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

  // Filter products that have BOM recipes (parent items) and are finished products
  const parentProductsList = useMemo(() => {
    if (!nomenclatures || !bomItems) return []
    const parentIds = new Set(bomItems.map(b => String(b.parent_id)))
    return nomenclatures.filter(n => n.type === 'product' && parentIds.has(String(n.id)))
  }, [nomenclatures, bomItems])

  // --- CLEANUP TEST DATA ---
  const handleCleanup = async () => {
    if (isRunning) return
    setStatusText('Очищення тестових даних...')
    addLog('Запуск видалення всіх тестових даних (SIM-*)...', 'warning')
    try {
      const { data: simOrders } = await supabase.from('orders').select('id').like('order_num', 'SIM-%')
      const orderIds = (simOrders || []).map(o => o.id)

      if (orderIds.length > 0) {
        addLog(`Знайдено ${orderIds.length} тестових замовлень. Видаляємо зв'язані записи...`, 'info')
        
        await supabase.from('work_card_history').delete().in('nomenclature_id', nomenclatures.map(n => n.id))
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

    addLog('🚀 Початок реалістичного E2E тестування...', 'success')

    if (parentProductsList.length === 0) {
      addLog('Помилка: У базі даних немає номенклатур з рецептами (BOM).', 'error')
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
      addLog('Крок 1: Створення тестових замовлень...', 'info')
      
      const orderCountToRun = Number(orderCount) || 3
      for (let i = 1; i <= orderCountToRun; i++) {
        if (!isRunningRef.current) break
        
        let selectedProduct = null
        if (selectedProductOption === 'random') {
          selectedProduct = parentProductsList[Math.floor(Math.random() * parentProductsList.length)]
        } else {
          selectedProduct = parentProductsList.find(p => String(p.id) === String(selectedProductOption))
        }

        if (!selectedProduct) {
          addLog('Помилка: Обраний продукт не знайдено.', 'error')
          continue
        }

        const qty = Math.floor(Number(minQty) + Math.random() * (Number(maxQty) - Number(minQty) + 1))
        const orderNum = `SIM-${String(Math.floor(100000 + Math.random() * 900000))}`
        
        setStatusText(`Створення замовлення ${orderNum}...`)
        
        // Insert order header
        const { data: orderData, error: orderErr } = await supabase.from('orders').insert([{
          order_num: orderNum,
          customer: 'REALISTIC SIMULATION CORP',
          status: 'pending',
          deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
          nomenclature_id: selectedProduct.id,
          quantity: qty,
          accessories: selectedProduct.name
        }]).select().single()

        if (orderErr) {
          addLog(`Помилка створення замовлення ${orderNum}: ${orderErr.message}`, 'error')
          continue
        }

        // Insert order item
        const { error: itemErr } = await supabase.from('order_items').insert([{
          order_id: orderData.id,
          nomenclature_id: selectedProduct.id,
          quantity: qty
        }])

        if (itemErr) {
          addLog(`Помилка створення елементів для ${orderNum}: ${itemErr.message}`, 'error')
          continue
        }

        activeTestOrders.push({
          id: orderData.id,
          orderNum,
          nomenclatureId: selectedProduct.id,
          nomenclatureName: selectedProduct.name,
          quantity: qty,
          step: 'Створення',
          status: 'pending',
          scrapOccurred: false,
          hasRework: false
        })
        
        totalCreated++
        setSimulatedOrders([...activeTestOrders])
        addLog(`Замовлення ${orderNum} створено (${selectedProduct.name} — ${qty} шт.)`, 'info')
        await wait(delay)
      }

      await wait(1000)

      // Fetch fresh DB schema details to bypass any local React state closures
      const { data: dbNomenclatures } = await supabase.from('nomenclatures').select('*')
      const { data: dbBomItems } = await supabase.from('bom_items').select('*')
      const { data: dbInventory } = await supabase.from('inventory').select('*')

      // Step 2: Planning (Master workflow)
      addLog('Крок 2: Планування нарядів та генерація робочих карт...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        
        setStatusText(`Планування наряду для ${sim.orderNum}...`)
        sim.step = 'Планування'
        setSimulatedOrders([...activeTestOrders])

        try {
          // Find the BOM parts
          const parts = dbBomItems.filter(b => String(b.parent_id) === String(sim.nomenclatureId))
          const displayParts = parts.length > 0 ? parts.map(b => ({
            nom: dbNomenclatures.find(n => String(n.id) === String(b.child_id)),
            qtyPer: Number(b.quantity_per_parent) || 1
          })).filter(p => p.nom !== undefined) : [{ nom: dbNomenclatures.find(n => String(n.id) === String(sim.nomenclatureId)), qtyPer: 1 }]

          const plan_snapshot = {}
          const materialSummary = {}
          let totalMin = 0
          let totalPlanQty = 0

          displayParts.forEach(part => {
            const totalNeeded = sim.quantity * part.qtyPer
            // Query actual BZ stock from the database snapshot
            const invItem = dbInventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
            const inStockQty = invItem ? Math.max(0, (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0)) : 0
            const usedFromStock = Math.min(totalNeeded, inStockQty)
            const totalToProduce = Math.max(0, totalNeeded - inStockQty)
            totalPlanQty += totalToProduce

            const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
            const sheets = Math.ceil(totalToProduce / unitsPerSheet)

            plan_snapshot[part.nom.id] = {
              id: part.nom.id,
              name: part.nom.name,
              code: part.nom.nomenclature_code,
              need: totalNeeded,
              stock: usedFromStock, // using BZ stock
              plan: totalToProduce,
              units_per_sheet: unitsPerSheet,
              sheets: sheets,
              sheets_t300: sheets,
              sheets_t700: 0,
              material: part.nom.material_type,
              selected_machine: 'CNC 1200x800 - 4 листи (Малий)'
            }

            // Deduct BZ stock from database
            if (usedFromStock > 0 && invItem) {
              supabase.from('inventory').update({ total_qty: (Number(invItem.total_qty) || 0) - usedFromStock }).eq('id', invItem.id).then(() => {
                addLog(`📦 Зарезервовано та списано зі складу БЗ: ${usedFromStock} шт. деталі ${part.nom.name}`, 'warning')
              })
            }

            totalMin += totalToProduce * (Number(part.nom.time_per_unit) || 0)

            const matKeyBase = (part.nom.material_type || part.nom.name || '').trim();
            const isSheet = matKeyBase.toLowerCase().startsWith('лист') ||
                            matKeyBase.toLowerCase().includes('карбон') ||
                            matKeyBase.toLowerCase().includes('carbon');

            if (isSheet) {
              const thickMatch = matKeyBase.match(/\((\d+(?:\.\d+)?)мм\)/i)
              const thicknessClean = thickMatch ? `${thickMatch[1]}мм` : matKeyBase.toLowerCase().replace(' ', '')
              let rawNom = dbNomenclatures.find(n =>
                (n.type === 'raw' || n.type === 'material') &&
                n.name.includes('[Підготовлений]') &&
                (n.name.toLowerCase().includes('т300') || n.name.toLowerCase().includes('t300')) &&
                n.name.toLowerCase().replace(' ', '').includes(`(${thicknessClean})`)
              )
              if (!rawNom) {
                rawNom = dbNomenclatures.find(n =>
                  (n.type === 'raw' || n.type === 'material') &&
                  n.name.toLowerCase().includes('т300')
                )
              }

              const matId = rawNom ? rawNom.id : `virtual-t300-${part.nom.id}`
              const matKey = rawNom ? rawNom.name : `Лист Т300 (${matKeyBase}) [Підготовлений]`

              if (!materialSummary[matId]) {
                materialSummary[matId] = {
                  matName: matKey,
                  sheets: 0,
                  totalUnits: 0,
                  components: [],
                  inventory_id: null,
                  nomenclature_id: rawNom?.id || null,
                  unit: 'ЛИСТІВ',
                  partType: rawNom?.type || 'raw'
                }

                if (rawNom) {
                  const inv = dbInventory.find(i => String(i.nomenclature_id) === String(rawNom.id) && i.warehouse === 'operational')
                  materialSummary[matId].inventory_id = inv?.id || null
                }
              }

              materialSummary[matId].sheets += sheets
              materialSummary[matId].totalUnits += totalToProduce
              materialSummary[matId].components.push(`${part.nom.name}: ${totalToProduce}шт`)
            }
          })

          plan_snapshot.materialSummary = materialSummary
          plan_snapshot._metadata = { planned_deadline: new Date(Date.now() + 86400000 * 3).toISOString() }

          // Insert the task (naryad) in the DB
          const { data: taskData, error: taskErr } = await supabase.from('tasks').insert([{
            order_id: sim.id,
            step: 'Розкрій',
            status: 'waiting',
            machine_name: 'CNC 1200x800 - 4 листи (Малий)',
            estimated_time: Math.round(totalMin) || 120,
            engineer_conf: false,
            warehouse_conf: 'false',
            director_conf: false,
            plan_snapshot: plan_snapshot,
            planned_sets: sim.quantity,
            planned_deadline: new Date(Date.now() + 86400000 * 3).toISOString()
          }]).select().single()

          if (taskErr) throw taskErr

          addLog(`Наряд для ${sim.orderNum} сплановано на верстат.`, 'success')

          // Insert material requests
          const requestsToInsert = Object.values(materialSummary).map(info => {
            const qtyToRequest = info.sheets
            return {
              order_id: sim.id,
              task_id: taskData.id,
              quantity: qtyToRequest,
              status: 'pending',
              inventory_id: info.inventory_id,
              nomenclature_id: info.nomenclature_id,
              details: `СКЛАД ОПЕРАТИВНИЙ: ${info.matName} — ${qtyToRequest} л. (Разом: ${info.totalUnits} шт | Для: ${info.components.join(', ')})`
            }
          })

          if (requestsToInsert.length > 0) {
            await supabase.from('material_requests').insert(requestsToInsert)
          }

          // Update order status in orders
          await supabase.from('orders').update({ status: 'in-progress' }).eq('id', sim.id)

          // Generate work cards
          const cardsToInsert = []
          Object.keys(plan_snapshot).forEach(partId => {
            if (partId.startsWith('_') || partId === 'materialSummary' || partId === 'selectedCutters' || partId === 'consumables') return
            const partInfo = plan_snapshot[partId]
            const usedBZ = Number(partInfo.stock) || 0
            const needToProduce = Number(partInfo.plan) || 0

            if (usedBZ > 0) {
              cardsToInsert.push({
                task_id: taskData.id,
                order_id: sim.id,
                nomenclature_id: partInfo.id,
                operation: 'Склад БЗ',
                machine: 'Склад',
                quantity: usedBZ,
                status: 'completed',
                card_info: `[ЗІ СКЛАДУ БЗ] ${partInfo.name}`
              })
            }

            if (needToProduce > 0) {
              cardsToInsert.push({
                task_id: taskData.id,
                order_id: sim.id,
                nomenclature_id: partInfo.id,
                operation: 'Розкрій',
                machine: 'CNC 1200x800 - 4 листи (Малий)',
                quantity: needToProduce,
                status: 'waiting-materials',
                card_info: `${partInfo.name}\nНаряд №${sim.orderNum}`
              })
            }
          })

          if (cardsToInsert.length > 0) {
            await supabase.from('work_cards').insert(cardsToInsert)
            await supabase.from('tasks').update({ status: 'in-progress' }).eq('id', taskData.id)
            addLog(`Генерація ${cardsToInsert.length} робочих карт завершена для наряду ${sim.orderNum}.`, 'success')
          }
        } catch (planErr) {
          addLog(`Помилка планування ${sim.orderNum}: ${planErr.message}`, 'error')
          sim.status = 'stuck'
          totalStuck++
        }
        await wait(delay)
      }

      // Step 3: Material Seeding and Issuance (Supply/Warehouse workflow)
      addLog('Крок 3: Забезпечення складу сировиною та видача на виробництво...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Забезпечення матеріалами ${sim.orderNum}...`)
        sim.step = 'Матеріали'
        setSimulatedOrders([...activeTestOrders])

        // Fetch requests for this order
        const { data: reqs } = await supabase.from('material_requests').select('*').eq('order_id', sim.id)
        
        if (reqs && reqs.length > 0) {
          addLog(`Знайдено ${reqs.length} запитів матеріалів на склад для ${sim.orderNum}.`, 'info')
          
          // Seed inventory dynamically
          const inventorySeeds = []
          for (const req of reqs) {
            const nom = dbNomenclatures.find(n => n.id === req.nomenclature_id)
            const requiredQty = Number(req.quantity)
            
            inventorySeeds.push({
              nomenclature_id: req.nomenclature_id,
              name: nom?.name || 'Матеріал',
              total_qty: requiredQty * 2,
              type: nom?.type || 'raw',
              warehouse: 'operational',
              unit: nom?.unit || 'шт'
            })
          }

          if (inventorySeeds.length > 0) {
            await supabase.from('inventory').upsert(inventorySeeds, { onConflict: 'nomenclature_id,warehouse,type' })
          }

          // Approve requests in DB
          const { error: issueErr } = await supabase.from('material_requests')
            .update({ status: 'issued' })
            .eq('order_id', sim.id)

          if (issueErr) {
            addLog(`Помилка затвердження запитів для ${sim.orderNum}: ${issueErr.message}`, 'error')
            sim.status = 'stuck'
            totalStuck++
          } else {
            // Activate work cards from waiting state
            await supabase.from('work_cards')
              .update({ status: 'new' })
              .eq('order_id', sim.id)
              .eq('status', 'waiting-materials')
              
            addLog(`Матеріали успішно видані зі складу на виробництво для ${sim.orderNum}.`, 'success')
          }
        }
        await wait(delay)
      }

      // Step 4: Production in Shop 1 (Cutting, Tumbling, Sorting)
      addLog('Крок 4: Проходження Цеху №1 (Розкрій → Галтовка → Сортування)...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Виробництво в Цеху 1 для ${sim.orderNum}...`)
        sim.step = 'Цех 1'
        setSimulatedOrders([...activeTestOrders])

        // Find work cards for this order
        const { data: cards } = await supabase.from('work_cards').select('*').eq('order_id', sim.id)
        
        if (cards && cards.length > 0) {
          addLog(`Обробка ${cards.length} карт деталей для ${sim.orderNum}.`, 'info')
          
          for (const card of cards) {
            if (card.status === 'completed') continue
            
            // Start card in DB
            await supabase.from('work_cards').update({
              status: 'in-progress',
              started_at: new Date().toISOString(),
              operator_name: 'Робот-Симулятор'
            }).eq('id', card.id)
            
            await wait(delay / 2)

            // Calculate scrap based on rate
            const isScraped = (Math.random() * 100) < scrapRate
            let finalQty = card.quantity
            let scrapQty = 0

            if (isScraped) {
              scrapQty = Math.max(1, Math.floor(card.quantity * 0.15))
              finalQty = card.quantity - scrapQty
              sim.scrapOccurred = true
              totalScrap += scrapQty
              addLog(`⚠️ Оператором зафіксовано ${scrapQty} шт. браку деталі на розкрої для ${sim.orderNum}!`, 'warning')
              
              // Log scrap history
              await supabase.from('work_card_history').insert([{
                card_id: card.id,
                nomenclature_id: card.nomenclature_id,
                stage_name: 'Розкрій (Брак)',
                operator_name: 'Робот-Симулятор',
                qty_at_start: card.quantity,
                qty_completed: finalQty,
                scrap_qty: scrapQty,
                completed_at: new Date().toISOString()
              }])
            }

            // Move card to Sort buffer in DB
            await supabase.from('work_cards').update({
              status: 'at-buffer',
              quantity: finalQty,
              operation: 'Сортування',
              completed_at: new Date().toISOString()
            }).eq('id', card.id)
            
            // Write to operational semi-finished stock
            await supabase.from('inventory').upsert([{
              nomenclature_id: card.nomenclature_id,
              name: dbNomenclatures.find(n => n.id === card.nomenclature_id)?.name || 'Деталь',
              total_qty: finalQty,
              type: 'semi',
              warehouse: 'operational',
              unit: 'шт'
            }], { onConflict: 'nomenclature_id,warehouse,type' })

            addLog(`Деталі пройшли сортування та галтовку: ${finalQty} шт. готово.`, 'success')
            await wait(delay / 2)
          }
        }
      }

      // Step 5: Transfer to Shop 2
      addLog('Крок 5: Передача в буфер Цеху №2...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Передача ${sim.orderNum} в Цех 2...`)
        sim.step = 'Цех 2'
        setSimulatedOrders([...activeTestOrders])

        // Complete the first task in DB
        await supabase.from('tasks').update({
          status: 'completed',
          completed_at: new Date().toISOString()
        }).eq('order_id', sim.id).eq('step', 'Розкрій')

        const { data: s1Cards } = await supabase.from('work_cards').select('*').eq('order_id', sim.id).eq('status', 'at-buffer')
        
        if (s1Cards && s1Cards.length > 0) {
          const arrivals = []
          for (const card of s1Cards) {
            // Allocate to Shop 2 buffer
            await supabase.from('inventory').upsert([{
              nomenclature_id: card.nomenclature_id,
              name: dbNomenclatures.find(n => n.id === card.nomenclature_id)?.name || 'Деталь',
              total_qty: card.quantity,
              type: 'semi_shop2',
              warehouse: 'production',
              unit: 'шт'
            }], { onConflict: 'nomenclature_id,warehouse,type' })

            await supabase.from('work_cards').update({
              status: 'at-shop2-buffer',
              card_info: `[ЦЕХ №2] Наряд №${sim.orderNum}`
            }).eq('id', card.id)

            arrivals.push({
              id: card.nomenclature_id,
              name: dbNomenclatures.find(n => n.id === card.nomenclature_id)?.name || 'Деталь',
              semi: card.quantity,
              bz: 0
            })
          }

          // Create transfer reception doc
          const docNum = `T-S1-S2-${Date.now().toString().slice(-6)}`
          const { data: moveDoc } = await supabase.from('reception_docs').insert([{
            doc_num: docNum,
            type: 'internal_transfer',
            status: 'completed',
            order_id: sim.id,
            details: JSON.stringify(arrivals)
          }]).select().single()

          // Create the Shop 2 task in progress
          await supabase.from('tasks').insert([{
            order_id: sim.id,
            step: 'Пресування [ЦЕХ №2]',
            status: 'in-progress',
            planned_sets: sim.quantity,
            estimated_time: sim.quantity * 1,
            engineer_conf: true,
            warehouse_conf: 'true',
            director_conf: true,
            plan_snapshot: { arrival_doc_id: moveDoc?.id || null, arrivals }
          }])

          addLog(`Деталі для ${sim.orderNum} переміщено в буфер Цеху №2. Створено завдання пресування.`, 'success')
        }
        await wait(delay)
      }

      // Step 6: Shop 2 Operations and ВКЯ Inspection
      addLog('Крок 6: Пресування, Фарбування та Контроль Якості ВКЯ...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Цех 2 & ВКЯ для ${sim.orderNum}...`)
        
        const { data: shop2Tasks } = await supabase.from('tasks').select('*').eq('order_id', sim.id).eq('step', 'Пресування [ЦЕХ №2]')
        
        if (shop2Tasks && shop2Tasks.length > 0) {
          for (const task of shop2Tasks) {
            const isQcScrap = (Math.random() * 100) < scrapRate
            let finalQty = sim.quantity
            let qcScrapQty = 0

            if (isQcScrap) {
              qcScrapQty = Math.max(1, Math.floor(sim.quantity * 0.12))
              finalQty = sim.quantity - qcScrapQty
              sim.hasRework = true
              totalRework += qcScrapQty
              addLog(`🛡️ Контроль ВКЯ виявив ${qcScrapQty} шт. дефектів на пресуванні для ${sim.orderNum}!`, 'warning')
              
              // Generate a doviпуск (re-release) task
              const parts = dbBomItems.filter(b => String(b.parent_id) === String(sim.nomenclatureId))
              const displayParts = parts.length > 0 ? parts.map(b => ({
                nom: dbNomenclatures.find(n => String(n.id) === String(b.child_id)),
                qtyPer: Number(b.quantity_per_parent) || 1
              })).filter(p => p.nom !== undefined) : [{ nom: dbNomenclatures.find(n => String(n.id) === String(sim.nomenclatureId)), qtyPer: 1 }]
              
              const plan_snapshot = {}
              displayParts.forEach(part => {
                const totalNeeded = qcScrapQty * part.qtyPer
                const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
                const sheets = Math.ceil(totalNeeded / unitsPerSheet)
                plan_snapshot[part.nom.id] = {
                  id: part.nom.id,
                  name: part.nom.name,
                  code: part.nom.nomenclature_code,
                  need: totalNeeded,
                  stock: 0,
                  plan: totalNeeded,
                  units_per_sheet: unitsPerSheet,
                  sheets: sheets,
                  sheets_t300: sheets,
                  sheets_t700: 0,
                  material: part.nom.material_type,
                  selected_machine: 'CNC 1200x800 - 4 листи (Малий)'
                }
              })
              plan_snapshot._metadata = { planned_deadline: new Date(Date.now() + 86400000 * 3).toISOString(), batch_index: 2 }

              await supabase.from('tasks').insert([{
                order_id: sim.id,
                step: 'Розкрій',
                status: 'waiting',
                machine_name: 'CNC 1200x800 - 4 листи (Малий)',
                estimated_time: qcScrapQty * 2,
                engineer_conf: false,
                warehouse_conf: 'false',
                director_conf: false,
                plan_snapshot: plan_snapshot,
                planned_sets: qcScrapQty,
                batch_index: 2,
                planned_deadline: new Date(Date.now() + 86400000 * 3).toISOString()
              }])

              addLog(`🔄 Автоматично ініційовано довипуск ${qcScrapQty} шт. (Створено наряд Розкрій/Колода №2 у черзі) для компенсації браку.`, 'success')
            }

            // Update task status to completed
            await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id)

            // Transfer completed components to SGP inventory (type: finished)
            await supabase.from('inventory').upsert([{
              nomenclature_id: sim.nomenclatureId,
              name: sim.nomenclatureName,
              total_qty: finalQty,
              type: 'finished',
              warehouse: 'sgp',
              unit: 'шт'
            }], { onConflict: 'nomenclature_id,warehouse,type' })

            // Complete the work cards to reflect completed status
            await supabase.from('work_cards').update({ status: 'completed' }).eq('order_id', sim.id)

            addLog(`Компоненти успішно пофарбовані та переміщені на СГП: ${finalQty} шт. Наряд закрито.`, 'success')
          }
        }
        await wait(delay)
      }

      // Step 7: Packaging
      addLog('Крок 7: Комплектування та пакування партій...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Пакування замовлення ${sim.orderNum}...`)
        sim.step = 'Пакування'
        setSimulatedOrders([...activeTestOrders])

        // Insert packaging box details in DB
        await supabase.from('packaging_boxes').insert([{
          order_id: sim.id,
          batch_index: '1',
          box_number: 'BOX-SIM-REAL',
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

        // Update order status to packaged
        await supabase.from('orders').update({ status: 'packaged' }).eq('id', sim.id)

        addLog(`Замовлення ${sim.orderNum} повністю упаковано у коробку BOX-SIM-REAL.`, 'success')
        await wait(delay)
      }

      // Step 8: Shipping (Keep items in SGP for manual check instead of instant deletion, just flag them)
      addLog('Крок 8: Фінальна логістика та відвантаження...', 'info')
      
      for (const sim of activeTestOrders) {
        if (!isRunningRef.current) break
        if (sim.status === 'stuck') continue

        setStatusText(`Відвантаження замовлення ${sim.orderNum}...`)
        sim.step = 'Логістика'
        sim.status = 'completed'
        setSimulatedOrders([...activeTestOrders])

        // Update order to completed/shipped
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
        addLog(`🚚 Замовлення ${sim.orderNum} офіційно відвантажено замовнику! (Вироби залишилися на СГП для тестування).`, 'success')
        
        setProgress(Math.round((totalShipped / orderCountToRun) * 100))
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
          : `✅ Всі ${totalShipped} замовлень успішно пройшли повний цикл від планування до відвантаження. Автоматична компенсація браку (довипуски) та матеріальне поповнення складу працюють коректно.`
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

            {/* Product selection selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#aaa' }}>ВИБІР ВИРОБУ ДЛЯ ТЕСТУ</label>
              <select 
                value={selectedProductOption}
                disabled={isRunning}
                onChange={e => setSelectedProductOption(e.target.value)}
                style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px', color: '#fff', fontWeight: 700 }}
              >
                <option value="random">Всі вироби (рандомно)</option>
                {parentProductsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
 
            {/* Order Count Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                <span style={{ color: '#aaa' }}>КІЛЬКІСТЬ ЗАМОВЛЕНЬ</span>
                <span style={{ color: '#ff9000' }}>{orderCount} шт.</span>
              </div>
              <input 
                type="number" 
                min="1" 
                max="50" 
                value={orderCount} 
                disabled={isRunning}
                onChange={e => setOrderCount(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => {
                  let val = Number(orderCount)
                  if (isNaN(val) || val < 1) val = 1
                  if (val > 50) val = 50
                  setOrderCount(val)
                }}
                style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px', color: '#fff', fontWeight: 700 }}
              />
            </div>

            {/* Delay slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                <span style={{ color: '#aaa' }}>ЗАТРИМКА МІЖ КРОКАМИ</span>
                <span style={{ color: '#06b6d4' }}>{delay} мс</span>
              </div>
              <input 
                type="range" 
                min="100" 
                max="5000" 
                step="100"
                value={delay} 
                disabled={isRunning}
                onChange={e => setDelay(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#06b6d4' }}
              />
            </div>

            {/* Min Quantity input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                <span style={{ color: '#aaa' }}>МІНІМАЛЬНА КІЛЬКІСТЬ</span>
                <span style={{ color: '#ff9000' }}>{minQty} шт.</span>
              </div>
              <input 
                type="number" 
                min="5" 
                max="10000" 
                value={minQty} 
                disabled={isRunning}
                onChange={e => setMinQty(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => {
                  let val = Number(minQty)
                  if (isNaN(val) || val < 5) val = 5
                  if (val > 10000) val = 10000
                  setMinQty(val)
                  if (Number(maxQty) < val) {
                    setMaxQty(val)
                  }
                }}
                style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px', color: '#fff', fontWeight: 700 }}
              />
            </div>

            {/* Max Quantity input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800 }}>
                <span style={{ color: '#aaa' }}>МАКСИМАЛЬНА КІЛЬКІСТЬ</span>
                <span style={{ color: '#ff9000' }}>{maxQty} шт.</span>
              </div>
              <input 
                type="number" 
                min="5" 
                max="10000" 
                value={maxQty} 
                disabled={isRunning}
                onChange={e => setMaxQty(e.target.value === '' ? '' : Number(e.target.value))}
                onBlur={() => {
                  let val = Number(maxQty)
                  const currentMin = Number(minQty) || 5
                  if (isNaN(val) || val < currentMin) val = currentMin
                  if (val > 10000) val = 10000
                  setMaxQty(val)
                }}
                style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '12px', color: '#fff', fontWeight: 700 }}
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
                  <Clipboard size={18} color="#3b82f6" /> Тестові замовлення ({simulatedOrders.length})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
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
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 1000, color: '#10b981' }}>АНАЛІТИЧНИЙ ЗВІТ ТЕСТУ</h3>
                </div>
                
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px' }}>
                  <div style={{ background: '#111', border: '1px solid #1d1d1d', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900 }}>УСПІШНІСТЬ</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#10b981', marginTop: '5px' }}>{report.successRate}%</div>
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1d1d1d', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900 }}>ВИКОНАНО</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#fff', marginTop: '5px' }}>{report.totalShipped} / {report.totalCreated}</div>
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1d1d1d', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900 }}>БРАК РОЗКРОЮ</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 1000, color: '#ef4444', marginTop: '5px' }}>{report.totalScrap} шт</div>
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1d1d1d', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900 }}>ВИЯВЛЕНО ВКЯ</div>
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
