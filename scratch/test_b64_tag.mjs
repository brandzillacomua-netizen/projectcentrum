const sampleAddresses = [
  { id: 'addr_1', title: 'Основна адреса', city: 'Калуш', warehouse: 'Відділення №5' },
  { id: 'addr_2', title: 'Резерв', city: 'Калуш', warehouse: 'Відділення №2' }
]

const encodeAddresses = (addrs) => {
  const b64 = Buffer.from(JSON.stringify(addrs), 'utf-8').toString('base64')
  return `[DELIVERY_ADDRESSES_B64:${b64}]`
}

const decodeAddresses = (notes) => {
  if (!notes || !notes.includes('[DELIVERY_ADDRESSES_B64:')) return null
  const match = notes.match(/\[DELIVERY_ADDRESSES_B64:([A-Za-z0-9+/=]+)\]/)
  if (match && match[1]) {
    const jsonStr = Buffer.from(match[1], 'base64').toString('utf-8')
    return JSON.parse(jsonStr)
  }
  return null
}

const stripTag = (notes) => {
  if (!notes) return ''
  return notes.replace(/\[DELIVERY_ADDRESSES_B64:[A-Za-z0-9+/=]+\]/g, '').replace(/\[DELIVERY_ADDRESSES_JSON:.*?\]/g, '').trim()
}

const notesWithTag = `Надійний постійний партнер\n${encodeAddresses(sampleAddresses)}`

console.log('Notes with tag:', notesWithTag)
console.log('Decoded addresses:', decodeAddresses(notesWithTag))
console.log('Clean notes:', stripTag(notesWithTag))
