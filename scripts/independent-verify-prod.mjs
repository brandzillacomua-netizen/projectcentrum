import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Автоматичне завантаження з .env без захардкоджених паролів у коді
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (match) {
      const key = match[1]
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  })
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

const email = process.env.AUDIT_EMAIL || process.env.TEST_USER_EMAIL
const password = process.env.AUDIT_PASSWORD || process.env.TEST_USER_PASSWORD

if (!SUPABASE_URL || !SUPABASE_KEY || !email || !password) {
  throw new Error('❌ [ENV ERROR]: AUDIT_EMAIL, AUDIT_PASSWORD, VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY є обов\'язковими в .env!')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function inspectProdDatabase() {
  console.log('====================================================================')
  console.log('🔍 [НЕЗАЛЕЖНИЙ АУДИТ PROD БД]: Окремий ізольований процес перевірки')
  console.log('====================================================================\n')

  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
  if (authErr) {
    throw new Error(`Помилка авторизації аудитора: ${authErr.message}`)
  }

  // 1. Пошук карток з текстом тестових запустів
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, card_info, created_at, status')
    .or('card_info.ilike.%РАМА F10%,card_info.ilike.%ДЕТАЛЬ 2 (БРАК)%,card_info.ilike.%ДОВИПУСК БРАКУ%')

  console.log(`🎴 Пошук карток 'РАМА F10 / ДЕТАЛЬ 2 (БРАК) / ДОВИПУСК': ${cards?.length || 0} шт`)
  if (cards && cards.length > 0) {
    cards.forEach(c => console.log(`   - Card ID: ${c.id} | Info: ${c.card_info} | Status: ${c.status}`))
  }

  // 2. Пошук тестових замовлень
  const { data: testOrders } = await supabase
    .from('orders')
    .select('id, order_num, created_at, customer')
    .ilike('order_num', '%TEST-ORD%')

  console.log(`\n📦 Пошук тестових замовлень 'TEST-ORD%': ${testOrders?.length || 0} шт`)
  if (testOrders && testOrders.length > 0) {
    testOrders.forEach(o => console.log(`   - Order ID: ${o.id} | Num: ${o.order_num} | Customer: ${o.customer}`))
  }

  // 3. Звірка складських записів за реальними ID
  const { data: sheetRow } = await supabase
    .from('inventory')
    .select('id, name, total_qty, reserved_qty')
    .eq('id', 'cbd0a211-4f61-4a45-9a16-2953014625ac')
    .single()

  const { data: cutterRow } = await supabase
    .from('inventory')
    .select('id, name, total_qty, reserved_qty')
    .eq('id', 'fc8f5e59-ec11-40d5-8a27-2b318c12e450')
    .single()

  console.log(`\n📊 Перевірка залишків складських записів за ID в БД:`)
  console.log(`   - Складський Лист [${sheetRow?.name}] (ID: ${sheetRow?.id}): Total = ${sheetRow?.total_qty}, Reserved = ${sheetRow?.reserved_qty}`)
  console.log(`   - Складська Фреза [${cutterRow?.name}] (ID: ${cutterRow?.id}): Total = ${cutterRow?.total_qty}, Reserved = ${cutterRow?.reserved_qty}`)

  console.log('\n====================================================================')
  if ((cards?.length || 0) === 0 && (testOrders?.length || 0) === 0) {
    console.log('✨ [НЕЗАЛЕЖНИЙ ВИСНОВОК]: PROD БД ПОВНІСТЮ ЧИСТА! 0 СИРІТСЬКИХ ТЕСТОВИХ ЗАПИСІВ.')
  } else {
    console.log('⚠️ [УВАГА]: Виявлено тестові записи, які потребують очищення!')
  }
  console.log('====================================================================\n')
}

inspectProdDatabase()
