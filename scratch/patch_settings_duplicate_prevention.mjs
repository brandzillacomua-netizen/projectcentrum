import { readFileSync, writeFileSync } from 'fs'

const filePath = 'a:/centrum/src/modules/SettingsModule.jsx'
let src = readFileSync(filePath, 'utf8')
const hasCRLF = src.includes('\r\n')
if (hasCRLF) src = src.replace(/\r\n/g, '\n')

// ── PATCH: Replace executeCuttersUpload with aggregated item processing ─────
const executeCuttersUploadOld = `  const executeCuttersUpload = async () => {
    setCuttersUploadStatus('uploading')
    setCuttersUploadLog('Початок завантаження залишків фрез...\\n')
    const existingInventory = inventory || []
    const updates = []
    const inserts = []
    try {
      const dbNomMap = {}
      nomenclatures.forEach(n => { dbNomMap[normalizeHomoglyphs(n.name)] = n })
      setCuttersUploadLog(prev => prev + \`Обробка \${cuttersPreviewList.length} позицій фрез...\\n\`)
      for (const item of cuttersPreviewList) {
        const normName = normalizeHomoglyphs(item.name)
        let nomRecord = dbNomMap[normName]
        if (!nomRecord) {
          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'consumable' }])
            .select().single()
          if (nomErr) {
            setCuttersUploadLog(prev => prev + \`  ⚠️ [НОМ ПОМИЛКА] \${item.name}: \${nomErr.message}\\n\`)
            continue
          }
          setCuttersUploadLog(prev => prev + \`  ✅ [НОМ СТВОРЕНО] \${newNom.name} (ID: \${newNom.id})\\n\`)
          nomRecord = newNom
          dbNomMap[normName] = newNom
        }
        const existingInv = existingInventory.find(i =>
          i.warehouse === 'operational' &&
          String(i.nomenclature_id) === String(nomRecord.id) &&
          i.type === 'consumable'
        )
        if (existingInv) {
          const newTotal = cuttersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id, nomenclature_id: nomRecord.id, name: item.name,
            type: 'consumable', warehouse: 'operational', unit: 'шт',
            total_qty: newTotal, reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + \`[ОНОВИТИ] \${item.name}: \${newTotal} шт (Ø\${item.diameter})\\n\`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord.id, name: item.name,
            type: 'consumable', warehouse: 'operational', unit: 'шт',
            total_qty: item.qty, reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + \`[НОВИЙ] \${item.name}: \${item.qty} шт (Ø\${item.diameter})\\n\`)
        }
      }
      setCuttersUploadLog(prev => prev + \`\\nНадсилання змін до Supabase...\\n\`)
      const batchOps = []
      if (updates.length > 0) batchOps.push(supabase.from('inventory').upsert(updates))
      if (inserts.length > 0) batchOps.push(supabase.from('inventory').insert(inserts))
      const results = await Promise.all(batchOps)
      for (const res of results) { if (res.error) throw res.error }
      setCuttersUploadLog(prev => prev + \`✅ Успішно оновлено базу даних!\\n\`)
      setCuttersUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setCuttersUploadLog(prev => prev + \`❌ Помилка запису в БД: \${err.message || err}\\n\`)
      setCuttersUploadStatus('error')
    }
  }`

const executeCuttersUploadNew = `  const executeCuttersUpload = async () => {
    setCuttersUploadStatus('uploading')
    setCuttersUploadLog('Початок завантаження залишків фрез...\\n')
    const existingInventory = inventory || []
    const updates = []
    const inserts = []
    
    // Group preview list by name to avoid duplicate queries or inserts in the same run
    const aggregatedCutters = {}
    cuttersPreviewList.forEach(item => {
      const key = item.name
      if (!aggregatedCutters[key]) {
        aggregatedCutters[key] = { ...item }
      } else {
        aggregatedCutters[key].qty += item.qty
      }
    })
    const groupedList = Object.values(aggregatedCutters)

    try {
      const dbNomMap = {}
      nomenclatures.forEach(n => { dbNomMap[normalizeHomoglyphs(n.name)] = n })
      setCuttersUploadLog(prev => prev + \`Обробка \${groupedList.length} унікальних позицій фрез...\\n\`)
      
      for (const item of groupedList) {
        const normName = normalizeHomoglyphs(item.name)
        let nomRecord = dbNomMap[normName]
        if (!nomRecord) {
          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'consumable' }])
            .select().single()
          if (nomErr) {
            setCuttersUploadLog(prev => prev + \`  ⚠️ [НОМ ПОМИЛКА] \${item.name}: \${nomErr.message}\\n\`)
            continue
          }
          setCuttersUploadLog(prev => prev + \`  ✅ [НОМ СТВОРЕНО] \${newNom.name} (ID: \${newNom.id})\\n\`)
          nomRecord = newNom
          dbNomMap[normName] = newNom
        }
        
        // Find existing inventory item for this nomenclature on the 'operational' (СО) warehouse
        const existingInv = existingInventory.find(i =>
          i.warehouse === 'operational' &&
          String(i.nomenclature_id) === String(nomRecord.id) &&
          i.type === 'consumable'
        )
        
        if (existingInv) {
          const newTotal = cuttersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id,
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: 'consumable',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: newTotal,
            reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + \`[ОНОВИТИ СО] \${item.name}: \${newTotal} шт (Ø\${item.diameter})\\n\`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: 'consumable',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + \`[НОВИЙ СО] \${item.name}: \${item.qty} шт (Ø\${item.diameter})\\n\`)
        }
      }
      
      setCuttersUploadLog(prev => prev + \`\\nНадсилання змін до Supabase...\\n\`)
      const batchOps = []
      if (updates.length > 0) batchOps.push(supabase.from('inventory').upsert(updates))
      if (inserts.length > 0) batchOps.push(supabase.from('inventory').insert(inserts))
      const results = await Promise.all(batchOps)
      for (const res of results) { if (res.error) throw res.error }
      setCuttersUploadLog(prev => prev + \`✅ Успішно оновлено базу даних!\\n\`)
      setCuttersUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setCuttersUploadLog(prev => prev + \`❌ Помилка запису в БД: \${err.message || err}\\n\`)
      setCuttersUploadStatus('error')
    }
  }`

const cleanOld = executeCuttersUploadOld.replace(/\r\n/g, '\n')
const cleanNew = executeCuttersUploadNew.replace(/\r\n/g, '\n')

if (!src.includes(cleanOld)) {
  console.error('executeCuttersUpload old block not found')
  process.exit(1)
}

src = src.replace(cleanOld, cleanNew)
console.log('✓ executeCuttersUpload updated successfully')

if (hasCRLF) src = src.replace(/\n/g, '\r\n')
writeFileSync(filePath, src, 'utf8')
console.log('✓ SettingsModule.jsx written')
