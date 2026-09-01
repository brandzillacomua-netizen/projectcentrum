/**
 * Nova Poshta API v2.0 Integration Service
 * Supports VITE_NOVA_POSHTA_API_KEY, localStorage, counterparties lookup, warehouse search & InternetDocument.save (TTN creation)
 */

export const getNpApiKey = () => {
  const localKey = (localStorage.getItem('np_api_key') || localStorage.getItem('nova_poshta_api_key') || '').trim()
  if (localKey) return localKey
  const envKey = import.meta.env.VITE_NOVA_POSHTA_API_KEY || import.meta.env.NOVA_POSHTA_API_KEY || import.meta.env.VITE_NP_API_KEY || import.meta.env.NP_API_KEY
  if (envKey && envKey.trim()) return envKey.trim()
  return ''
}

export const saveNpApiKey = (key) => {
  if (key && key.trim()) {
    localStorage.setItem('np_api_key', key.trim())
    localStorage.setItem('nova_poshta_api_key', key.trim())
  } else {
    localStorage.removeItem('np_api_key')
    localStorage.removeItem('nova_poshta_api_key')
  }
}

/**
 * Universal caller for Nova Poshta API v2.0 JSON endpoint
 */
export const callNpApi = async (modelName, calledMethod, methodProperties = {}, customKey = null) => {
  const apiKey = customKey || getNpApiKey()

  // 1. Try Vercel Serverless proxy endpoint (/api/nova-poshta) first to keep API key hidden on server as Secret
  try {
    const serverResponse = await fetch('/api/nova-poshta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        modelName,
        calledMethod,
        methodProperties
      })
    })

    const contentType = serverResponse.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await serverResponse.json()
      if (data.success) {
        return data.data
      }
      if (data.errors && data.errors.length > 0) {
        const errorMsg = Array.isArray(data.errors) ? data.errors.join('; ') : String(data.errors)
        throw new Error(errorMsg)
      }
    }
  } catch (serverErr) {
    if (serverErr.message && !serverErr.message.includes('Unexpected token') && !serverErr.message.includes('Failed to fetch')) {
      throw serverErr
    }
  }

  // 2. Direct client fetch fallback (for local development or if serverless function is unrouted)
  if (!apiKey) {
    throw new Error('API ключ Нової Пошти не знайдено. Вкажіть NOVA_POSHTA_API_KEY у Vercel та виконайте Redeploy.')
  }

  const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      modelName,
      calledMethod,
      methodProperties
    })
  })

  if (!response.ok) {
    throw new Error(`Помилка мережі API Нової Пошти: HTTP ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    const errorMsg = Array.isArray(data.errors) && data.errors.length > 0 
      ? data.errors.join('; ') 
      : (data.warnings?.join('; ') || 'Невідома помилка API Нової Пошти')
    throw new Error(errorMsg)
  }

  return data.data
}

/**
 * Test Nova Poshta API Key validity & retrieve sender info
 */
export const testNpApiKey = async (customKey = null) => {
  try {
    const counterparties = await callNpApi('Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender' }, customKey)
    return {
      success: true,
      counterpartiesCount: counterparties?.length || 0,
      senderName: counterparties?.[0]?.Description || 'Відправник НП'
    }
  } catch (err) {
    return {
      success: false,
      message: err.message
    }
  }
}

/**
 * Search cities/settlements by name
 */
export const searchNpCities = async (cityName, customKey = null) => {
  if (!cityName || cityName.trim().length < 2) return []
  try {
    const data = await callNpApi('Address', 'searchSettlements', {
      CityName: cityName.trim(),
      Limit: '20'
    }, customKey)
    const items = data?.[0]?.Addresses || []
    return items.map(c => ({
      ref: c.DeliveryCity || c.Ref,
      mainDescription: c.MainDescription,
      area: c.Area,
      region: c.Region,
      fullName: `${c.MainDescription} (${c.Area} обл.)`
    }))
  } catch (err) {
    console.warn('[NovaPoshta] searchCities error:', err)
    return []
  }
}

/**
 * Search warehouses in a city
 */
export const fetchNpWarehouses = async (cityRef, cityName = '', customKey = null) => {
  if (!cityRef && !cityName) return []
  try {
    let data = null
    if (cityRef) {
      data = await callNpApi('Address', 'getWarehouses', { CityRef: cityRef, Limit: '500' }, customKey)
    }
    if ((!data || data.length === 0) && cityName) {
      const cleanName = typeof cityName === 'string' 
        ? cityName.split(',')[0].replace(/^(м\.|смт\.|с\.)\s*/i, '').trim() 
        : ''
      if (cleanName) {
        data = await callNpApi('Address', 'getWarehouses', { CityName: cleanName, Limit: '500' }, customKey)
      }
    }
    return (data || []).map(w => ({
      ref: w.Ref,
      number: String(w.Number),
      description: w.Description,
      shortAddress: w.ShortAddress || w.Description,
      phone: w.Phone,
      categoryOfWarehouse: w.CategoryOfWarehouse
    }))
  } catch (err) {
    console.warn('[NovaPoshta] fetchWarehouses error:', err)
    return []
  }
}

/**
 * Fetch Sender details (Counterparty, Address/Warehouse, Contact Person)
 */
export const fetchSenderDetails = async (customKey = null) => {
  try {
    const counterparties = await callNpApi('Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender' }, customKey)
    if (!counterparties || counterparties.length === 0) return null
    const sender = counterparties[0]

    const contacts = await callNpApi('Counterparty', 'getCounterpartyContactPersons', { Ref: sender.Ref }, customKey)
    const addresses = await callNpApi('Counterparty', 'getCounterpartyAddresses', { Ref: sender.Ref, CounterpartyProperty: 'Sender' }, customKey)

    return {
      senderRef: sender.Ref,
      senderName: sender.Description,
      contacts: contacts || [],
      contactRef: contacts?.[0]?.Ref || '',
      contactName: contacts?.[0] ? `${contacts[0].LastName} ${contacts[0].FirstName}` : sender.Description,
      contactPhone: contacts?.[0]?.Phones || '',
      addresses: addresses || [],
      addressRef: addresses?.[0]?.Ref || ''
    }
  } catch (err) {
    console.warn('[NovaPoshta] fetchSenderDetails error:', err)
    throw err
  }
}

/**
 * Create or retrieve Recipient Counterparty & Contact Person in Nova Poshta
 */
export const createOrGetRecipient = async ({
  recipientName = '',
  phone = '',
  edrpou = '',
  cityName = ''
}, customKey = null) => {
  const cleanPhone = phone.replace(/\D/g, '')

  // Format phone to 380...
  let formattedPhone = cleanPhone
  if (formattedPhone.length === 10 && formattedPhone.startsWith('0')) {
    formattedPhone = '38' + formattedPhone
  }

  const nameParts = recipientName.trim().split(/\s+/)
  const lastName = nameParts[0] || 'Клієнт'
  const firstName = nameParts[1] || 'Замовник'
  const middleName = nameParts[2] || ''

  const isLegal = Boolean(edrpou && edrpou.trim())

  try {
    const data = await callNpApi('Counterparty', 'save', {
      CounterpartyProperty: 'Recipient',
      CounterpartyType: isLegal ? 'Organization' : 'PrivatePerson',
      EDRPOU: isLegal ? edrpou.trim() : '',
      FirstName: firstName,
      LastName: lastName,
      MiddleName: middleName,
      Phone: formattedPhone,
      Email: ''
    }, customKey)

    const recipientObj = data?.[0]
    if (!recipientObj) throw new Error('Не вдалося зареєструвати отримувача НП')

    const recipientRef = recipientObj.Ref
    const contactRef = recipientObj.ContactPerson?.data?.[0]?.Ref || ''

    return {
      recipientRef,
      contactRef,
      recipientName
    }
  } catch (err) {
    console.warn('[NovaPoshta] createOrGetRecipient error:', err)
    throw err
  }
}

/**
 * Generate Express Waybill (ЕН / ТТН) in Nova Poshta
 */
export const generateNpTTN = async ({
  senderRef,
  senderAddressRef,
  senderContactRef,
  senderPhone,
  recipientRef,
  recipientAddressRef,
  recipientContactRef,
  recipientPhone,
  serviceType = 'WarehouseWarehouse', // WarehouseWarehouse, WarehouseDoors
  payerType = 'Recipient', // Recipient, Sender
  paymentMethod = 'Cash', // Cash, NonCash
  cost = '1000',
  cargoDescription = 'Деталі карбонової рами та метизи',
  seatsList = [] // Array of { length, width, height, weight }
}, customKey = null) => {
  const today = new Date()
  const dd = String(today.getDate()).padStart(2, '0')
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const yyyy = today.getFullYear()
  const dateStr = `${dd}.${mm}.${yyyy}`

  const validSeats = Array.isArray(seatsList) && seatsList.length > 0
    ? seatsList
    : [{ length: 30, width: 25, height: 30, weight: 1.5 }]

  const seatsAmount = validSeats.length

  let totalWeightNum = 0
  let totalVolM3 = 0

  const optionsSeatArray = validSeats.map(s => {
    const l = Number(s.length) || 30
    const w = Number(s.width) || 25
    const h = Number(s.height) || 30
    const wt = Number(s.weight) || 1.5

    totalWeightNum += wt
    const vol = (l / 100) * (w / 100) * (h / 100)
    totalVolM3 += vol

    return {
      volumetricVolume: String(((l * w * h) / 4000).toFixed(4)),
      volumetricWidth: String(w),
      volumetricLength: String(l),
      volumetricHeight: String(h),
      weight: String(wt)
    }
  })

  const props = {
    Sender: senderRef,
    SenderAddress: senderAddressRef,
    ContactSender: senderContactRef,
    SendersPhone: senderPhone,
    Recipient: recipientRef,
    RecipientAddress: recipientAddressRef,
    ContactRecipient: recipientContactRef,
    RecipientsPhone: recipientPhone,
    ServiceType: serviceType,
    PayerType: payerType,
    PaymentMethod: paymentMethod,
    DateTime: dateStr,
    Weight: String(totalWeightNum.toFixed(2)),
    SeatsAmount: String(seatsAmount),
    VolumeGeneral: String(totalVolM3.toFixed(4)),
    Cost: String(cost),
    CargoType: 'Cargo',
    Description: cargoDescription,
    OptionsSeat: optionsSeatArray
  }

  const resultData = await callNpApi('InternetDocument', 'save', props, customKey)
  const doc = resultData?.[0]

  if (!doc || !doc.IntDocNumber) {
    throw new Error('НП API не повернуло номер ТТН')
  }

  const ttnNumber = doc.IntDocNumber
  const ref = doc.Ref
  const estimatedCost = doc.CostOnSite || ''

  // Print sticker links (100x100 marking sticker & standard express waybill A4/A5)
  const apiKey = customKey || getNpApiKey()
  const printStickerUrl = `https://my.novaposhta.ua/orders/printMarking100x100/orders[]/${ref}/type/pdf/apiKey/${apiKey}`
  const printDocUrl = `https://my.novaposhta.ua/orders/printDocument/orders[]/${ref}/type/pdf/apiKey/${apiKey}`

  return {
    ttnNumber,
    ref,
    estimatedCost,
    printStickerUrl,
    printDocUrl
  }
}
