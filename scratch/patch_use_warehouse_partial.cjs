const fs = require('fs');

const filePath = 'a:/centrum/src/contexts/useWarehouse.js';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `        if (invItem) {
          const available = (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0)
          const toReserve = Math.min(available, Number(req.quantity))
          
          if (toReserve > 0) {
            inventoryUpdateMap[invItem.id] = (inventoryUpdateMap[invItem.id] || 0) + toReserve
          }
          requestUpdateList.push({ id: req.id, status: 'issued', inventory_id: invItem.id })
        } else {
          requestUpdateList.push({ id: req.id, status: 'issued' })
        }
      })`;

const replacement = `        if (invItem) {
          const available = Math.max(0, (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0))
          const needed = Number(req.quantity) || 0
          
          if (available >= needed) {
            // Повне забезпечення
            inventoryUpdateMap[invItem.id] = (inventoryUpdateMap[invItem.id] || 0) + needed
            requestUpdateList.push({ id: req.id, status: 'issued', inventory_id: invItem.id })
          } else if (available > 0) {
            // Часткове забезпечення: розділяємо на два запити (виданий і дефіцитний)
            const shortage = needed - available
            inventoryUpdateMap[invItem.id] = (inventoryUpdateMap[invItem.id] || 0) + available
            
            // 1. Оновлюємо оригінальний запит на кількість, яка є в наявності, і ставимо status: 'issued'
            requestUpdateList.push({ id: req.id, status: 'issued', inventory_id: invItem.id, quantity: available })
            
            // 2. Додаємо новий запит на дефіцит у pending
            requestsToInsert.push({
              order_id: req.order_id,
              task_id: req.task_id,
              nomenclature_id: req.nomenclature_id,
              quantity: shortage,
              status: 'pending',
              details: req.details ? req.details.replace(\` — \${needed} шт.\`, \` — \${shortage} шт.\`) : \`Дефіцит: \${shortage} шт.\`
            })
          } else {
            // Немає в наявності взагалі — запит залишається в pending
            // Але оскільки комірник його надіслав у пакеті, ми просто ігноруємо його переведення в issued,
            // щоб він чекав на Склад
          }
        } else {
          // Якщо немає зв'язку з інвентарем, але чомусь є запит (наприклад, СГП)
          requestUpdateList.push({ id: req.id, status: 'issued' })
        }
      })`;

// Також додамо ініціалізацію requestsToInsert на початку функції
const startFuncStr = `      const inventoryUpdateMap = {}
      const requestUpdateList = []`;

const startFuncReplacement = `      const inventoryUpdateMap = {}
      const requestUpdateList = []
      const requestsToInsert = []`;

// Також оновлюємо запис у базу даних матеріальних запитів, де додаємо insert
const dbWriteStr = `      const reqPromises = requestUpdateList.length > 0
        ? [supabase.from('material_requests').upsert(requestUpdateList.map(upd => ({
            id: upd.id,
            status: upd.status,
            inventory_id: upd.inventory_id
          })))]
        : []`;

const dbWriteReplacement = `      const reqPromises = []
      if (requestUpdateList.length > 0) {
        reqPromises.push(supabase.from('material_requests').upsert(requestUpdateList.map(upd => {
          const res = {
            id: upd.id,
            status: upd.status,
            inventory_id: upd.inventory_id
          }
          if (upd.quantity !== undefined) res.quantity = upd.quantity
          return res
        })))
      }
      if (requestsToInsert.length > 0) {
        reqPromises.push(supabase.from('material_requests').insert(requestsToInsert))
      }`;

// І міняємо оновлення warehouse_conf наприкінці
const whConfStr = `      if (taskId) {
        await supabase.from('tasks').update({ warehouse_conf: true }).eq('id', taskId)
      }

      setRequests(prev => prev.map(r => {
        const upd = requestUpdateList.find(u => u.id === r.id)
        if (upd) return { ...r, status: upd.status, inventory_id: upd.inventory_id }
        return r
      }))
      if (taskId) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, warehouse_conf: true } : t))
      }`;

const whConfReplacement = `      if (taskId) {
        const { data: updatedReqs } = await supabase
          .from('material_requests')
          .select('status')
          .eq('task_id', taskId)
        
        const reqList = updatedReqs || []
        const allCompletedOrIssued = reqList.length > 0 && reqList.every(r => r.status === 'issued' || r.status === 'completed')
        const someIssued = reqList.some(r => r.status === 'issued' || r.status === 'completed')
        
        const nextWhConf = allCompletedOrIssued ? true : (someIssued ? 'partial' : false)
        
        await supabase.from('tasks').update({ warehouse_conf: nextWhConf }).eq('id', taskId)
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, warehouse_conf: nextWhConf } : t))
      } else {
        if (typeof fetchData === 'function') fetchData(['tasks'])
      }`;

let success = true;

if (content.includes(startFuncStr)) {
  content = content.replace(startFuncStr, startFuncReplacement);
} else {
  console.log('❌ Could not find startFuncStr');
  success = false;
}

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
} else {
  console.log('❌ Could not find targetStr');
  success = false;
}

if (content.includes(dbWriteStr)) {
  content = content.replace(dbWriteStr, dbWriteReplacement);
} else {
  console.log('❌ Could not find dbWriteStr');
  success = false;
}

if (content.includes(whConfStr)) {
  content = content.replace(whConfStr, whConfReplacement);
} else {
  console.log('❌ Could not find whConfStr');
  success = false;
}

if (success) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ useWarehouse.js updated with partial reservation logic!');
}
