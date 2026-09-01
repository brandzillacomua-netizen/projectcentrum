import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Truck, MapPin, Search, Building2, Package, Check, Building, FileText, CheckCircle2, Loader2 } from 'lucide-react'
import { searchEdrpouCounterparty } from '../services/edrpouLookupService'

// Popular Ukrainian cities for instant suggestion / fallback
const POPULAR_CITIES = [
  'Київ', 'Львів', 'Дніпро', 'Одеса', 'Харків', 
  'Запоріжжя', 'Вінниця', 'Полтава', 'Черкаси', 'Івано-Франківськ',
  'Тернопіль', 'Рівне', 'Хмельницький', 'Кропивницький', 'Кривий Ріг',
  'Миколаїв', 'Житомир', 'Суми', 'Чернівці', 'Ужгород', 'Калуш'
]

// Fallback warehouses for main cities
const POPULAR_WAREHOUSES = {
  'Київ': [
    'Відділення №1: вул. Пирогівський шлях, 135',
    'Відділення №2: вул. Бережанська, 9',
    'Відділення №3: вул. Калачівська, 13',
    'Відділення №5: вул. Федорова, 32',
    'Відділення №11: вул. Вербицького, 1'
  ],
  'Львів': [
    'Відділення №1: вул. Городоцька, 355',
    'Відділення №2: вул. Пластова, 7',
    'Відділення №3: вул. Угорська, 22'
  ],
  'Дніпро': [
    'Відділення №1: вул. Маршала Малиновського, 98а',
    'Відділення №2: вул. Академіка Янгеля, 40'
  ],
  'Одеса': [
    'Відділення №1: Київське шосе, 27',
    'Відділення №2: вул. Базова, 16'
  ],
  'Калуш': [
    'Відділення №1: вул. Дзвонарська, 5',
    'Відділення №2: вул. Ринкова, 2'
  ]
}

// Fallback Postomats for main cities
const POPULAR_POSTOMATS = {
  'Київ': [
    'Поштомат №1001: вул. Хрещатик, 22',
    'Поштомат №1002: вул. Басейна, 5',
    'Поштомат №1005: пр. Перемоги, 45',
    'Поштомат №1010: вул. Велика Васильківська, 72',
    'Поштомат №1024: пр. Оболонський, 19'
  ],
  'Львів': [
    'Поштомат №2001: пл. Ринок, 1',
    'Поштомат №2005: вул. Стрийська, 30',
    'Поштомат №2012: пр. Чорновола, 67'
  ],
  'Дніпро': [
    'Поштомат №3001: пр. Дмитра Яворницького, 10',
    'Поштомат №3005: вул. Набережна Перемоги, 38'
  ],
  'Одеса': [
    'Поштомат №4001: вул. Дерибасівська, 14',
    'Поштомат №4008: пр. Шевченка, 4'
  ],
  'Калуш': [
    'Поштомат №5001: вул. Дзвонарська, 5',
    'Поштомат №5002: пр. Лесі Українки, 19'
  ]
}

export const NovaPoshtaDeliverySelect = ({
  deliveryMethod = 'np_warehouse',
  city = '',
  warehouse = '',
  address = '',
  recipientName = '',
  recipientPhone = '',
  isLegalEntity = false,
  edrpou = '',
  legalEntityName = '',
  onChange,
  isEditing = false
}) => {
  const [cityQuery, setCityQuery] = useState(city || '')
  const [showCityHints, setShowCityHints] = useState(false)
  const [citySuggestions, setCitySuggestions] = useState([])

  const [warehouseQuery, setWarehouseQuery] = useState(warehouse || '')
  const [showWarehouseHints, setShowWarehouseHints] = useState(false)
  const [warehouseSuggestions, setWarehouseSuggestions] = useState([])

  const [addressText, setAddressText] = useState(address || '')
  const [streetSuggestions, setStreetSuggestions] = useState([])
  const [showStreetHints, setShowStreetHints] = useState(false)

  const [edrpouCode, setEdrpouCode] = useState(edrpou || '')
  const [companyName, setCompanyName] = useState(legalEntityName || '')
  const [edrpouMatch, setEdrpouMatch] = useState(null)
  const [isSearchingEdrpou, setIsSearchingEdrpou] = useState(false)

  const cityInputRef = useRef(null)
  const warehouseInputRef = useRef(null)

  useEffect(() => {
    setCityQuery(city || '')
  }, [city])

  useEffect(() => {
    setWarehouseQuery(warehouse || '')
  }, [warehouse])

  useEffect(() => {
    setAddressText(address || '')
  }, [address])

  useEffect(() => {
    setEdrpouCode(edrpou || '')
  }, [edrpou])

  useEffect(() => {
    setCompanyName(legalEntityName || '')
  }, [legalEntityName])

  // Live EDRPOU Lookup
  const handleEdrpouChange = async (code) => {
    const cleanCode = code.trim().replace(/\D/g, '')
    setEdrpouCode(cleanCode)
    onChange({ edrpou: cleanCode, tin: cleanCode })

    if (!cleanCode || cleanCode.length < 5) {
      setEdrpouMatch(null)
      return
    }

    setIsSearchingEdrpou(true)
    try {
      const result = await searchEdrpouCounterparty(cleanCode)
      if (result && result.name) {
        setEdrpouMatch(result)
        setCompanyName(result.name)
        onChange({ legalEntityName: result.name, company: result.name })
      } else {
        setEdrpouMatch({ notFound: true })
      }
    } catch(e) {
      console.warn('EDRPOU search error:', e)
      setEdrpouMatch({ notFound: true })
    } finally {
      setIsSearchingEdrpou(false)
    }
  }

  // Fetch Cities from Nova Poshta API
  useEffect(() => {
    if (!cityQuery.trim()) {
      setCitySuggestions(POPULAR_CITIES)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: '',
            modelName: 'Address',
            calledMethod: 'searchSettlements',
            methodProperties: {
              CityName: cityQuery.trim(),
              Limit: '15'
            }
          })
        })
        const data = await response.json()
        if (data && data.success && data.data && data.data[0]?.Addresses) {
          const apiCities = data.data[0].Addresses.map(item => item.Present)
          setCitySuggestions(apiCities.length > 0 ? apiCities : POPULAR_CITIES)
        } else {
          const filtered = POPULAR_CITIES.filter(c => c.toLowerCase().includes(cityQuery.toLowerCase()))
          setCitySuggestions(filtered)
        }
      } catch (e) {
        const filtered = POPULAR_CITIES.filter(c => c.toLowerCase().includes(cityQuery.toLowerCase()))
        setCitySuggestions(filtered)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [cityQuery])

  // Fetch Warehouses / Postomats for City from Nova Poshta API
  useEffect(() => {
    const currentCity = cityQuery.split(',')[0].replace('м.', '').trim()
    if (!currentCity || deliveryMethod === 'np_courier' || deliveryMethod === 'pickup') {
      setWarehouseSuggestions([])
      return
    }

    const isPostomatMode = deliveryMethod === 'np_postomat'

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: '',
            modelName: 'Address',
            calledMethod: 'getWarehouses',
            methodProperties: {
              CityName: currentCity,
              TypeOfWarehouseRef: isPostomatMode ? 'f931c480-5f2d-425d-bc2c-ac7cd29de9f5' : undefined,
              Limit: '100'
            }
          })
        })
        const data = await response.json()
        if (data && data.success && data.data && data.data.length > 0) {
          let apiWhs = data.data.map(item => item.Description)
          if (isPostomatMode) {
            const filteredPostomats = apiWhs.filter(w => w.toLowerCase().includes('поштомат'))
            apiWhs = filteredPostomats.length > 0 ? filteredPostomats : apiWhs
          }
          setWarehouseSuggestions(apiWhs)
        } else {
          const fallback = isPostomatMode
            ? (POPULAR_POSTOMATS[currentCity] || POPULAR_POSTOMATS['Київ'])
            : (POPULAR_WAREHOUSES[currentCity] || POPULAR_WAREHOUSES['Київ'])
          setWarehouseSuggestions(fallback)
        }
      } catch (e) {
        const fallback = isPostomatMode
          ? (POPULAR_POSTOMATS[currentCity] || POPULAR_POSTOMATS['Київ'])
          : (POPULAR_WAREHOUSES[currentCity] || POPULAR_WAREHOUSES['Київ'])
        setWarehouseSuggestions(fallback)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [cityQuery, deliveryMethod])

  // Filter and prioritize warehouse suggestions based on warehouseQuery (e.g. typing "5" shows Branch №5 first)
  const filteredWarehouseSuggestions = useMemo(() => {
    if (!warehouseSuggestions || warehouseSuggestions.length === 0) return []
    if (!warehouseQuery || !warehouseQuery.trim()) return warehouseSuggestions
    const q = warehouseQuery.trim().toLowerCase()

    const matches = warehouseSuggestions.filter(w => w.toLowerCase().includes(q))

    return matches.sort((a, b) => {
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()

      if (/^\d+$/.test(q)) {
        const aIsExactNum = aLower.includes(`№${q}:`) || aLower.includes(`№ ${q}:`) || aLower.includes(`№${q} `) || aLower.includes(`№ ${q} `) || aLower.includes(`№${q}(`) || aLower.includes(`№ ${q}(`)
        const bIsExactNum = bLower.includes(`№${q}:`) || bLower.includes(`№ ${q}:`) || bLower.includes(`№${q} `) || bLower.includes(`№ ${q} `) || bLower.includes(`№${q}(`) || bLower.includes(`№ ${q}(`)
        if (aIsExactNum && !bIsExactNum) return -1
        if (!aIsExactNum && bIsExactNum) return 1
      }

      const aStarts = aLower.includes(`№${q}`)
      const bStarts = bLower.includes(`№${q}`)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1

      return 0
    })
  }, [warehouseSuggestions, warehouseQuery])

  // Fetch Streets for Courier Address Delivery
  useEffect(() => {
    if (deliveryMethod !== 'np_courier' || !addressText.trim()) {
      setStreetSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: '',
            modelName: 'Address',
            calledMethod: 'searchSettlementStreets',
            methodProperties: {
              StreetName: addressText.trim(),
              SettlementRef: '',
              Limit: '10'
            }
          })
        })
        const data = await response.json()
        if (data && data.success && data.data && data.data[0]?.Addresses) {
          setStreetSuggestions(data.data[0].Addresses.map(item => item.Present))
        }
      } catch (e) {}
    }, 300)

    return () => clearTimeout(timer)
  }, [addressText, cityQuery, deliveryMethod])

  const handleSelectCity = (selectedCity) => {
    setCityQuery(selectedCity)
    setShowCityHints(false)
    onChange({ city: selectedCity, deliveryCity: selectedCity, warehouse: '' })
  }

  const handleSelectWarehouse = (selectedWh) => {
    setWarehouseQuery(selectedWh)
    setShowWarehouseHints(false)
    onChange({ warehouse: selectedWh, deliveryWarehouse: selectedWh })
  }

  const handleSelectStreet = (street) => {
    setAddressText(street)
    setShowStreetHints(false)
    onChange({ address: street, deliveryAddress: street })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Delivery Method Selector */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { id: 'np_warehouse', label: 'Нова Пошта (Відділення)', icon: <Truck size={14} /> },
          { id: 'np_postomat', label: 'Нова Пошта (Поштомат)', icon: <Package size={14} /> },
          { id: 'np_courier', label: 'Адресна доставка НП', icon: <MapPin size={14} /> },
          { id: 'pickup', label: 'Самовивіз з виробництва', icon: <Building2 size={14} /> }
        ].map(m => {
          const isSel = deliveryMethod === m.id
          return (
            <button
              key={m.id}
              type="button"
              disabled={!isEditing}
              onClick={() => {
                onChange({ deliveryMethod: m.id, warehouse: '' })
                setWarehouseQuery('')
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: isSel ? '1px solid #ff9000' : '1px solid var(--glass-border)',
                background: isSel ? 'rgba(255, 144, 0, 0.15)' : 'var(--card-bg, rgba(0,0,0,0.05))',
                color: isSel ? '#ff9000' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: isEditing ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {m.icon} {m.label}
            </button>
          )
        })}
      </div>

      {/* 2. Main Delivery Inputs Grid (City + Warehouse/Postomat/Address) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* City Input with Autocomplete */}
        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Місто / Населений пункт (Пошук НП)
          </label>
          {isEditing ? (
            <div style={{ position: 'relative' }}>
              <input
                ref={cityInputRef}
                type="text"
                value={cityQuery}
                onChange={(e) => {
                  setCityQuery(e.target.value)
                  onChange({ city: e.target.value, deliveryCity: e.target.value })
                  setShowCityHints(true)
                }}
                onFocus={() => setShowCityHints(true)}
                onBlur={() => setTimeout(() => setShowCityHints(false), 200)}
                placeholder="Введіть місто (напр. Київ, Калуш, Львів)..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--card-bg, rgba(0,0,0,0.15))',
                  color: 'var(--text)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {showCityHints && citySuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  marginTop: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                }}>
                  {citySuggestions.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectCity(c)}
                      style={{
                        padding: '10px 14px',
                        fontSize: '0.82rem',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--glass-border)',
                        fontWeight: 600
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,144,0,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      📍 {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)' }}>
              {city || 'Не вказано'}
            </div>
          )}
        </div>

        {/* Warehouse / Postomat / Address Input */}
        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            {deliveryMethod === 'np_courier' || deliveryMethod === 'pickup'
              ? 'Вулиця / Адреса Доставки'
              : deliveryMethod === 'np_postomat'
              ? 'Поштомат НП'
              : 'Відділення НП'}
          </label>
          {isEditing ? (
            deliveryMethod === 'np_courier' || deliveryMethod === 'pickup' ? (
              /* Address Delivery Input */
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => {
                    setAddressText(e.target.value)
                    onChange({ address: e.target.value, deliveryAddress: e.target.value })
                    setShowStreetHints(true)
                  }}
                  onFocus={() => setShowStreetHints(true)}
                  onBlur={() => setTimeout(() => setShowStreetHints(false), 200)}
                  placeholder="вул. Дзвонарська, буд. 15, оф. 4..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, rgba(0,0,0,0.15))',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
                {showStreetHints && streetSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    marginTop: '4px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                  }}>
                    {streetSuggestions.map((st, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectStreet(st)}
                        style={{
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          color: 'var(--text)',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--glass-border)',
                          fontWeight: 600
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,144,0,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        🗺️ {st}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Warehouse or Postomat Input with Autocomplete */
              <div style={{ position: 'relative' }}>
                <input
                  ref={warehouseInputRef}
                  type="text"
                  value={warehouseQuery}
                  onChange={(e) => {
                    setWarehouseQuery(e.target.value)
                    onChange({ warehouse: e.target.value, deliveryWarehouse: e.target.value })
                    setShowWarehouseHints(true)
                  }}
                  onFocus={() => setShowWarehouseHints(true)}
                  onBlur={() => setTimeout(() => setShowWarehouseHints(false), 200)}
                  placeholder={deliveryMethod === 'np_postomat' ? "№ поштомату або адреса (напр. 1001)..." : "№ відділення або назва вулиці..."}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, rgba(0,0,0,0.15))',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
                {showWarehouseHints && filteredWarehouseSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                  }}>
                    {filteredWarehouseSuggestions.map((wh, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectWarehouse(wh)}
                        style={{
                          padding: '10px 14px',
                          fontSize: '0.82rem',
                          color: 'var(--text)',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--glass-border)',
                          fontWeight: 600
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,144,0,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {deliveryMethod === 'np_postomat' ? '📮' : '📦'} {wh}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)' }}>
              {deliveryMethod === 'np_courier' || deliveryMethod === 'pickup' ? (addressText || 'Не вказано') : (warehouseQuery || 'Не вказано')}
            </div>
          )}
        </div>
      </div>

      {/* 3. Recipient Contact Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            ПІБ Представника / Отримувача
          </label>
          {isEditing ? (
            <input
              type="text"
              value={recipientName || ''}
              onChange={(e) => onChange({ recipientName: e.target.value, deliveryRecipientName: e.target.value })}
              placeholder="Іванов Іван Іванович..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg, rgba(0,0,0,0.15))',
                color: 'var(--text)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          ) : (
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
              {recipientName || 'Збігається з контактом клієнта'}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Телефон Отримувача
          </label>
          {isEditing ? (
            <input
              type="text"
              value={recipientPhone || ''}
              onChange={(e) => onChange({ recipientPhone: e.target.value, deliveryRecipientPhone: e.target.value })}
              placeholder="+380 (67) 123-45-67..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg, rgba(0,0,0,0.15))',
                color: 'var(--text)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          ) : (
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
              {recipientPhone || 'Основний контактний телефон'}
            </div>
          )}
        </div>
      </div>

      {/* 4. Legal Entity Checkbox Toggle & EDRPOU Block — Placed BELOW Delivery */}
      <div style={{
        marginTop: '8px',
        paddingTop: '16px',
        borderTop: '1px dashed var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: isLegalEntity ? 'rgba(99, 102, 241, 0.08)' : 'var(--glass-border, rgba(0,0,0,0.03))',
          border: isLegalEntity ? '1px solid #6366f1' : '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '10px 14px',
          transition: 'all 0.2s'
        }}>
          <input
            type="checkbox"
            id="legalEntityCheckbox"
            disabled={!isEditing}
            checked={isLegalEntity}
            onChange={(e) => onChange({ isLegalEntity: e.target.checked })}
            style={{ width: '18px', height: '18px', cursor: isEditing ? 'pointer' : 'default', accentColor: '#6366f1' }}
          />
          <label htmlFor="legalEntityCheckbox" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', cursor: isEditing ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={16} color="#6366f1" /> Отримувач — Юридична особа (ТОВ, ПП, Організація)
          </label>
        </div>

        {/* Legal Entity Search Fields — Stacked in 2 Clean Rows */}
        {isLegalEntity && (
          <div style={{
            background: 'rgba(99, 102, 241, 0.06)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            {/* Row 1: EDRPOU / IPN Code Field */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Код ЄДРПОУ / ІПН (Пошук)
              </label>
              {isEditing ? (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    maxLength={10}
                    value={edrpouCode}
                    onChange={(e) => handleEdrpouChange(e.target.value)}
                    placeholder="Введіть код 8 цифр (ЄДРПОУ) або 10 цифр (ІПН ФОП)..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #6366f1',
                      background: 'var(--card-bg, rgba(0,0,0,0.2))',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      outline: 'none'
                    }}
                  />
                  {isSearchingEdrpou ? (
                    <Loader2 size={16} color="#6366f1" className="spin" style={{ position: 'absolute', right: '10px', top: '12px' }} />
                  ) : edrpouMatch && edrpouMatch.name ? (
                    <CheckCircle2 size={16} color="#10b981" style={{ position: 'absolute', right: '10px', top: '12px' }} />
                  ) : null}
                </div>
              ) : (
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)' }}>
                  {edrpouCode || 'Не вказано'}
                </div>
              )}
            </div>

            {/* Row 2: Legal Entity / FOP Name Field */}
            <div>
              <label style={{ fontSize: '0.7rem', fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Назва Організації / Компанії / ФОП (Підтягнута по ЄДРПОУ)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value)
                    onChange({ legalEntityName: e.target.value, company: e.target.value })
                  }}
                  placeholder="напр. ТОВ Брандзілла або ФОП..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--card-bg, rgba(0,0,0,0.2))',
                    color: 'var(--text)',
                    fontSize: '0.88rem',
                    fontWeight: 850,
                    outline: 'none'
                  }}
                />
              ) : (
                <div style={{ fontSize: '0.88rem', fontWeight: 850, color: 'var(--text)' }}>
                  {companyName || 'Не вказано'}
                </div>
              )}
            </div>

            {edrpouMatch && edrpouMatch.name && (
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Знайдено ({edrpouMatch.source}): {edrpouMatch.name}
              </div>
            )}

            {edrpouMatch && edrpouMatch.notFound && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  ℹ️ За кодом <span style={{ color: '#6366f1' }}>{edrpouCode}</span> автоматичного запису не знайдено в відкритих API. Введіть назву компанії/ФОП вручну.
                </div>
                {recipientName && recipientName.trim().length > 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      const fop = `ФОП ${recipientName.trim().toUpperCase()}`
                      setCompanyName(fop)
                      onChange({ legalEntityName: fop, company: fop })
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid #6366f1',
                      background: 'rgba(99,102,241,0.1)',
                      color: '#6366f1',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    + Вставити як "ФОП {recipientName.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
