// ─── Форматування назви номенклатури спеціально для пакувального листа ─────────────────────
export const formatPackingSlipName = (nomName, materialType, productNames = '') => {
  const name = (nomName || '').trim().toUpperCase();
  
  // Паттерн 1: ІП-72-F5-В-3-45
  const match1 = name.match(/^(?:ІП|IP)-(\d+)-([A-Z0-9]+)-([ВНХПBHXP])[-_](\d+)-(\d+)$/);
  
  // Паттерн 2: F610-ІП24-Н-3-14
  const match2 = name.match(/^([A-Z0-9]+)-(?:ІП|IP)(\d+)-([ВНХПBHXP])[-_](\d+)-(\d+)$/);

  if (match1 || match2) {
    let projNum = '';
    let frame = '';
    let typeLetter = '';
    let thickness = '';
    let qty = '';
    
    if (match1) {
      projNum = match1[1];
      frame = match1[2];
      typeLetter = match1[3];
      thickness = match1[4];
      qty = match1[5];
    } else {
      frame = match2[1];
      projNum = match2[2];
      typeLetter = match2[3];
      thickness = match2[4];
      qty = match2[5];
    }
    
    const typeMap = {
      'В': 'Верхня пластина',
      'B': 'Верхня пластина',
      'Н': 'Нижня пластина',
      'H': 'Нижня пластина',
      'Х': 'Хрестик',
      'X': 'Хрестик',
      'П': 'Промені',
      'P': 'Промені'
    };
    const typeName = typeMap[typeLetter] || 'Деталь';
    
    let extra = '';
    if (productNames) {
      const parts = productNames.split(',').map(p => p.trim());
      const cityPart = parts.find(p => p.includes('Київ') || p.includes('К'));
      if (cityPart) {
        extra = cityPart;
      } else if (parts.length > 2) {
        extra = parts[parts.length - 1];
      }
    }
    if (!extra) {
      extra = 'Київ К';
    }
    
    return `${typeName}, ${frame}, ІП ${projNum}, ${extra}, ${thickness}мм, ${qty}шт`;
  }

  // Для гвинтів та гайок: якщо є опис в materialType, використовуємо його
  if (materialType && (name.startsWith('ГВИНТ') || name.startsWith('ГАЙКА'))) {
    let prefix = '';
    if (name.startsWith('ГВИНТ')) prefix = 'Гвинт ';
    if (name.startsWith('ГАЙКА')) prefix = 'Гайка ';
    
    let res = materialType;
    if (prefix && !res.toLowerCase().startsWith(prefix.trim().toLowerCase())) {
      res = prefix + res;
    }
    return res;
  }
  
  return nomName;
};

// ─── Кольори маркування палет ─────────────────────────────────────────────────
export const PALLET_COLORS = [
  { id: 'red',    label: 'Червоний',   hex: '#ef4444' },
  { id: 'orange', label: 'Помаранчевий', hex: '#f97316' },
  { id: 'yellow', label: 'Жовтий',    hex: '#eab308' },
  { id: 'green',  label: 'Зелений',   hex: '#22c55e' },
  { id: 'blue',   label: 'Синій',     hex: '#3b82f6' },
  { id: 'purple', label: 'Фіолетовий', hex: '#a855f7' },
  { id: 'pink',   label: 'Рожевий',   hex: '#ec4899' },
  { id: 'white',  label: 'Білий',     hex: '#f1f5f9' },
];

// ─── Парсер адрес доставки клієнта ──────────────────────────────────────────
export const parseCustomerDeliveryAddresses = (cust) => {
  if (!cust) return []
  let list = []

  if (Array.isArray(cust.deliveryAddresses)) {
    list = cust.deliveryAddresses
  } else if (Array.isArray(cust.delivery_addresses)) {
    list = cust.delivery_addresses
  } else if (cust.notes) {
    if (cust.notes.includes('[DELIVERY_ADDRESSES_B64:')) {
      const match = cust.notes.match(/\[DELIVERY_ADDRESSES_B64:([A-Za-z0-9+/=]+)\]/)
      if (match && match[1]) {
        try {
          const jsonStr = decodeURIComponent(escape(atob(match[1])))
          const parsed = JSON.parse(jsonStr)
          if (Array.isArray(parsed)) list = parsed
        } catch (e) {
          console.warn('[Shipping] B64 decode address error:', e)
        }
      }
    } else if (cust.notes.includes('[DELIVERY_ADDRESSES_JSON:')) {
      try {
        const match = cust.notes.match(/\[DELIVERY_ADDRESSES_JSON:([\s\S]*?)\]/)
        if (match && match[1]) {
          const parsed = JSON.parse(match[1])
          if (Array.isArray(parsed)) list = parsed
        }
      } catch (e) {}
    }
  }

  if (!Array.isArray(list) || list.length === 0) {
    if (cust.delivery_city || cust.delivery_warehouse || cust.city) {
      list = [{
        id: 'addr_def',
        title: 'Основна адреса',
        deliveryMethod: cust.delivery_method || 'np_warehouse',
        city: cust.delivery_city || cust.city || 'Київ',
        warehouse: cust.delivery_warehouse || '',
        address: cust.delivery_address || cust.address || '',
        recipientName: cust.delivery_recipient_name || cust.contact_person || '',
        recipientPhone: cust.delivery_recipient_phone || cust.phone || '',
        isLegalEntity: cust.is_legal_entity || false,
        edrpou: cust.edrpou || cust.tin || '',
        legalEntityName: cust.legal_entity_name || cust.company || '',
        isDefault: true
      }]
    }
  }

  return list
};
