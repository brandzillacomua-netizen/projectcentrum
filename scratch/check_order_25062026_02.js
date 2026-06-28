import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: tasks } = await supabase.from('tasks').select('*, orders(order_num)').eq('orders.order_num', '25062026-02')
  
  // Filter task where orders.order_num is '25062026-02'
  const task = tasks?.find(t => t.orders?.order_num === '25062026-02' && (t.step || '').toLowerCase().includes('розкрій'))
  if (!task) {
    console.log('No cutting task found for 25062026-02!')
    return
  }

  console.log(`Found task: ID: ${task.id} | Step: "${task.step}" | Status: "${task.status}"`)

  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', task.id)
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*').in('card_id', cards.map(c => c.id))

  const snapshot = task.plan_snapshot || {}
  
  Object.keys(snapshot).forEach(nomIdStr => {
    const nom = nomenclatures.find(n => String(n.id) === String(nomIdStr))
    if (!nom || nom.type !== 'part') return
    const snap = snapshot[nomIdStr]

    const nomCards = cards.filter(c => String(c.nomenclature_id) === String(nomIdStr))
    const groupHistory = history.filter(h => h.card_id && nomCards.some(c => c.id === h.card_id))

    // SumVal calculation from ForemanWorkplace.jsx
    const qCutWait = nomCards.filter(c => c.operation === 'Розкрій' && c.status === 'new').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qCut = nomCards.filter(c => c.operation === 'Розкрій' && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qCutBuf = nomCards.filter(c => c.operation === 'Розкрій' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qGalt = nomCards.filter(c => c.operation === 'Галтовка' && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qGaltBuf = nomCards.filter(c => c.operation === 'Галтовка' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qPriyCards = nomCards.filter(c => c.operation === 'Прийомка').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qSortAct = nomCards.filter(c => c.operation === 'Сортування' && ['in-progress', 'at-buffer'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qSortCards = nomCards.filter(c => c.status === 'at-shop2-buffer').reduce((sum, c) => sum + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)
    const qMalWait = nomCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'new').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qMal = nomCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'in-progress').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qMalBuf = nomCards.filter(c => ['Фарбування', 'Малярка'].includes(c.operation) && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qPres = nomCards.filter(c => c.operation === 'Пресування' && ['new', 'in-progress'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qPresBuf = nomCards.filter(c => c.operation === 'Пресування' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qDoop = nomCards.filter(c => c.operation === 'Доопрацювання' && ['new', 'in-progress'].includes(c.status)).reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)
    const qDoopBuf = nomCards.filter(c => c.operation === 'Доопрацювання' && c.status === 'at-buffer').reduce((sum, c) => sum + (Number(c.quantity) || 0), 0)

    const qBz = 0 // let's check
    const qBzShop2 = 0
    const qSgp = 0

    const sumVal = qCutWait + qCut + qCutBuf + qGalt + qGaltBuf + qPriyCards + qSortAct + qSortCards + qMalWait + qMal + qMalBuf + qPres + qPresBuf + qDoop + qDoopBuf + qBz + qBzShop2 + qSgp
    const shortage = Math.max(0, snap.need - sumVal)

    console.log(`Part: "${nom.name}":`)
    console.log(`  need: ${snap.need}, sumVal: ${sumVal} -> shortage: ${shortage}`)
    console.log(`  Cards: total=${nomCards.length}, completed=${nomCards.filter(c=>c.status==='completed').length}, waiting-materials=${nomCards.filter(c=>c.status==='waiting-materials').length}`)
    console.log(`  Breakdown of sumVal components:`)
    console.log(`    qCutWait: ${qCutWait}, qCut: ${qCut}, qCutBuf: ${qCutBuf}`)
    console.log(`    qGalt: ${qGalt}, qGaltBuf: ${qGaltBuf}, qPriyCards: ${qPriyCards}`)
    console.log(`    qSortAct: ${qSortAct}, qSortCards: ${qSortCards}`)
    console.log(`    qMalWait: ${qMalWait}, qMal: ${qMal}, qMalBuf: ${qMalBuf}`)
    console.log(`    qPres: ${qPres}, qPresBuf: ${qPresBuf}, qDoop: ${qDoop}, qDoopBuf: ${qDoopBuf}`)
  })
}

main().catch(console.error)
