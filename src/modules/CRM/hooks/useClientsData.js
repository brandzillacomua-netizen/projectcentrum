import { useState, useMemo, useEffect } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'

const normalizeCustomerName = (name) => {
  if (!name) return ''
  return name.trim().replace(/\s+/g, ' ')
}

const getClientKey = (name) => {
  if (!name) return ''
  let str = name.trim().toLowerCase().replace(/[^a-z0-9а-щьюяєіїґ]/g, '')
  if (str === 'фт' || str === 'ft') return 'ft'
  const cyrMap = {
    'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'є':'e', 'ж':'zh',
    'з':'z', 'и':'y', 'і':'i', 'ї':'i', 'й':'y', 'к':'k', 'л':'l', 'м':'m',
    'н':'n', 'о':'o', 'п':'p', 'р':'r', 'с':'s', 'т':'t', 'у':'u', 'ф':'f',
    'х':'x', 'ц':'c', 'ч':'ch', 'ш':'sh', 'щ':'sch', 'ь':'', 'ю':'yu', 'я':'ya'
  }
  return str.split('').map(ch => cyrMap[ch] || ch).join('')
}

const isInternalCustomer = (custName) => {
  if (!custName) return true
  const norm = normalizeCustomerName(custName)
  const lower = norm.toLowerCase()

  // 1. Text keywords for internal/test/stock entries
  const isKeyword = (
    lower.includes('внутрішн') ||
    lower.includes('доопрацюван') ||
    lower.includes('склад') ||
    lower.includes('тест') ||
    lower.includes('брак') ||
    lower.includes('невідомий') ||
    lower.includes('виробництво') ||
    lower.includes('власний випуск')
  )
  if (isKeyword) return true

  // 2. Order numbers or pure digits/codes (e.g. "260716-1", "123", "2132", "234234", "SIM-12")
  const isOrderOrNumeric = /^\d+[\d-]*$/.test(norm) || /^SIM-[\w-]+/i.test(norm)
  if (isOrderOrNumeric) return true

  return false
}

const encodeAddressesB64 = (addrs) => {
  try {
    const json = JSON.stringify(addrs)
    if (typeof window !== 'undefined' && window.btoa) {
      return btoa(unescape(encodeURIComponent(json)))
    }
    return Buffer.from(json, 'utf-8').toString('base64')
  } catch (e) {
    return ''
  }
}

const decodeAddressesB64 = (b64) => {
  try {
    if (typeof window !== 'undefined' && window.atob) {
      return JSON.parse(decodeURIComponent(escape(atob(b64))))
    }
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
  } catch (e) {
    return null
  }
}

const parseDeliveryAddresses = (c) => {
  let addresses = []
  if (Array.isArray(c.deliveryAddresses)) {
    addresses = c.deliveryAddresses
  } else if (Array.isArray(c.delivery_addresses)) {
    addresses = c.delivery_addresses
  } else if (c.notes) {
    if (c.notes.includes('[DELIVERY_ADDRESSES_B64:')) {
      const match = c.notes.match(/\[DELIVERY_ADDRESSES_B64:([A-Za-z0-9+/=]+)\]/)
      if (match && match[1]) {
        const decoded = decodeAddressesB64(match[1])
        if (Array.isArray(decoded)) addresses = decoded
      }
    } else if (c.notes.includes('[DELIVERY_ADDRESSES_JSON:')) {
      try {
        const match = c.notes.match(/\[DELIVERY_ADDRESSES_JSON:([\s\S]*?)\]\s*$/)
        if (match && match[1]) {
          addresses = JSON.parse(match[1])
        }
      } catch (e) {}
    }
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

const mapDbCustomerToClient = (c) => {
  const deliveryAddresses = parseDeliveryAddresses(c)
  const defaultAddr = deliveryAddresses.find(a => a.isDefault) || deliveryAddresses[0] || {}

  // Strip B64 and JSON tags from notes for display
  let cleanNotes = c.notes || ''
  cleanNotes = cleanNotes
    .replace(/\[DELIVERY_ADDRESSES_B64:[A-Za-z0-9+/=]+\]/g, '')
    .replace(/\[DELIVERY_ADDRESSES_JSON:[\s\S]*?\]/g, '')
    .replace(/\]+/g, '')
    .trim()

  return {
    id: String(c.id),
    name: c.name || '',
    company: c.company || c.legal_entity_name || c.name || '',
    contactPerson: c.contact_person || c.contactPerson || c.name || '',
    phone: c.phone || '—',
    email: c.email || '—',
    tin: c.tin || c.edrpou || '—',
    edrpou: c.edrpou || c.tin || '',
    city: c.city || 'Київ',
    address: c.address || '—',
    manager: c.manager || 'Олександр Менеджер',
    segment: c.segment || 'Regular',
    status: c.status || 'active',
    notes: cleanNotes,
    deliveryAddresses,
    deliveryMethod: defaultAddr.deliveryMethod || c.delivery_method || c.deliveryMethod || 'np_warehouse',
    deliveryCity: defaultAddr.city || c.delivery_city || c.deliveryCity || c.city || 'Київ',
    deliveryWarehouse: defaultAddr.warehouse || c.delivery_warehouse || c.deliveryWarehouse || '',
    deliveryAddress: defaultAddr.address || c.delivery_address || c.deliveryAddress || c.address || '',
    deliveryRecipientName: defaultAddr.recipientName || c.delivery_recipient_name || c.deliveryRecipientName || c.contact_person || '',
    deliveryRecipientPhone: defaultAddr.recipientPhone || c.delivery_recipient_phone || c.deliveryRecipientPhone || c.phone || '',
    isLegalEntity: defaultAddr.isLegalEntity !== undefined ? Boolean(defaultAddr.isLegalEntity) : (c.is_legal_entity !== undefined ? Boolean(c.is_legal_entity) : Boolean(c.isLegalEntity || false)),
    legalEntityName: defaultAddr.legalEntityName || c.legal_entity_name || c.legalEntityName || c.company || '',
    createdAt: c.created_at || new Date().toISOString()
  }
}

const mapClientToDbPayload = (clientData) => {
  const payload = {}
  if (clientData.name !== undefined) payload.name = clientData.name
  if (clientData.company !== undefined || clientData.name !== undefined) payload.company = clientData.company || clientData.name
  if (clientData.contactPerson !== undefined || clientData.contact_person !== undefined) payload.contact_person = clientData.contactPerson || clientData.contact_person
  if (clientData.phone !== undefined) payload.phone = clientData.phone
  if (clientData.email !== undefined) payload.email = clientData.email
  if (clientData.tin !== undefined || clientData.edrpou !== undefined) payload.tin = clientData.tin || clientData.edrpou
  if (clientData.edrpou !== undefined || clientData.tin !== undefined) payload.edrpou = clientData.edrpou || clientData.tin
  if (clientData.city !== undefined) payload.city = clientData.city
  if (clientData.address !== undefined) payload.address = clientData.address
  if (clientData.manager !== undefined) payload.manager = clientData.manager
  if (clientData.segment !== undefined) payload.segment = clientData.segment
  if (clientData.status !== undefined) payload.status = clientData.status

  // Handle notes + embedding deliveryAddresses array via Base64
  let notesStr = clientData.notes || ''
  notesStr = notesStr
    .replace(/\[DELIVERY_ADDRESSES_B64:[A-Za-z0-9+/=]+\]/g, '')
    .replace(/\[DELIVERY_ADDRESSES_JSON:[\s\S]*?\]/g, '')
    .replace(/\]+/g, '')
    .trim()

  if (Array.isArray(clientData.deliveryAddresses) && clientData.deliveryAddresses.length > 0) {
    const b64 = encodeAddressesB64(clientData.deliveryAddresses)
    if (b64) {
      notesStr = `${notesStr}\n[DELIVERY_ADDRESSES_B64:${b64}]`.trim()
    }
    
    // Also extract default address for DB columns
    const defaultAddr = clientData.deliveryAddresses.find(a => a.isDefault) || clientData.deliveryAddresses[0]
    if (defaultAddr) {
      payload.delivery_method = defaultAddr.deliveryMethod || 'np_warehouse'
      payload.delivery_city = defaultAddr.city || ''
      payload.delivery_warehouse = defaultAddr.warehouse || ''
      payload.delivery_address = defaultAddr.address || ''
      payload.delivery_recipient_name = defaultAddr.recipientName || ''
      payload.delivery_recipient_phone = defaultAddr.recipientPhone || ''
      payload.is_legal_entity = Boolean(defaultAddr.isLegalEntity)
      payload.legal_entity_name = defaultAddr.legalEntityName || ''
    }
  } else {
    if (clientData.deliveryMethod !== undefined) payload.delivery_method = clientData.deliveryMethod
    if (clientData.deliveryCity !== undefined) payload.delivery_city = clientData.deliveryCity
    if (clientData.deliveryWarehouse !== undefined) payload.delivery_warehouse = clientData.deliveryWarehouse
    if (clientData.deliveryAddress !== undefined) payload.delivery_address = clientData.deliveryAddress
    if (clientData.deliveryRecipientName !== undefined) payload.delivery_recipient_name = clientData.deliveryRecipientName
    if (clientData.deliveryRecipientPhone !== undefined) payload.delivery_recipient_phone = clientData.deliveryRecipientPhone
    if (clientData.isLegalEntity !== undefined) payload.is_legal_entity = Boolean(clientData.isLegalEntity)
    if (clientData.legalEntityName !== undefined) payload.legal_entity_name = clientData.legalEntityName
  }

  payload.notes = notesStr
  return payload
}

export const useClientsData = () => {
  const { orders = [], customers = [], fetchData } = useMES()

  // Fetch customers from DB when mounted
  useEffect(() => {
    if (typeof fetchData === 'function') {
      fetchData(['customers']).catch(() => {})
    }
  }, [])

  // Custom clients state (persisted in localStorage as fallback)
  const [customClients, setCustomClients] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_crm_clients')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.filter(c => !['cli-1', 'cli-2', 'cli-3'].includes(c.id) && !isInternalCustomer(c.name))
      }
      return []
    } catch (e) {
      return []
    }
  })

  // Communications timeline state (persisted in localStorage)
  const [communications, setCommunications] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_crm_communications')
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed.filter(c => !['comm-1', 'comm-2', 'comm-3'].includes(c.id))
      }
      return []
    } catch (e) {
      return []
    }
  })

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('centrum_crm_clients', JSON.stringify(customClients))
    } catch (e) {}
  }, [customClients])

  useEffect(() => {
    try {
      localStorage.setItem('centrum_crm_communications', JSON.stringify(communications))
    } catch (e) {}
  }, [communications])

  // Aggregate orders by customer name
  const aggregatedOrdersByClient = useMemo(() => {
    const map = new Map()

    orders.forEach(ord => {
      const rawName = (ord.customer || ord.client_name || '').trim()
      const custName = normalizeCustomerName(rawName)
      if (!custName || isInternalCustomer(custName)) return

      const key = getClientKey(custName)

      if (!map.has(key)) {
        map.set(key, {
          customerName: custName,
          orders: [],
          totalRevenue: 0,
          lastOrderDate: null,
          firstOrderDate: null
        })
      }

      const entry = map.get(key)
      entry.orders.push(ord)

      const itemsSum = (ord.items || []).reduce((sum, item) => sum + (Number(item.price || item.amount || 0) * (Number(item.quantity) || 1)), 0)
      const orderVal = Number(ord.total_amount || ord.amount || itemsSum || 0)
      entry.totalRevenue += orderVal

      const ordDate = ord.created_at || ord.order_date || new Date().toISOString()
      if (!entry.lastOrderDate || new Date(ordDate) > new Date(entry.lastOrderDate)) {
        entry.lastOrderDate = ordDate
      }
      if (!entry.firstOrderDate || new Date(ordDate) < new Date(entry.firstOrderDate)) {
        entry.firstOrderDate = ordDate
      }
    })

    return map
  }, [orders])

  // Combine DB customers + customClients + orders statistics
  const clients = useMemo(() => {
    const clientList = []
    const seenKeys = new Set()

    // 1. Add DB customers first
    ;(customers || []).forEach(dbCust => {
      if (!dbCust || !dbCust.name) return
      const mapped = mapDbCustomerToClient(dbCust)
      const normName = normalizeCustomerName(mapped.name)
      const key = getClientKey(normName)
      if (!key || isInternalCustomer(normName) || seenKeys.has(key)) return
      seenKeys.add(key)
      clientList.push(mapped)
    })

    // 2. Add customClients
    customClients.forEach(cli => {
      const normName = normalizeCustomerName(cli.name)
      const key = getClientKey(normName)
      if (!key || isInternalCustomer(normName) || seenKeys.has(key)) return
      seenKeys.add(key)
      clientList.push({ ...cli, name: normName, company: normalizeCustomerName(cli.company || normName) })
    })

    // 3. Also extract clients from orders that are not in DB or customClients yet
    aggregatedOrdersByClient.forEach((agg, key) => {
      const custName = agg.customerName
      if (isInternalCustomer(custName) || seenKeys.has(key)) return
      seenKeys.add(key)
      clientList.push({
        id: `ord-cli-${custName.replace(/[^a-zA-Z0-9]/g, '-')}`,
        name: custName,
        company: custName,
        phone: '—',
        email: '—',
        contactPerson: custName,
        tin: '—',
        segment: agg.totalRevenue > 50000 ? 'VIP' : 'Regular',
        status: 'active',
        manager: 'Системний Менеджер',
        city: 'Україна',
        address: '—',
        createdAt: agg.firstOrderDate || new Date().toISOString()
      })
    })

    // Decorate each client with calculated CRM metrics
    return clientList.map(cli => {
      const key = getClientKey(cli.name)
      const match = aggregatedOrdersByClient.get(key)
      const clientOrders = match ? match.orders : []
      const totalRevenue = match ? match.totalRevenue : 0
      const totalOrdersCount = clientOrders.length
      const avgCheck = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0
      const ltv = totalRevenue

      let segment = cli.segment || 'Regular'
      if (totalRevenue >= 100000 || totalOrdersCount >= 10) {
        segment = 'VIP'
      } else if (totalOrdersCount === 0 && !cli.segment) {
        segment = 'Новий'
      }

      return {
        ...cli,
        ordersCount: totalOrdersCount,
        totalRevenue,
        avgCheck,
        ltv,
        segment,
        lastOrderDate: match?.lastOrderDate || cli.createdAt,
        orders: clientOrders
      }
    })
  }, [customers, customClients, aggregatedOrdersByClient])

  // System-wide metrics
  const summaryMetrics = useMemo(() => {
    const totalClientsCount = clients.length
    const totalRevenueSum = clients.reduce((acc, c) => acc + c.totalRevenue, 0)
    const totalOrdersCount = clients.reduce((acc, c) => acc + c.ordersCount, 0)
    const overallAvgCheck = totalOrdersCount > 0 ? Math.round(totalRevenueSum / totalOrdersCount) : 0
    const vipCount = clients.filter(c => c.segment === 'VIP').length
    const activeCount = clients.filter(c => c.status === 'active').length

    return {
      totalClientsCount,
      totalRevenueSum,
      totalOrdersCount,
      overallAvgCheck,
      vipCount,
      activeCount
    }
  }, [clients])

  // Actions
  const addClient = async (newClient) => {
    const created = {
      id: `cli-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      segment: newClient.segment || 'Regular',
      ...newClient
    }
    setCustomClients(prev => [created, ...prev])

    // Async save to Supabase DB
    try {
      const payload = mapClientToDbPayload(created)
      const { data, error } = await supabase.from('customers').insert([payload]).select().single()
      if (!error && data) {
        if (typeof fetchData === 'function') fetchData(['customers']).catch(() => {})
        return mapDbCustomerToClient(data)
      }
    } catch (e) {
      console.warn('Failed to insert customer to DB:', e)
    }

    return created
  }

  const addCommunication = (newComm) => {
    const created = {
      id: `comm-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...newComm
    }
    setCommunications(prev => [created, ...prev])
    return created
  }

  const getClientCommunications = (clientId) => {
    return communications.filter(c => c.clientId === clientId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  const updateClient = async (clientId, updatedFields) => {
    setCustomClients(prev => {
      const exists = prev.some(c => c.id === clientId)
      if (exists) {
        return prev.map(c => c.id === clientId ? { ...c, ...updatedFields } : c)
      } else {
        return [{ id: clientId, createdAt: new Date().toISOString(), ...updatedFields }, ...prev]
      }
    })

    // Async update to Supabase DB
    try {
      const payload = mapClientToDbPayload(updatedFields)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)

      if (isUuid) {
        await supabase.from('customers').update(payload).eq('id', clientId)
      } else {
        const { data: existing } = await supabase.from('customers').select('id').ilike('name', updatedFields.name || '').maybeSingle()
        if (existing) {
          await supabase.from('customers').update(payload).eq('id', existing.id)
        } else if (updatedFields.name) {
          await supabase.from('customers').insert([payload])
        }
      }
      if (typeof fetchData === 'function') fetchData(['customers']).catch(() => {})
    } catch (e) {
      console.warn('Failed to update customer in DB:', e)
    }
  }

  const deleteClient = async (clientId, clientName) => {
    setCustomClients(prev => prev.filter(c => c.id !== clientId && c.name?.toLowerCase() !== clientName?.toLowerCase()))

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
      if (isUuid) {
        await supabase.from('customers').delete().eq('id', clientId)
      } else if (clientName) {
        await supabase.from('customers').delete().ilike('name', clientName)
      }
      if (typeof fetchData === 'function') fetchData(['customers']).catch(() => {})
    } catch (e) {
      console.warn('Failed to delete customer from DB:', e)
    }
  }

  return {
    clients,
    summaryMetrics,
    addClient,
    updateClient,
    deleteClient,
    addCommunication,
    getClientCommunications
  }
}
