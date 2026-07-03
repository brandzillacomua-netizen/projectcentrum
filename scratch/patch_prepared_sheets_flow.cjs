const fs = require('fs');
const filePath = 'a:/centrum/src/modules/WarehouseModuleV2.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// === 1. handleReserveOrder: не відкривати модалку PR для підготовлених листів ===
const targetShortageOpen = `      // Якщо після часткового резервування виявився дефіцит — відкриваємо діалог для PR
      if (missingItems.length > 0) {
        setShortages({ orderId, orderNum, taskId, items: missingItems, reqList })
      } else {
        alert('Наряд повністю зарезервовано та погоджено!')
      }`;

const replacementShortageOpen = `      // Якщо після часткового резервування виявився дефіцит — відкриваємо діалог для PR
      // АЛЕ: підготовлені листи не відправляємо на СВ — вони чекають від підготовки
      const nonPreparedMissing = missingItems.filter(item => {
        const nameLower = (item.name || item.reqDetails || '').toLowerCase()
        return !(nameLower.includes('лист') && nameLower.includes('підготовлений'))
      })
      if (nonPreparedMissing.length > 0) {
        setShortages({ orderId, orderNum, taskId, items: nonPreparedMissing, reqList })
      } else if (missingItems.length > 0) {
        // Тільки підготовлені листи в дефіциті — не відкриваємо модалку PR, просто чекаємо
        // warehouse_conf вже встановлено в 'partial' через issueMaterialsBatch
      } else {
        alert('Наряд повністю зарезервовано та погоджено!')
      }`;

if (content.includes(targetShortageOpen)) {
  content = content.replace(targetShortageOpen, replacementShortageOpen);
  console.log('✅ Patch 1 applied: handleReserveOrder shortage filter for prepared sheets');
} else {
  console.log('❌ Patch 1 NOT found');
}

// === 2. Логіка кнопки: ОЧІКУЄМО ЛИСТИ якщо частково видано і залишились підготовлені листи ===
const targetBtnLogic = `                const isAllIssued = reqList.every(r => r.status === 'issued')

                // Пріоритетність статусів
                let btnLabel = ''
                let isAwaiting = false

                if (missingItems.length === 0) {
                  // Якщо товару достатньо - завжди показуємо кнопку видачі
                  btnLabel = isAllIssued ? 'ПІДТВЕРДИТИ ВИДАЧУ' : 'ВИДАТИ'
                  isAwaiting = false 
                } else if (activePR) {`;

const replacementBtnLogic = `                const isAllIssued = reqList.every(r => r.status === 'issued')
                const hasAnyIssued = reqList.some(r => r.status === 'issued')

                // Перевіряємо чи всі дефіцитні позиції — це підготовлені листи
                const allMissingArePreparedSheets = missingItems.length > 0 && missingItems.every(item => {
                  const nameLower = (item.name || item.reqDetails || '').toLowerCase()
                  return nameLower.includes('лист') && nameLower.includes('підготовлений')
                })

                // Пріоритетність статусів
                let btnLabel = ''
                let isAwaiting = false

                if (missingItems.length === 0) {
                  // Якщо товару достатньо - завжди показуємо кнопку видачі
                  btnLabel = isAllIssued ? 'ПІДТВЕРДИТИ ВИДАЧУ' : 'ВИДАТИ'
                  isAwaiting = false 
                } else if (hasAnyIssued && allMissingArePreparedSheets) {
                  // Частково видано, чекаємо підготовлені листи від підготовки (не від СВ!)
                  btnLabel = 'ОЧІКУЄМО ЛИСТИ'
                  isAwaiting = true
                } else if (activePR) {`;

if (content.includes(targetBtnLogic)) {
  content = content.replace(targetBtnLogic, replacementBtnLogic);
  console.log('✅ Patch 2 applied: button label logic for partial issuance with prepared sheets');
} else {
  console.log('❌ Patch 2 NOT found');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('🏁 Done.');
