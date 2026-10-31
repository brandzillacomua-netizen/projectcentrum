/**
 * Centrum AI Service - Hybrid AI Engine
 * Communicates with live Google Gemini API or OpenAI API if configured,
 * or utilizes local MES big-data analytics processor.
 */

import { processGeminiQuery } from './geminiQueryProcessor'

const API_KEY_STORAGE_KEY = 'centrum_ai_gemini_key'
const MODEL_STORAGE_KEY = 'centrum_ai_gemini_model'

export function getSavedAiApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || import.meta.env.VITE_GEMINI_API_KEY || ''
  } catch (_) {
    return ''
  }
}

export function saveAiApiKey(key) {
  try {
    if (!key) {
      localStorage.removeItem(API_KEY_STORAGE_KEY)
      localStorage.removeItem(MODEL_STORAGE_KEY)
    } else {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim())
    }
  } catch (_) {}
}

export async function validateAiKey(key) {
  const cleanKey = String(key || '').trim()
  if (!cleanKey) return { ok: false, error: 'Ключ порожній' }

  // 1. OpenAI Key check
  if (cleanKey.startsWith('sk-')) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5
        })
      })
      if (res.ok) return { ok: true, provider: 'OpenAI (GPT-4o-mini)' }
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: err.error?.message || `HTTP ${res.status} помилка OpenAI` }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  // 2. Google Gemini Key check - query available models dynamically from Google
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`)
    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}))
      return { ok: false, error: err.error?.message || `HTTP ${listRes.status} помилка Google Gemini` }
    }

    const data = await listRes.json()
    const available = (data.models || []).filter(m =>
      m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
    )

    if (available.length === 0) {
      return { ok: false, error: 'Для вашого ключа не знайдено моделей із підтримкою генерації контенту' }
    }

    // Prioritize models: gemini-3.8-flash -> 3.x -> 2.5 -> 2.0 -> 1.5 -> any flash -> first available
    const chosen = available.find(m => m.name.includes('gemini-3.8-flash')) ||
                   available.find(m => m.name.includes('gemini-3.')) ||
                   available.find(m => m.name.includes('gemini-2.5-flash')) ||
                   available.find(m => m.name.includes('gemini-2.0-flash')) ||
                   available.find(m => m.name.includes('gemini-1.5-flash')) ||
                   available.find(m => m.name.includes('flash')) ||
                   available.find(m => m.name.includes('gemini-1.5-pro')) ||
                   available[0]

    const cleanModelName = chosen.name.replace(/^models\//, '')
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, cleanModelName)
    } catch (_) {}

    return { ok: true, provider: `Google Gemini (${cleanModelName})` }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function callGeminiApi(apiKey, systemPrompt, chatHistory, query) {
  let preferredModel = 'gemini-1.5-flash'
  try {
    preferredModel = localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-1.5-flash'
  } catch (_) {}

  // Construct valid Gemini contents:
  // 1. Welcome message from bot is stripped
  // 2. First message in contents MUST have role: 'user'
  // 3. Roles MUST strictly alternate: user -> model -> user -> model
  const contents = []

  for (const m of (chatHistory || [])) {
    if (!m || m.id === 'welcome-msg' || !m.text) continue
    const role = m.sender === 'user' ? 'user' : 'model'

    if (contents.length === 0 && role !== 'user') continue

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n\n${m.text}`
      continue
    }

    contents.push({
      role,
      parts: [{ text: m.text }]
    })
  }

  // Add the current user query (ensuring it's user role)
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += `\n\n${query}`
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: query }]
    })
  }

  // Model cascade prioritizing latest active Google models (gemini-3.8-flash first)
  const candidateModels = Array.from(new Set([
    'gemini-3.8-flash',
    preferredModel,
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ])).filter(Boolean)

  let firstError = null

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i]
    const endpointName = model.startsWith('models/') ? model : `models/${model}`
    try {
      // Note: Google Gemini REST API strictly requires camelCase: systemInstruction
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${endpointName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      })

      if (res.ok) {
        const json = await res.json()
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          try { localStorage.setItem(MODEL_STORAGE_KEY, model.replace(/^models\//, '')) } catch (_) {}
          return { ok: true, text, model: model.replace(/^models\//, '') }
        }
      }

      const errJson = await res.json().catch(() => ({}))
      const modelErr = errJson.error?.message || `HTTP ${res.status}`
      if (!firstError) firstError = modelErr

      // Auto-recovery: if Google says "Please update your code to use models/<name>", immediately queue that model!
      const modelMatches = String(modelErr).match(/models\/([a-zA-Z0-9\.\-_]+)/g)
      if (modelMatches && modelMatches.length > 0) {
        const recommended = modelMatches[modelMatches.length - 1].replace(/^models\//, '')
        if (recommended && !candidateModels.includes(recommended)) {
          candidateModels.splice(i + 1, 0, recommended)
        }
      }

      // If systemInstruction or any schema issue happened, retry immediately with prompt inlining
      const inlineContents = [
        ...contents.slice(0, -1),
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n---\nЗапит директора: ${query}` }]
        }
      ]
      const fallbackRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${endpointName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: inlineContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      })
      if (fallbackRes.ok) {
        const fbJson = await fallbackRes.json()
        const fbText = fbJson.candidates?.[0]?.content?.parts?.[0]?.text
        if (fbText) {
          try { localStorage.setItem(MODEL_STORAGE_KEY, model.replace(/^models\//, '')) } catch (_) {}
          return { ok: true, text: fbText, model: model.replace(/^models\//, '') }
        }
      }

      console.warn(`[Centrum AI] Gemini model ${model} failed:`, modelErr)
      if (res.status === 400 && String(modelErr).toLowerCase().includes('key')) break
      if (res.status === 403) break
    } catch (e) {
      if (!firstError) firstError = e.message
    }
  }

  // Final fallback: ask Google ModelService directly for any model that supports generateContent
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (listRes.ok) {
      const listData = await listRes.json()
      const valid = (listData.models || []).find(m => m.supportedGenerationMethods?.includes('generateContent'))
      if (valid && valid.name) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${valid.name}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${query}` }] }]
          })
        })
        if (res.ok) {
          const json = await res.json()
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            const mClean = valid.name.replace(/^models\//, '')
            try { localStorage.setItem(MODEL_STORAGE_KEY, mClean) } catch (_) {}
            return { ok: true, text, model: mClean }
          }
        }
      }
    }
  } catch (_) {}

  return { ok: false, error: firstError }
}

async function callOpenAiApi(apiKey, systemPrompt, chatHistory, query) {
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory
        .filter(m => m && m.id !== 'welcome-msg' && m.text)
        .slice(-8)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        })),
      { role: 'user', content: query }
    ]

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    })

    if (res.ok) {
      const json = await res.json()
      const text = json.choices?.[0]?.message?.content
      if (text) {
        return { ok: true, text, model: 'GPT-4o-mini' }
      }
    }

    const errJson = await res.json().catch(() => ({}))
    return { ok: false, error: errJson.error?.message || `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export async function askCentrumAi(query, {
  operators = [],
  shifts = [],
  history = [],
  nomenclatures = [],
  inventory = [],
  orders = [],
  machines = [],
  tasks = [],
  workCards = [],
  dateRange = '30d',
  chatHistory = []
}) {
  const apiKey = getSavedAiApiKey()

  // 1. If API key is present, execute cloud LLM request
  if (apiKey) {
    const liveSnapshot = prepareDatabaseSnapshot({
      operators,
      shifts,
      inventory,
      orders,
      machines,
      workCards,
      tasks,
      history
    })

    const periodStr = dateRange === '7d' ? 'останні 7 днів' : dateRange === 'month' ? 'поточний місяць' : dateRange === 'all' ? 'весь час' : 'останні 30 днів'

    const systemPrompt = `Ти — CENTRUM AI, розумний, живий і людяний ШІ-директор та аналітик фабрики Centrum (ERP & MES). 
Ти спілкуєшся живою, природною, професійною українською мовою, як досвідчений заступник директора у кабінеті. НЕ відповідай сухими заученими шаблонами чи відписками.

ПРАВИЛА РОБОТИ З ДАНИМИ ТА ДИРЕКТОРОМ:
1. Аналізуй оперативний стан справ фабрики за наданим нижче зрізом даних (карти в роботі, верстати, склади, замовлення, оператори).
2. Якщо директор питає «Скільки карт/нарядів зараз в роботі?» або «Що зараз робиться?» — давай ТОЧНУ кількість із розділу «ЗАРАЗ У РОБОТІ В ЦЕХУ», перелічи етапи (розкрій, галтовка, прес), верстати та що конкретно ріжеться чи обробляється.
3. Якщо питають про фрези чи матеріали на СО/СГП — відповідай чітко за складом СО: скільки всього, скільки вільно, чи є дефіцит.
4. Якщо питають «Звідки дані?» або «Чому звіти показують інше?» — поясни, що ти береш живі дані з цеху (MES work_card_history та активні картки на планшетах), де враховано всі операції та незавершене виробництво, а бухгалтерські звіти 1С враховують лише остаточно закриті наряди за календарні періоди. Період аналізу: ${periodStr}.
5. Форматуй відповіді естетично: коротко, структуровано, виділяй жирним ключові цифри та прізвища, додавай короткий висновок або пораду керівнику.

ОПЕРАТИВНИЙ ЗРІЗ СИСТЕМИ MES CENTRUM (АКТУАЛЬНИЙ СТАН):
${liveSnapshot}`

    let cloudResult = null

    if (apiKey.startsWith('sk-')) {
      cloudResult = await callOpenAiApi(apiKey, systemPrompt, chatHistory, query)
    } else {
      cloudResult = await callGeminiApi(apiKey, systemPrompt, chatHistory, query)
    }

    if (cloudResult && cloudResult.ok) {
      return formatAiResponse(cloudResult.text, `⚡ ${cloudResult.model || 'Gemini Live AI'}`, query, operators)
    }

    // If cloud API was attempted with user key and failed, return the exact diagnostic message
    const errDetail = cloudResult?.error || 'Помилка зв\'язку з сервером AI'
    return {
      text: `⚠️ **Помилка виклику ШІ (${apiKey.startsWith('sk-') ? 'OpenAI' : 'Google Gemini'}):** ${errDetail}.\n\nБудь ласка, перевірте ваш API-ключ у налаштуваннях 🔑 або інтернет-з'єднання.`,
      badge: '⚠️ Помилка AI API',
      suggestions: [
        'Скільки карт робочих в роботі зараз?',
        'Які залишки фрез 3мм на СО?',
        'Хто найкращий оператор?',
        'Порівняй усі 4 зміни'
      ],
      isCloud: false
    }
  }

  // 2. Fallback to local deep-analysis MES processor if no key is configured
  const localResult = processGeminiQuery(query, {
    operators,
    shifts,
    history,
    nomenclatures,
    inventory,
    orders,
    machines,
    tasks,
    workCards,
    dateRange
  })

  return {
    ...localResult,
    badge: localResult.badge || '⚡ Centrum Native AI',
    isCloud: false
  }
}

function formatAiResponse(text, badge, query, operators) {
  const matchedOp = operators.find(op => {
    const parts = op.name.toLowerCase().split(/\s+/)
    return parts.some(p => p.length >= 4 && query.toLowerCase().includes(p))
  })

  return {
    text,
    badge,
    isCloud: true,
    action: matchedOp ? {
      type: 'OPEN_DOSSIER',
      operatorName: matchedOp.name,
      label: `Відкрити інтерактивне досьє ${matchedOp.name}`
    } : null,
    suggestions: [
      'Скільки карт робочих в роботі зараз?',
      'Які залишки фрез 3мм на СО?',
      'Хто найкращий оператор?',
      'Порівняй усі 4 зміни'
    ]
  }
}

function prepareDatabaseSnapshot({
  operators = [],
  shifts = [],
  inventory = [],
  orders = [],
  machines = [],
  workCards = [],
  tasks = [],
  history = []
}) {
  // 1. Active work cards currently running in the shop
  const activeCards = (workCards || []).filter(c => {
    const s = String(c.status || '').toLowerCase()
    return s === 'in_progress' || s === 'active' || s === 'running' || s === 'pending' || !s
  })

  const cardsSummary = activeCards.length > 0
    ? `Всього активних карток у роботі зараз: ${activeCards.length} шт.
Ось перелік поточних карток на верстатах:
${activeCards.slice(0, 25).map(c => `- Картка #${c.id || c.card_id}: ${c.product_name || c.nomenclature_name || 'Деталь'} (${c.quantity || c.produced_qty || 0} шт), оператор: ${c.operator_name || 'Не вказано'}, етап: ${c.operation || c.stage_name || 'Розкрій'}, верстат: ${c.machine_name || c.machine || '№?'}`).join('\n')}`
    : `Всього активних карток у роботі зараз: 0 шт (усі наряди завершені або очікують запуску).`

  // 2. Operators list
  const opsSummary = operators.slice(0, 20).map((o, idx) => {
    return `${idx + 1}. ${o.name} (${o.position}, ${o.shift}, ${o.department}): випуск=${o.producedQty} шт, швидкість=${o.unitsPerHour} шт/год, брак=${o.scrapRate}% (${o.scrapQty} шт), верстат=${o.topMachine}, простої=${o.downtimeRatio}%, ранг=${o.tierLabel || 'A'}`
  }).join('\n')

  // 3. Shifts
  const shiftsSummary = shifts.map(s => {
    return `- ${s.name}: випуск ${s.produced} шт, брак ${s.scrapRate}%, швидкість ${s.speed} шт/год, операторів: ${s.operatorsCount}`
  }).join('\n')

  // 4. Warehouse Cutters on SO & others
  const cuttersStock = (inventory || [])
    .filter(i => {
      const n = (i.name || '').toLowerCase()
      const t = (i.type || '').toLowerCase()
      return n.includes('фрез') || t.includes('cutter') || t.includes('consumable') || n.includes('кукурудз') || n.includes('зенкер')
    })
    .slice(0, 30)
    .map(c => `- ${c.name} [склад: ${c.warehouse === 'operational' ? 'СО (Оперативний)' : (c.warehouse || 'СО')}]: всього ${c.total_qty} шт, в резерві ${c.reserved_qty || 0} шт, вільно ${Math.max(0, (c.total_qty || 0) - (c.reserved_qty || 0))} шт`)
    .join('\n')

  // 5. Raw sheets stock
  const sheetsStock = (inventory || [])
    .filter(i => (i.name || '').toLowerCase().includes('лист') || (i.type || '').toLowerCase().includes('raw'))
    .slice(0, 15)
    .map(s => `- ${s.name} [склад: ${s.warehouse || 'Сировина'}]: всього ${s.total_qty} шт, вільно ${Math.max(0, (s.total_qty || 0) - (s.reserved_qty || 0))} шт`)
    .join('\n')

  // 6. Orders
  const ordersSummary = (orders || [])
    .filter(o => o.status !== 'done')
    .slice(0, 10)
    .map(o => `- Замовлення №${o.order_number || o.id}: ${o.customer || 'Клієнт'} — ${o.product_name || 'Виріб'} (${o.quantity || 0} шт), статус: ${o.status || 'в роботі'}, дедлайн: ${o.deadline || 'Поточний'}`)
    .join('\n')

  return `ЗАРАЗ У РОБОТІ В ЦЕХУ:
${cardsSummary}

ШТАТ ТА ОПЕРАТОРИ (${operators.length} осіб):
${opsSummary}

4 ВИРОБНИЧІ ЗМІНИ:
${shiftsSummary}

ЗАЛИШКИ ФРЕЗ НА СКЛАДІ СО (ОПЕРАТИВНИЙ) ТА ІНШИХ:
${cuttersStock || 'Дані по залишках фрез на складі СО'}

ЗАЛИШКИ ЛИСТОВОГО МАТЕРІАЛУ:
${sheetsStock || 'Дані по сировині'}

АКТИВНІ ЗАМОВЛЕННЯ ТА ДЕДЛАЙНИ:
${ordersSummary || 'Замовлення завантажені у виробництво'}`
}
