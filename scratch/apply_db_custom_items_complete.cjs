const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Replace handleConfirmAddItem
const target1 = `  const handleConfirmAddItem = () => {
    if (!addItemSelectedNom) return
    if (!addItemQty || Number(addItemQty) <= 0) return

    // Don't add if already in BOM from spec (use customQty instead)
    const existsInBOM = allBOMItems.some(item => String(item.nom.id) === String(addItemSelectedNom.id) && !item.isCustom)
    if (existsInBOM) {
      // Just highlight — can't add duplicate; user can change qty above
      alert(\`"\${addItemSelectedNom.name}" вже є в специфікації. Щоб змінити кількість — відредагуйте поле кількості напроти цієї позиції.\`)
      return
    }

    // Don't add if already in customItems
    const existsCustom = customItems.some(ci => String(ci.nom.id) === String(addItemSelectedNom.id))
    if (existsCustom) {
      alert(\`"\${addItemSelectedNom.name}" вже додано. Видаліть попередній запис або змініть кількість.\`)
      return
    }

    const detectedCat = detectCategoryKey(addItemSelectedNom)
    const catKey = addItemCategoryKey || detectedCat

    setCustomItems(prev => [...prev, {
      nom: addItemSelectedNom,
      qty: Number(addItemQty),
      categoryKey: catKey,
      uid: \`custom_\${addItemSelectedNom.id}_\${Date.now()}\`
    }])
    setShowAddItemModal(false)
  }`;

const replacement1 = `  const handleConfirmAddItem = async () => {
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

// 2. Replace handleRemoveCustomItem
const target2 = `  const handleRemoveCustomItem = (uid) => {
    setCustomItems(prev => prev.filter(ci => ci.uid !== uid))
  }`;

const replacement2 = `  const handleRemoveCustomItem = async (nomId) => {
    if (!activeBatchData) return
    const firstTask = activeBatchData.tasks[0]
    if (!firstTask) return

    setIsProcessing(true)
    try {
      const snap = { ...(firstTask.plan_snapshot || {}) }
      delete snap[nomId]

      const { error } = await supabase
        .from('tasks')
        .update({ plan_snapshot: snap })
        .eq('id', firstTask.id)

      if (error) throw error

      await fetchData('tasks')
    } catch (e) {
      console.error(e)
      alert('Помилка видалення: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }`;

// 3. Replace handleCreateRequest
const target3 = `  const handleCreateRequest = async () => {
    const activeBOMItems = allBOMItems.filter(item => !excludedNomIds.has(item.nom.id))
    if (activeBOMItems.length === 0) { alert('Немає активних елементів для комплектування'); return }
    const itemsToRequest = activeBOMItems.map(r => {
      // Використовуємо кастомну кількість пакувальника якщо вказана, інакше планову
      const effectiveQty = customQty[String(r.nom.id)] !== undefined ? Number(customQty[String(r.nom.id)]) : r.qty
      return { nomId: r.nom.id, name: r.nom.material_type ? \`\${r.nom.name} (\${r.nom.material_type})\` : r.nom.name, qty: effectiveQty }
    })
    try {
      setIsProcessing(true)
      await submitPickingRequest(activeBatchData.orderId, itemsToRequest, activeBatchData.tasks[0]?.id)
      alert('Запит успішно відправлено!')
      await fetchData('material_requests')
    } catch (e) { console.error(e); alert('Помилка створення запиту') } finally { setIsProcessing(false) }
  }`;

const replacement3 = `  const handleCreateRequest = async () => {
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

// 4. Update the delete button trigger call (from uid to nom.id)
const target4 = `                                              {/* Кнопка видалення для кастомних позицій */}
                                              {item.isCustom && (
                                                <button
                                                  onClick={e => { e.stopPropagation(); handleRemoveCustomItem(item.uid) }}`;

const replacement4 = `                                              {/* Кнопка видалення для кастомних позицій */}
                                              {item.isCustom && !isPicked && !activeBatchData.isPackaged && (
                                                <button
                                                  onClick={e => { e.stopPropagation(); handleRemoveCustomItem(item.nom.id) }}`;

let success = true;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log('SUCCESS: Target 1 replaced');
} else {
  console.error('ERROR: Target 1 not found');
  success = false;
}

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('SUCCESS: Target 2 replaced');
} else {
  console.error('ERROR: Target 2 not found');
  success = false;
}

if (content.includes(target3)) {
  content = content.replace(target3, replacement3);
  console.log('SUCCESS: Target 3 replaced');
} else {
  console.error('ERROR: Target 3 not found');
  success = false;
}

if (content.includes(target4)) {
  content = content.replace(target4, replacement4);
  console.log('SUCCESS: Target 4 replaced');
} else {
  console.error('ERROR: Target 4 not found');
  success = false;
}

if (success) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('SUCCESS: All patches written to file!');
}
