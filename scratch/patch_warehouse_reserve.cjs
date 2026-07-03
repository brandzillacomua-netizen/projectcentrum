const fs = require('fs');

const filePath = 'a:/centrum/src/modules/WarehouseModuleV2.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `    if (missingItems.length > 0) {
      setShortages({ orderId, orderNum, taskId, items: missingItems, reqList })
    } else {
      setProcessingTasks(prev => new Set(prev).add(taskId))
      apiService.submitReserveBatch(orderId, reqList, taskId, issueMaterialsBatch).then(() => {
        setProcessingTasks(prev => {
          const next = new Set(prev)
          next.delete(taskId)
          return next
        })
      })
    }`;

const replacement = `    // Завжди спочатку запускаємо резервування наявного матеріалу
    setProcessingTasks(prev => new Set(prev).add(taskId))
    apiService.submitReserveBatch(orderId, reqList, taskId, issueMaterialsBatch).then(() => {
      setProcessingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      
      // Якщо після часткового резервування виявився дефіцит — відкриваємо діалог для PR
      if (missingItems.length > 0) {
        setShortages({ orderId, orderNum, taskId, items: missingItems, reqList })
      } else {
        alert('Наряд повністю зарезервовано та погоджено!')
      }
    }).catch(err => {
      setProcessingTasks(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      alert('Помилка резервування: ' + err.message)
    })`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ WarehouseModuleV2.jsx updated with partial reserve triggers!');
} else {
  console.log('❌ Could not find targetStr inside WarehouseModuleV2.jsx!');
}
