const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Patch inside batchList mapping
const target1 = `      // 1. Add standard BOM items from order_items
      const order = orders.find(o => o.id === batch.orderId)
      order?.order_items?.forEach(item => {
        const children = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
        if (children.length > 0) {
          children.forEach(b => {
            const nom = nomenclatures.find(n => String(n.id) === String(b.child_id))
            const nameLower = nom?.name?.toLowerCase() || ''
            if (nom && !(nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка')))) {
              if (!batchBOM.includes(nom.id)) {
                batchBOM.push(nom.id)
              }
            }
          })`;

const replacement1 = `      // 1. Add standard BOM items from order_items
      const order = orders.find(o => o.id === batch.orderId)
      const hasSnapshot = batch.tasks.some(t => t.plan_snapshot)
      order?.order_items?.forEach(item => {
        const children = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
        if (children.length > 0) {
          children.forEach(b => {
            const nom = nomenclatures.find(n => String(n.id) === String(b.child_id))
            const nameLower = nom?.name?.toLowerCase() || ''
            if (nom && !(nameLower.includes('прес') && (nameLower.includes('гайка') || nameLower.includes('втулка')))) {
              let snapFound = false
              batch.tasks.forEach(t => {
                if (t.plan_snapshot && t.plan_snapshot[nom.id]) snapFound = true
              })
              const isSgp = (nom.name?.toLowerCase().includes('-іп') || nom.name?.toLowerCase().includes(' іп') || nom.nomenclature_code?.toLowerCase().includes('іп') || nom.type?.toLowerCase().includes('part') || nom.type?.toLowerCase().includes('деталь') || nom.type?.toLowerCase().includes('виріб') || nom.type?.toLowerCase().includes('сгп'))
              if (isSgp && hasSnapshot && !snapFound) return

              if (!batchBOM.includes(nom.id)) {
                batchBOM.push(nom.id)
              }
            }
          })`;

// 2. Patch inside categorizedBOM mapping
const target2 = `  // ─── BOM ──────────────────────────────────────────────────────────────────
  const { categorizedBOM } = useMemo(() => {
    if (!activeBatchData) return { categorizedBOM: {}, hasBOM: false }
    const map = {}
    let foundAnyBom = false

    const order = orders.find(o => o.id === activeBatchData.orderId)`;

const replacement2 = `  // ─── BOM ──────────────────────────────────────────────────────────────────
  const { categorizedBOM } = useMemo(() => {
    if (!activeBatchData) return { categorizedBOM: {}, hasBOM: false }
    const map = {}
    let foundAnyBom = false
    const hasSnapshot = activeBatchData.tasks.some(t => t.plan_snapshot)

    const order = orders.find(o => o.id === activeBatchData.orderId)`;

// 3. Patch inside parentBOM.forEach in categorizedBOM
const target3 = `              // Find quantity
              let qty = 0
              let snapFound = false
              activeBatchData.tasks.forEach(t => {
                if (t.plan_snapshot && t.plan_snapshot[nom.id]) {
                  const snapItem = t.plan_snapshot[nom.id]
                  if (snapItem && typeof snapItem === 'object') {
                    qty = Math.max(qty, Number(snapItem.need) || 0)
                    snapFound = true
                  }
                }
              })
              if (!snapFound) {
                qty = Number(b.quantity_per_parent) * Number(activeBatchData.plannedSets)
              }
              
              if (!map[nom.id]) map[nom.id] = { nom, qty: 0 }`;

const replacement3 = `              // Find quantity
              let qty = 0
              let snapFound = false
              activeBatchData.tasks.forEach(t => {
                if (t.plan_snapshot && t.plan_snapshot[nom.id]) {
                  const snapItem = t.plan_snapshot[nom.id]
                  if (snapItem && typeof snapItem === 'object') {
                    qty = Math.max(qty, Number(snapItem.need) || 0)
                    snapFound = true
                  }
                }
              })
              
              // Skip SGP items from static BOM if we have task snapshots but this item is not in them (e.g. was replaced)
              const isSgp = (nom.name?.toLowerCase().includes('-іп') || nom.name?.toLowerCase().includes(' іп') || nom.nomenclature_code?.toLowerCase().includes('іп') || nom.type?.toLowerCase().includes('part') || nom.type?.toLowerCase().includes('деталь') || nom.type?.toLowerCase().includes('виріб') || nom.type?.toLowerCase().includes('сгп'))
              if (isSgp && hasSnapshot && !snapFound) return

              if (!snapFound) {
                qty = Number(b.quantity_per_parent) * Number(activeBatchData.plannedSets)
              }
              
              if (!map[nom.id]) map[nom.id] = { nom, qty: 0 }`;

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

if (success) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('SUCCESS: All patches written to file!');
}
