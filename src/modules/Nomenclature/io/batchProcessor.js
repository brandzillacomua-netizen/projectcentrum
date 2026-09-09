import { supabase } from '../../../supabase'

export const executeBatchImport = async ({
  validRows = [],
  strategy = 'skip', // 'skip' | 'overwrite' | 'new_code'
  existingItems = [],
  onProgress = () => {}
}) => {
  if (!validRows || validRows.length === 0) {
    return { successCount: 0, skippedCount: 0, errorCount: 0 }
  }

  // Calculate highest existing code integer to auto-generate V2-XXXXX
  let maxCodeNum = (existingItems || []).reduce((max, it) => {
    const num = parseInt(String(it.code || '').replace(/\D/g, ''))
    return !isNaN(num) && num > max ? num : max
  }, 90000)

  let successCount = 0
  let skippedCount = 0
  let errorCount = 0
  const total = validRows.length

  const BATCH_SIZE = 50
  const batches = []

  for (let i = 0; i < total; i += BATCH_SIZE) {
    batches.push(validRows.slice(i, i + BATCH_SIZE))
  }

  let processedSoFar = 0

  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    const batch = batches[bIndex]
    const upsertPayloads = []
    const updatePayloads = []

    for (const row of batch) {
      if (row.isDbDuplicate && strategy === 'skip') {
        skippedCount++
        processedSoFar++
        continue
      }

      let finalCode = row.code
      let targetId = null

      if (row.isDbDuplicate && strategy === 'overwrite' && row.existingMatch) {
        targetId = row.existingMatch.id
        finalCode = row.existingMatch.code || row.code
      } else if (!finalCode || (row.isDbDuplicate && strategy === 'new_code')) {
        maxCodeNum++
        finalCode = `V2-${maxCodeNum}`
      }

      const itemPayload = {
        code: finalCode,
        barcode: row.barcode || finalCode,
        qr_code: row.qr_code || finalCode,
        name: row.name,
        group_id: row.resolved_group_id,
        unit: row.unit || 'шт',
        rule_type: row.rule_type || 'generic',
        rule_params: row.rule_params || null,
        status: row.status || 'active'
      }

      if (targetId) {
        updatePayloads.push({ id: targetId, ...itemPayload })
      } else {
        upsertPayloads.push(itemPayload)
      }

      processedSoFar++
    }

    // Execute Inserts
    if (upsertPayloads.length > 0) {
      try {
        let { error: insertErr } = await supabase
          .from('nomenclatures_v2')
          .insert(upsertPayloads)

        if (insertErr && insertErr.code === '42703') {
          // Fallback without barcode/qr_code columns if not migrated yet
          const legacyBatch = upsertPayloads.map(({ barcode, qr_code, ...rest }) => rest)
          const retry = await supabase.from('nomenclatures_v2').insert(legacyBatch)
          insertErr = retry.error
        }

        if (insertErr) {
          console.warn('[BatchImport] Insert error, falling back to individual items:', insertErr)
          // Fallback row by row if batch insert hit unique constraint
          for (const item of upsertPayloads) {
            let { error: singleErr } = await supabase.from('nomenclatures_v2').insert([item])
            if (singleErr && singleErr.code === '42703') {
              const { barcode, qr_code, ...rest } = item
              const retrySingle = await supabase.from('nomenclatures_v2').insert([rest])
              singleErr = retrySingle.error
            }
            if (singleErr) errorCount++
            else successCount++
          }
        } else {
          successCount += upsertPayloads.length
        }
      } catch (err) {
        console.error('[BatchImport] Exception on batch insert:', err)
        errorCount += upsertPayloads.length
      }
    }

    // Execute Updates
    if (updatePayloads.length > 0) {
      for (const item of updatePayloads) {
        try {
          const { id, ...updateData } = item
          const { error: updateErr } = await supabase
            .from('nomenclatures_v2')
            .update(updateData)
            .eq('id', id)

          if (updateErr) errorCount++
          else successCount++
        } catch (err) {
          errorCount++
        }
      }
    }

    const currentPercent = Math.min(Math.round((processedSoFar / total) * 100), 100)
    onProgress({
      current: processedSoFar,
      total,
      percentage: currentPercent,
      successCount,
      skippedCount,
      errorCount
    })
  }

  return {
    successCount,
    skippedCount,
    errorCount,
    total
  }
}
