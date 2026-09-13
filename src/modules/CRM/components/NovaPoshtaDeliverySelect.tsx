import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Truck, MapPin, Building2, Package, CheckCircle2, Loader2 } from 'lucide-react'
import { searchEdrpouCounterparty } from '../services/edrpouLookupService'
import { callNpApi } from '../../../services/novaPoshtaService.js'

export interface NovaPoshtaDeliverySelectProps {
  deliveryMethod?: 'np_warehouse' | 'np_postomat' | 'np_courier' | 'pickup' | string
  city?: string
  warehouse?: string
  address?: string
  recipientName?: string
  recipientPhone?: string
  isLegalEntity?: boolean
  edrpou?: string
  legalEntityName?: string
  onChange: (data: Record<string, any>) => void
  isEditing?: boolean
}

// Popular Ukrainian cities for instant suggestion / fallback
const POPULAR_CITIES: string[] = [
  'Київ', 'Львів', 'Дніпро', 'Одеса', 'Харків', 
  'Запоріжжя', 'Вінниця', 'Полтава', 'Черкаси', 'Івано-Франківськ',
  'Тернопіль', 'Рівне', 'Хмельницький', 'Кропивницький', 'Кривий Ріг',
  'Миколаїв', 'Житомир', 'Суми', 'Чернівці', 'Ужгород', 'Калуш'
]

// Fallback warehouses for main cities
const POPULAR_WAREHOUSES: Record<string, string[]> = {
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
const POPULAR_POSTOMATS: Record<string, string[]> = {
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

export function NovaPoshtaDeliverySelect({
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
}: NovaPoshtaDeliverySelectProps): React.JSX.Element {
  const [cityQuery, setCityQuery] = useState<string>(city || '')
  const [showCityHints, setShowCityHints] = useState<boolean>(false)
  const [citySuggestions, setCitySuggestions] = useState<string[]>([])

  const [warehouseQuery, setWarehouseQuery] = useState<string>(warehouse || '')
  const [showWarehouseHints, setShowWarehouseHints] = useState<boolean>(false)
  const [warehouseSuggestions, setWarehouseSuggestions] = useState<string[]>([])

  const [addressText, setAddressText] = useState<string>(address || '')
  const [streetSuggestions, setStreetSuggestions] = useState<string[]>([])
  const [showStreetHints, setShowStreetHints] = useState<boolean>(false)

  const [edrpouCode, setEdrpouCode] = useState<string>(edrpou || '')
  const [companyName, setCompanyName] = useState<string>(legalEntityName || '')
  const [edrpouMatch, setEdrpouMatch] = useState<any | null>(null)
  const [isSearchingEdrpou, setIsSearchingEdrpou] = useState<boolean>(false)

  const cityInputRef = useRef<HTMLInputElement>(null)
  const warehouseInputRef = useRef<HTMLInputElement>(null)

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
  const handleEdrpouChange = async (code: string): Promise<void> => {
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
        const apiData = await callNpApi('Address', 'searchSettlements', {
          CityName: cityQuery.trim(),
          Limit: '15'
        })
        if (apiData?.[0]?.Addresses) {
          const apiCities = apiData[0].Addresses.map((item: any) => item.Present)
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
        const apiData = await callNpApi('Address', 'getWarehouses', {
          CityName: currentCity,
          TypeOfWarehouseRef: isPostomatMode ? 'f931c480-5f2d-425d-bc2c-ac7cd29de9f5' : undefined,
          Limit: '100'
        })
        if (apiData?.length > 0) {
          let apiWhs = apiData.map((item: any) => item.Description)
          if (isPostomatMode) {
            const filteredPostomats = apiWhs.filter((w: string) => w.toLowerCase().includes('поштомат'))
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

  // Filter and prioritize warehouse suggestions based on warehouseQuery
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
        const apiData = await callNpApi('Address', 'searchSettlementStreets', {
          StreetName: addressText.trim(),
          SettlementRef: '',
          Limit: '10'
        })
        if (apiData?.[0]?.Addresses) {
          setStreetSuggestions(apiData[0].Addresses.map((item: any) => item.Present))
        }
      } catch (e) {}
    }, 300)

    return () => clearTimeout(timer)
  }, [addressText, cityQuery, deliveryMethod])

  const handleSelectCity = (selectedCity: string): void => {
    setCityQuery(selectedCity)
    setShowCityHints(false)
    onChange({ city: selectedCity, deliveryCity: selectedCity, warehouse: '' })
  }

  const handleSelectWarehouse = (selectedWh: string): void => {
    setWarehouseQuery(selectedWh)
    setShowWarehouseHints(false)
    onChange({ warehouse: selectedWh, deliveryWarehouse: selectedWh })
  }

  const handleSelectStreet = (street: string): void => {
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

      {/* 2. Main Delivery Inputs Grid */}
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
                placeholder="Введіть місто (напр. Калуш)..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--input-bg, #000)',
                  color: 'var(--text, #fff)',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}
              />

              {showCityHints && citySuggestions.length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    marginTop: '4px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--modal-bg, #111)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    padding: '6px'
                  }}
                >
                  {citySuggestions.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectCity(c)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text, #fff)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,144,0,0.15)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '9px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', fontSize: '0.82rem', fontWeight: 800 }}>
              {cityQuery || '—'}
            </div>
          )}
        </div>

        {/* Warehouse / Postomat / Courier Address */}
        <div style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            {deliveryMethod === 'np_postomat' ? 'Поштомат НП' : deliveryMethod === 'np_courier' ? 'Адреса доставки (Вулиця, буд.)' : 'Відділення НП'}
          </label>

          {isEditing ? (
            deliveryMethod === 'np_courier' ? (
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
                  placeholder="Введіть вулицю та номер будинку..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--input-bg, #000)',
                    color: 'var(--text, #fff)',
                    fontSize: '0.82rem',
                    fontWeight: 700
                  }}
                />

                {showStreetHints && streetSuggestions.length > 0 && (
                  <div
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      marginTop: '4px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      background: 'var(--modal-bg, #111)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      padding: '6px'
                    }}
                  >
                    {streetSuggestions.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectStreet(s)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'var(--text, #fff)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,144,0,0.15)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
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
                  placeholder={deliveryMethod === 'np_postomat' ? 'Пошук поштомату...' : 'Введіть номер або адресу (напр. 5 або Дзвонарська)...'}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--input-bg, #000)',
                    color: 'var(--text, #fff)',
                    fontSize: '0.82rem',
                    fontWeight: 700
                  }}
                />

                {showWarehouseHints && filteredWarehouseSuggestions.length > 0 && (
                  <div
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      marginTop: '4px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      borderRadius: '12px',
                      border: '1px solid var(--glass-border)',
                      background: 'var(--modal-bg, #111)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      padding: '6px'
                    }}
                  >
                    {filteredWarehouseSuggestions.map((w, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectWarehouse(w)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'var(--text, #fff)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,144,0,0.15)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (
            <div style={{ padding: '9px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', fontSize: '0.82rem', fontWeight: 800 }}>
              {deliveryMethod === 'np_courier' ? (addressText || '—') : (warehouseQuery || '—')}
            </div>
          )}
        </div>
      </div>

      {/* 3. Recipient Info & Legal Entity EDRPOU Verification */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '4px' }}>
        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Отримувач (ПІБ)
          </label>
          {isEditing ? (
            <input
              type="text"
              value={recipientName}
              onChange={(e) => onChange({ recipientName: e.target.value, recipient_name: e.target.value })}
              placeholder="Іванов Іван Іванович"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--input-bg, #000)',
                color: 'var(--text, #fff)',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            />
          ) : (
            <div style={{ padding: '9px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', fontSize: '0.82rem', fontWeight: 800 }}>
              {recipientName || '—'}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            Телефон отримувача
          </label>
          {isEditing ? (
            <input
              type="text"
              value={recipientPhone}
              onChange={(e) => onChange({ recipientPhone: e.target.value, recipient_phone: e.target.value, phone: e.target.value })}
              placeholder="+380..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--input-bg, #000)',
                color: 'var(--text, #fff)',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            />
          ) : (
            <div style={{ padding: '9px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', fontSize: '0.82rem', fontWeight: 800 }}>
              {recipientPhone || '—'}
            </div>
          )}
        </div>
      </div>

      {/* 4. Legal Entity EDRPOU Live Lookup Box */}
      {isLegalEntity && (
        <div style={{
          padding: '14px 16px',
          borderRadius: '14px',
          border: '1px solid rgba(255, 144, 0, 0.3)',
          background: 'rgba(255, 144, 0, 0.04)',
          marginTop: '6px'
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#ff9000', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={14} /> РЕКВІЗИТИ ЮРИДИЧНОЇ ОСОБИ (ПОШУК ЄДРПОУ)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#aaa', display: 'block', marginBottom: '4px' }}>
                Код ЄДРПОУ / ІПН
              </label>
              {isEditing ? (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={edrpouCode}
                    onChange={(e) => handleEdrpouChange(e.target.value)}
                    placeholder="12345678"
                    maxLength={10}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border)',
                      background: '#000',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      fontFamily: 'monospace'
                    }}
                  />
                  {isSearchingEdrpou && (
                    <Loader2 size={14} className="spin" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#ff9000' }} />
                  )}
                </div>
              ) : (
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 800 }}>
                  {edrpouCode || '—'}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.68rem', fontWeight: 800, color: '#aaa', display: 'block', marginBottom: '4px' }}>
                Назва ТОВ / ФОП (Автозаповнення)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value)
                    onChange({ legalEntityName: e.target.value, company: e.target.value })
                  }}
                  placeholder="ТОВ 'ТОРГОВИЙ ДІМ'..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: '#000',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}
                />
              ) : (
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', fontSize: '0.8rem', fontWeight: 800 }}>
                  {companyName || '—'}
                </div>
              )}
            </div>
          </div>

          {edrpouMatch && !('notFound' in edrpouMatch) && (
            <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              <CheckCircle2 size={14} /> Перевірено в ЄДР: {edrpouMatch.name} (Директор: {edrpouMatch.ceo || '—'})
            </div>
          )}
        </div>
      )}
    </div>
  )
}
