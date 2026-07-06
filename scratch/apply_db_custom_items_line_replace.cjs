const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// 1. Replace handleCreateRequest (lines 498-512 in the file)
// Let's verify what is at lines 498-512 first
console.log('Line 498:', lines[497]); // 0-indexed index 497 is line 498
console.log('Line 512:', lines[511]);

if (lines[497].includes('const handleCreateRequest') && lines[511].includes('setIsProcessing(false) }')) {
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

  lines.splice(497, 15, newCreateRequest);
  console.log('SUCCESS: handleCreateRequest replaced.');
} else {
  console.error('ERROR: handleCreateRequest lines mismatch!');
}

// Reload content after first replace since line count changed
content = lines.join('\n');
const lines2 = content.split('\n');

// Find handleConfirmAddItem
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines2.length; i++) {
  if (lines2[i].includes('const handleConfirmAddItem = () =>')) {
    startIdx = i;
  }
  if (startIdx !== -1 && lines2[i].includes('setShowAddItemModal(false)') && lines2[i+1].includes('}')) {
    endIdx = i + 1;
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  console.log(`Found handleConfirmAddItem from line ${startIdx+1} to ${endIdx+1}`);
  
  const newAddItem = `  const handleConfirmAddItem = async () => {
    if (!addItemSelectedNom || !addItemQty || !activeBatchData) return
    const firstTask = activeBatchData.tasks[0]
    if (!firstTask) return

    // Don't add if already in BOM from spec
    const existsInBOM = allBOMItems.some(item => String(item.nom.id) === String(addItemSelectedNom.id) && !item.isCustom)
    if (existsInBOM) {
      alert(\`"\${addItemSelectedNom.name}" вже є в специфікації. Щоб змінити кількість — відредагуйте поле кількості напроти цієї позиції.\`)
      return
    }

    setIsProcessing(true)
    try {
      const snap = { ...(firstTask.plan_snapshot || {}) }
      snap[addItemSelectedNom.id] = {
        need: Number(addItemQty),
        is_custom_packaging: true
      }

      const { error } = await supabase
        .from('tasks')
        .update({ plan_snapshot: snap })
        .eq('id', firstTask.id)

      if (error) throw error

      await fetchData('tasks')
      setShowAddItemModal(false)
    } catch (e) {
      console.error(e)
      alert('Помилка додавання позиції: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }`;

  lines2.splice(startIdx, (endIdx - startIdx + 1), newAddItem);
  fs.writeFileSync(path, lines2.join('\n'), 'utf8');
  console.log('SUCCESS: handleConfirmAddItem replaced and file saved.');
} else {
  console.error('ERROR: Could not find handleConfirmAddItem block!');
}
