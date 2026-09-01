const parseAddressesFromClient = (c) => {
  let addresses = []
  if (Array.isArray(c.deliveryAddresses)) {
    addresses = c.deliveryAddresses
  } else if (c.notes && c.notes.includes('[DELIVERY_ADDRESSES_JSON:')) {
    try {
      const match = c.notes.match(/\[DELIVERY_ADDRESSES_JSON:(.*?)\]/)
      if (match && match[1]) {
        addresses = JSON.parse(match[1])
      }
    } catch (e) {}
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    addresses = [
      {
        id: 'addr_default',
        title: 'Основна адреса',
        deliveryMethod: c.delivery_method || c.deliveryMethod || 'np_warehouse',
        city: c.delivery_city || c.deliveryCity || c.city || 'Київ',
        warehouse: c.delivery_warehouse || c.deliveryWarehouse || '',
        address: c.delivery_address || c.deliveryAddress || c.address || '',
        recipientName: c.delivery_recipient_name || c.deliveryRecipientName || c.contact_person || '',
        recipientPhone: c.delivery_recipient_phone || c.deliveryRecipientPhone || c.phone || '',
        isLegalEntity: c.is_legal_entity !== undefined ? Boolean(c.is_legal_entity) : Boolean(c.isLegalEntity || false),
        edrpou: c.edrpou || c.tin || '',
        legalEntityName: c.legal_entity_name || c.legalEntityName || c.company || '',
        isDefault: true
      }
    ]
  }

  return addresses
}

const sampleClient = {
  city: 'Київ',
  delivery_city: 'Калуш',
  delivery_warehouse: 'Відділення №1',
  delivery_recipient_name: 'FT'
}

console.log('Parsed addresses:', parseAddressesFromClient(sampleClient))
