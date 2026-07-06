const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Target 2
const target2 = `      }
    })

    const categories = {
      sgp: { title: '1. ДЕТАЛІ / ГОТОВІ ВИРОБИ (СГП)', items: [], color: '#f43f5e', icon: <Package size={18} /> },`;

const replacement2 = `      }
    })

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

// 2. Target 6
const target6 = `                                              {/* Кнопка видалення для кастомних позицій */}
                                              {item.isCustom && (
                                                <button`;

const replacement6 = `                                              {/* Кнопка видалення для кастомних позицій */}
                                              {item.isCustom && item.uid && (
                                                <button`;

let success = true;

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('SUCCESS: Target 2 replaced');
} else {
  console.error('ERROR: Target 2 not found');
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
  console.log('SUCCESS: Remaining patches written!');
}
