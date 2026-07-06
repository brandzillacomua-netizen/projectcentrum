const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const handleCreateRequest = async () =>')) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines[i].includes('setIsProcessing(false) }') && lines[i+1].includes('}')) {
    endIdx = i + 1;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  console.log(`Found handleCreateRequest from line ${startIdx+1} to ${endIdx+1}`);
  
  const newCreateRequest = `  const handleCreateRequest = async () => {
    setIsProcessing(true)
    try {
      // Спочатку підтягуємо найсвіжіші запити
      await fetchData('material_requests')

      const activeBOMItems = allBOMItems.filter(item => {
        const isExcluded = excludedNomIds.has(item.nom.id)
        // Шукаємо будь-який активний чи завершений запит по цьому виробу в межах наряду
        const hasReq = (requests || []).some(r =>
          String(r.order_id) === String(activeBatchData.orderId) &&
          String(r.nomenclature_id) === String(item.nom.id) &&
          ['pending', 'processing', 'completed', 'issued'].includes(r.status)
        )
        return !isExcluded && !hasReq
      })

      if (activeBOMItems.length === 0) {
        alert('Немає нових деталей для комплектування (всі інші позиції вже були надіслані раніше або підтверджені)');
        return
      }

      const itemsToRequest = activeBOMItems.map(r => {
        const effectiveQty = customQty[String(r.nom.id)] !== undefined ? Number(customQty[String(r.nom.id)]) : r.qty
        return { nomId: r.nom.id, name: r.nom.material_type ? \`\${r.nom.name} (\${r.nom.material_type})\` : r.nom.name, qty: effectiveQty }
      })

      await submitPickingRequest(activeBatchData.orderId, itemsToRequest, activeBatchData.tasks[0]?.id)
      alert('Запит успішно відправлено!')
      await fetchData('material_requests')
    } catch (e) {
      console.error(e)
      alert('Помилка створення запиту')
    } finally {
      setIsProcessing(false)
    }
  }`;

  lines.splice(startIdx, (endIdx - startIdx + 1), newCreateRequest);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('SUCCESS: handleCreateRequest replaced and file saved.');
} else {
  console.error('ERROR: Could not find handleCreateRequest block!');
}
