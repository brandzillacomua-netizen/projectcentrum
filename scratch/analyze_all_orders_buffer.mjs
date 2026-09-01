import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function analyzeAllOrdersBuffer() {
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, nomenclature_code')

  const nomMap = new Map(noms?.map(n => [n.id, n]) || [])
  const orderMap = new Map(orders?.map(o => [o.id, o]) || [])

  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  // Group cards by Order
  const orderAnalysis = {}

  let globalRawQty = 0
  let globalUsedQty = 0
  let globalFreeQty = 0

  workCards?.forEach(card => {
    const isShop2Card = shop2TaskIds.has(String(card.task_id)) || card.card_info?.includes('[SHOP:2]')
    if (isShop2Card) return // Skip cards created IN Shop 2

    // Check if card came to Shop 2 Buffer (Route 1: at-shop2-buffer OR Route 2: is_rework / [REDO])
    const isBufferCard = card.status === 'at-shop2-buffer' || card.is_rework || card.card_info?.includes('[REDO]')
    if (!isBufferCard) return

    const orderId = card.order_id || 'no-order'
    const orderObj = orderMap.get(orderId)
    const orderNum = orderObj?.order_num || (orderId !== 'no-order' ? `Наряд №${orderId.substring(0,8)}` : 'Без наряду')

    if (!orderAnalysis[orderId]) {
      orderAnalysis[orderId] = {
        orderId,
        orderNum,
        status: orderObj?.status || 'unknown',
        cardsCount: 0,
        rawQty: 0,
        usedQty: 0,
        freeQty: 0,
        items: []
      }
    }

    const qty = Number(card.quantity || 0)
    const used = Number(card.used_in_shop2_qty || 0)
    const free = Math.max(0, qty - used)

    orderAnalysis[orderId].cardsCount++
    orderAnalysis[orderId].rawQty += qty
    orderAnalysis[orderId].usedQty += used
    orderAnalysis[orderId].freeQty += free

    globalRawQty += qty
    globalUsedQty += used
    globalFreeQty += free

    const nom = nomMap.get(card.nomenclature_id)
    orderAnalysis[orderId].items.push({
      cardId: card.id,
      nomName: nom?.name || card.name || 'Деталь',
      nomCode: nom?.nomenclature_code || '',
      qty,
      used,
      free,
      status: card.status,
      isRework: !!card.is_rework
    })
  })

  console.log('===========================================================')
  console.log('         ПОВНИЙ АНАЛІЗ БУФЕРА ЦЕХУ №2 ПО НАРЯДАХ           ')
  console.log('===========================================================')
  console.log(`Загальна кількість нарядів з деталями в буфері: ${Object.keys(orderAnalysis).length}`)
  console.log(`Загальна кількість заготовок, що надійшли (Розкрій + ВКЯ): ${globalRawQty} шт`)
  console.log(`Загальна кількість, під яку ВЖЕ створено РК Цеху №2: ${globalUsedQty} шт`)
  console.log(`ВІЛЬНІ ДЕТАЛІ ДЛЯ СТВОРЕННЯ НОВИХ РК (ІСТИНА): ${globalFreeQty} шт`)
  console.log('-----------------------------------------------------------\n')

  Object.values(orderAnalysis).forEach(ord => {
    console.log(`📌 Наряд: ${ord.orderNum} (Статус: ${ord.status})`)
    console.log(`   Картки: ${ord.cardsCount} шт | Надійшло: ${ord.rawQty} шт | Створено РК: ${ord.usedQty} шт | ВІЛЬНО: ${ord.freeQty} шт`)
    ord.items.forEach(it => {
      console.log(`   - ${it.nomName} [${it.nomCode}]: Надійшло ${it.qty} шт -> Використано ${it.used} шт -> ВІЛЬНО ${it.free} шт (Статус: ${it.status}${it.isRework ? ', РЕВОРК' : ''})`)
    })
    console.log('')
  })
}

analyzeAllOrdersBuffer().catch(console.error)
