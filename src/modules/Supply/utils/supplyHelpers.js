export const getQR = (nom) => {
  if (!nom || !nom.additional_info) return ''
  const match = nom.additional_info.match(/\[QR:\s*([^\]]+)\]/)
  return match ? match[1].trim() : ''
}

export const setQR = (nom, code) => {
  if (!nom) return ''
  let info = nom.additional_info || ''
  const qrPattern = /\[QR:\s*([^\]]*)\]/
  if (qrPattern.test(info)) {
    info = info.replace(qrPattern, code ? `[QR: ${code}]` : '')
  } else if (code) {
    info = (info + ` [QR: ${code}]`).trim()
  }
  return info
}

export const parseMaterialName = (details) => {
  if (!details) return ''
  if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
    const match = details.match(/:\s*(.+)\s*—/)
    return match ? match[1].trim() : details
  }
  return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
}

export const getStatusLabel = (status) => {
  switch (status) {
    case 'pending': return 'Очікує'
    case 'accepted': return 'Прийнято'
    case 'ordered': return 'Замовлено'
    case 'shipped': return 'В дорозі'
    case 'completed': return 'Прийнято на склад'
    default: return status
  }
}

export const getDocDisplayId = (doc) => {
  if (!doc) return ''
  if (doc.doc_number) return `№ ${doc.doc_number}`
  if (doc.order_num) return `№ ${doc.order_num}`
  if (doc.order_id) return `№ ${doc.order_id}`
  return `№ ${String(doc.id).substring(0, 8)}`
}

export const getNomLabel = (nom) => {
  if (!nom) return ''
  let label = nom.name
  if (nom.material_type) label += ` (${nom.material_type})`
  if (nom.thickness) label += ` ${nom.thickness}мм`
  if (nom.color) label += ` ${nom.color}`
  return label
}

export const resolveItemName = (it, idx) => {
  return it.name || it.reqDetails || it.details || (it.nomenclature ? getNomLabel(it.nomenclature) : `Позиція #${idx + 1}`)
}

export const resolveItemQty = (it) => {
  return Number(it.qty ?? it.needed ?? it.missingAmount ?? it.quantity ?? 0)
}

export const getItemReservedQty = (item, tasks = []) => {
  if (!item) return 0
  const dbReserved = Number(item.reserved_qty) || 0
  let prepReserved = 0
  const itemNameClean = (item.name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim()
  
  ;(tasks || []).filter(t => t.step === 'Підготовка' && t.status === 'pending' && t.warehouse_conf === 'true').forEach(t => {
    if (t.plan_snapshot) {
      let snapshot = t.plan_snapshot
      if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot) } catch (e) { snapshot = {} }
      }
      if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
        Object.values(snapshot).forEach(part => {
          if (!part || typeof part !== 'object') return
          const nomId = String(part.id || part.nomenclature_id || '')
          const pName = (part.name || '').replace(/\[(Непідготовлений|Підготовлений)\]/gi, '').trim()
          if ((nomId && String(nomId) === String(item.nomenclature_id)) || pName === itemNameClean) {
            prepReserved += Number(part.sheets || part.plan || part.need || 0)
          }
        })
      }
    }
  })
  return Math.max(dbReserved, prepReserved)
}
