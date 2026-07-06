const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Update batchList batchBOM logic to include requested custom items
const target1 = `      // 2. Add extra items from plan_snapshot of tasks
      const ignoreSnapshotKeys = ['materialSummary', 'selectedCutters', 'consumables', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'];
      batch.tasks.forEach(t => {
        if (t.plan_snapshot) {
          Object.keys(t.plan_snapshot).forEach(key => {
            if (!key.startsWith('_') && !ignoreSnapshotKeys.includes(key)) {
              const nom = nomenclatures.find(n => String(n.id) === String(key))
              if (nom) {
                const nameLower = nom.name?.toLowerCase() || ''
                if (!(nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка')))) {
                  if (!batchBOM.includes(nom.id)) {
                    batchBOM.push(nom.id)
                  }
                }
              }
            }
          })
        }
      })`;

const replacement1 = `      // 2. Add extra items from plan_snapshot of tasks
      const ignoreSnapshotKeys = ['materialSummary', 'selectedCutters', 'consumables', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'];
      batch.tasks.forEach(t => {
        if (t.plan_snapshot) {
          Object.keys(t.plan_snapshot).forEach(key => {
            if (!key.startsWith('_') && !ignoreSnapshotKeys.includes(key)) {
              const nom = nomenclatures.find(n => String(n.id) === String(key))
              if (nom) {
                const nameLower = nom.name?.toLowerCase() || ''
                if (!(nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка')))) {
                  if (!batchBOM.includes(nom.id)) {
                    batchBOM.push(nom.id)
                  }
                }
              }
            }
          })
        }
      })

      // 3. Add items from requests that are not in the BOM or snapshots
      batchReqs.forEach(r => {
        if (!batchBOM.includes(r.nomenclature_id)) {
          batchBOM.push(r.nomenclature_id)
        }
      })`;

// 2. Update categorizedBOM to pull custom items from requests database
const target2 = `    }

    const categories = {
      sgp: { title: '1. ДЕТАЛІ / ГОТОВІ ВИРОБИ (СГП)', items: [], color: '#f43f5e', icon: <Package size={18} /> },`;

const replacement2 = `    }

    // Add any items from requests that are not in the BOM or snapshots (sync across terminals)
    if (activeBatchData) {
      const relevant = (requests || []).filter(r =>
        String(r.order_id) === String(activeBatchData.orderId) &&
        ((activeBatchData.batchIndex && r.details?.includes(\`/\${activeBatchData.batchIndex}\`)) || activeBatchData.tasks.some(t => String(t.id) === String(r.task_id)))
      )
      relevant.forEach(r => {
        const nomIdStr = String(r.nomenclature_id)
        if (!map[nomIdStr]) {
          const nom = nomenclatures.find(n => String(n.id) === nomIdStr)
          if (nom) {
            map[nomIdStr] = { nom, qty: Number(r.quantity) || 0, isCustom: true }
          }
        }
      })
    }

    const categories = {
      sgp: { title: '1. ДЕТАЛІ / ГОТОВІ ВИРОБИ (СГП)', items: [], color: '#f43f5e', icon: <Package size={18} /> },`;

// 3. Keep isCustom value from item in categorizedBOM loop
const target3 = `    Object.values(map).forEach(item => {
      const type = (item.nom.type || '').toLowerCase()
      const name = (item.nom.name || '').toLowerCase()
      const code = (item.nom.nomenclature_code || '').toLowerCase()
      if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) categories.mounts.items.push({ ...item, isCustom: false })
      else if (name.includes('стійка') || type.includes('стійк')) categories.spacers.items.push({ ...item, isCustom: false })
      else if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) categories.other.items.push({ ...item, isCustom: false })
      else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка') || type.includes('hardware') || type.includes('fastener')) categories.hardware.items.push({ ...item, isCustom: false })
      else if (name.includes('-іп') || name.includes(' іп') || code.includes('іп') || type.includes('part') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) categories.sgp.items.push({ ...item, isCustom: false })
      else categories.other.items.push({ ...item, isCustom: false })
    })`;

const replacement3 = `    Object.values(map).forEach(item => {
      const type = (item.nom.type || '').toLowerCase()
      const name = (item.nom.name || '').toLowerCase()
      const code = (item.nom.nomenclature_code || '').toLowerCase()
      if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) categories.mounts.items.push({ ...item, isCustom: item.isCustom || false })
      else if (name.includes('стійка') || type.includes('стійк')) categories.spacers.items.push({ ...item, isCustom: item.isCustom || false })
      else if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) categories.other.items.push({ ...item, isCustom: item.isCustom || false })
      else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка') || type.includes('hardware') || type.includes('fastener')) categories.hardware.items.push({ ...item, isCustom: item.isCustom || false })
      else if (name.includes('-іп') || name.includes(' іп') || code.includes('іп') || type.includes('part') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) categories.sgp.items.push({ ...item, isCustom: item.isCustom || false })
      else categories.other.items.push({ ...item, isCustom: item.isCustom || false })
    })`;

// 4. Add requests to categorizedBOM dependencies array
const target4 = `    return { categorizedBOM: categories, hasBOM: foundAnyBom }
  }, [activeBatchData, orders, bomItems, nomenclatures, customItems])`;

const replacement4 = `    return { categorizedBOM: categories, hasBOM: foundAnyBom }
  }, [activeBatchData, orders, bomItems, nomenclatures, customItems, requests])`;

// 5. Update handleCreateRequest to filter out already confirmed/pending items
const target5 = `  const handleCreateRequest = async () => {
    const activeBOMItems = allBOMItems.filter(item => !excludedNomIds.has(item.nom.id))
    if (activeBOMItems.length === 0) { alert('Немає активних елементів для комплектування'); return }
    const itemsToRequest = activeBOMItems.map(r => {
      // Використовуємо кастомну кількість пакувальника якщо вказана, інакше планову
      const effectiveQty = customQty[String(r.nom.id)] !== undefined ? Number(customQty[String(r.nom.id)]) : r.qty
      return { nomId: r.nom.id, name: r.nom.material_type ? \`\${r.nom.name} (\${r.nom.material_type})\` : r.nom.name, qty: effectiveQty }
    })`;

const replacement5 = `  const handleCreateRequest = async () => {
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

// 6. Update delete custom item check to require uid (so that only local ones can be deleted)
const target6 = `                                          {item.isCustom && !isPicked && !activeBatchData.isPackaged && (
                                            <button onClick={() => handleDeleteCustomItem(item.uid)} style={{ background: '#f43f5e15', border: '1px solid #f43f5e33', borderRadius: '8px', color: '#f43f5e', padding: '6px 12px', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', transition: '0.2s' }}>`;

const replacement6 = `                                          {item.isCustom && item.uid && !isPicked && !activeBatchData.isPackaged && (
                                            <button onClick={() => handleDeleteCustomItem(item.uid)} style={{ background: '#f43f5e15', border: '1px solid #f43f5e33', borderRadius: '8px', color: '#f43f5e', padding: '6px 12px', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', transition: '0.2s' }}>`;

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

if (content.includes(target5)) {
  content = content.replace(target5, replacement5);
  console.log('SUCCESS: Target 5 replaced');
} else {
  console.error('ERROR: Target 5 not found');
  success = false;
}

if (content.includes(target6)) {
  content = content.replace(target6, replacement6);
  console.log('SUCCESS: Target 6 replaced');
} else {
  console.error('ERROR: Target 6 not found');
  success = false;
}

if (success) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('SUCCESS: All sync patches applied successfully!');
}
