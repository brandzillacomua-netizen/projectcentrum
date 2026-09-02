/**
 * Formats a customer name or object into an anonymized Database Customer ID / Code
 * for printable forms to prevent information leaks.
 */
export const getCustomerCode = (customerName, customersList = [], order = null) => {
  if (order?.customer_id) {
    const cid = String(order.customer_id)
    return cid.includes('-') ? `#${cid.split('-')[0].toUpperCase()}` : `#${cid.slice(0, 8).toUpperCase()}`
  }

  if (!customerName || customerName === '—') return '—'

  const normName = String(customerName).trim().toLowerCase()
  const list = Array.isArray(customersList) ? customersList : []
  const found = list.find(c =>
    (c?.name && String(c.name).trim().toLowerCase() === normName) ||
    (c?.official_name && String(c.official_name).trim().toLowerCase() === normName)
  )

  if (found && found.id) {
    const rawId = String(found.id)
    return rawId.includes('-') ? `#${rawId.split('-')[0].toUpperCase()}` : `#${rawId.slice(0, 8).toUpperCase()}`
  }

  let hash = 0x811c9dc5
  for (let i = 0; i < customerName.length; i++) {
    hash ^= customerName.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0').toUpperCase()
  return `#CUST-${hex.slice(0, 6)}`
}
