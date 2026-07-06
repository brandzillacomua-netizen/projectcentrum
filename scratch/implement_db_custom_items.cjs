const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// Replace handleConfirmAddItem to write directly to DB task plan_snapshot
const oldAddItem = `  const handleConfirmAddItem = () => {
    if (!addItemSelectedNom || !addItemQty) return
    const catKey = addItemCategoryKey
    setCustomItems(prev => [...prev, {
      nom: addItemSelectedNom,
      qty: Number(addItemQty),
      categoryKey: catKey,
      uid: \`custom_\${addItemSelectedNom.id}_\${Date.now()}\`
    }])
    setShowAddItemModal(false)
  }`;

const newAddItem = `  const handleConfirmAddItem = async () => {
    if (!addItemSelectedNom || !addItemQty || !activeBatchData) return
    const firstTask = activeBatchData.tasks[0]
    if (!firstTask) return

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

// Replace handleRemoveCustomItem (or handleRemoveCustomItem definition)
const oldRemoveItem = `  const handleRemoveCustomItem = (uid) => {
    setCustomItems(prev => prev.filter(ci => ci.uid !== uid))
  }`;

const newRemoveItem = `  const handleRemoveCustomItem = async (nomId) => {
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

// Update handleCreateRequest to filter out items that already have a request and log it
const oldCreateRequest = `  const handleCreateRequest = async () => {
    const activeBOMItems = allBOMItems.filter(item => {
      const isExcluded = excludedNomIds.has(item.nom.id)
      const reqRequest = orderRequests.find(r => String(r.nomenclature_id) === String(item.nom.id))
      const hasActiveOrCompletedRequest = reqRequest && ['pending', 'processing', 'completed', 'issued'].includes(reqRequest.status)
      return !isExcluded && !hasActiveOrCompletedRequest
    })
    if (activeBOMItems.length === 0) { alert('Немає активних елементів для комплектування (всі інші вже надіслані або підтверджені)'); return }
    const itemsToRequest = activeBOMItems.map(r => {
      // Використовуємо кастомну кількість пакувальника якщо вказана, інакше планову
      const effectiveQty = customQty[String(r.nom.id)] !== undefined ? Number(customQty[String(r.nom.id)]) : r.qty
      return { nomId: r.nom.id, name: r.nom.material_type ? \`\${r.nom.name} (\${r.nom.material_type})\` : r.nom.name, qty: effectiveQty }
    })`;

const newCreateRequest = `  const handleCreateRequest = async () => {
    // 1. Оновлюємо дані перед відправкою, щоб мати найсвіжіші запити з бази
    await fetchData('material_requests')
    
    const activeBOMItems = allBOMItems.filter(item => {
      const isExcluded = excludedNomIds.has(item.nom.id)
      // Шукаємо БУДЬ-ЯКИЙ запит для цієї номенклатури у межах поточного замовлення/наряду
      const hasReq = (requests || []).some(r => 
        String(r.order_id) === String(activeBatchData.orderId) &&
        String(r.nomenclature_id) === String(item.nom.id) &&
        ['pending', 'processing', 'completed', 'issued'].includes(r.status)
      )
      return !isExcluded && !hasReq
    })
    
    if (activeBOMItems.length === 0) { 
      alert('Немає нових елементів для комплектування (всі позиції вже були надіслані в запитах або підтверджені)'); 
      return 
    }
    
    const itemsToRequest = activeBOMItems.map(r => {
      const effectiveQty = customQty[String(r.nom.id)] !== undefined ? Number(customQty[String(r.nom.id)]) : r.qty
      return { nomId: r.nom.id, name: r.nom.material_type ? \`\${r.nom.name} (\${r.nom.material_type})\` : r.nom.name, qty: effectiveQty }
    })`;

let success = true;

if (content.includes(oldAddItem)) {
  content = content.replace(oldAddItem, newAddItem);
  console.log('SUCCESS: AddItem replaced');
} else {
  console.error('ERROR: AddItem not found');
  success = false;
}

if (content.includes(oldRemoveItem)) {
  content = content.replace(oldRemoveItem, newRemoveItem);
  console.log('SUCCESS: RemoveItem replaced');
} else {
  console.error('ERROR: RemoveItem not found');
  success = false;
}

if (content.includes(oldCreateRequest)) {
  content = content.replace(oldCreateRequest, newCreateRequest);
  console.log('SUCCESS: CreateRequest replaced');
} else {
  console.error('ERROR: CreateRequest not found');
  success = false;
}

if (success) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('SUCCESS: DB Custom Items implemented successfully!');
}
