const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderNum = '04072026-01'

const asNum = value => Number(value) || 0
const fmtTime = value => value ? new Date(value).toISOString() : '-'
const parseInfo = (info = '') => ({
  seq: info.match(/(?:^|\s)(\d+)\s*\/\s*(\d+)/)?.[1] || '',
  total: info.match(/(?:^|\s)(\d+)\s*\/\s*(\d+)/)?.[2] || '',
  need: asNum(info.match(/\[NEED:(-?\d+)\]/)?.[1]),
  req: asNum(info.match(/\[REQ:(-?\d+)\]/)?.[1]),
  bz: asNum(info.match(/\[BZ:(-?\d+)\]/)?.[1]),
  redo: info.includes('[REDO]')
})

async function main() {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id,order_num,customer,quantity,nomenclature_id')
    .eq('order_num', orderNum)
    .limit(1)
  if (orderError) throw orderError
  const order = orders?.[0]
  if (!order) throw new Error(`Order ${orderNum} not found`)

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id,order_id,step,status,machine_name,batch_index,created_at,completed_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  if (taskError) throw taskError
  const taskIds = (tasks || []).map(task => task.id)
  if (taskIds.length === 0) throw new Error(`No tasks for order ${orderNum}`)

  const { data: cards, error: cardError } = await supabase
    .from('work_cards')
    .select('id,task_id,order_id,nomenclature_id,quantity,status,operation,machine,card_info,is_rework,created_at,estimated_time')
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (cardError) throw cardError

  const redoCards = (cards || [])
    .filter(card => card.is_rework || String(card.card_info || '').includes('[REDO]'))
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

  const lastTime = redoCards[0]?.created_at
  const lastMs = lastTime ? new Date(lastTime).getTime() : 0
  const lastGroup = redoCards.filter(card => Math.abs(lastMs - new Date(card.created_at || 0).getTime()) <= 10 * 60 * 1000)

  const nomIds = [...new Set([
    ...lastGroup.map(card => card.nomenclature_id),
    ...redoCards.slice(0, 30).map(card => card.nomenclature_id)
  ].filter(Boolean))]

  const { data: noms, error: nomError } = nomIds.length
    ? await supabase.from('nomenclatures').select('id,name,type,units_per_sheet').in('id', nomIds)
    : { data: [], error: null }
  if (nomError) throw nomError
  const nomById = new Map((noms || []).map(nom => [String(nom.id), nom]))

  const { data: requests, error: requestError } = await supabase
    .from('material_requests')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(300)
  if (requestError) throw requestError

  const lastCardIds = new Set(lastGroup.map(card => String(card.id)))
  const lastRequestRows = (requests || []).filter(req => {
    if (req.card_id && lastCardIds.has(String(req.card_id))) return true
    if (!req.created_at || !lastTime) return false
    const diff = Math.abs(new Date(req.created_at).getTime() - lastMs)
    const text = String(req.details || '').toLowerCase()
    return diff <= 15 * 60 * 1000 && (text.includes('дов') || text.includes('доз') || text.includes('dovy') || text.includes('бра') || text.includes('нест'))
  })

  console.log(`ORDER ${order.order_num} | ${order.customer || '-'} | id=${order.id}`)
  console.log(`Tasks: ${tasks.length}`)
  tasks.forEach(task => console.log(`  ${task.id} | ${task.step} | ${task.status} | ${task.machine_name || '-'} | ${fmtTime(task.created_at)}`))
  console.log(`\nAll REDO cards in order: ${redoCards.length}`)
  console.log(`Last REDO created_at: ${fmtTime(lastTime)}`)
  console.log(`Last REDO group (+/-10m): ${lastGroup.length}`)

  console.log('\nLAST REDO CARDS')
  lastGroup
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    .forEach(card => {
      const parsed = parseInfo(card.card_info)
      const nom = nomById.get(String(card.nomenclature_id))
      const zeroFlags = []
      if (asNum(card.quantity) <= 0) zeroFlags.push('ZERO_QUANTITY')
      if (parsed.req <= 0) zeroFlags.push('REQ_0')
      if (parsed.need <= 0) zeroFlags.push('NEED_0')
      console.log([
        `  ${fmtTime(card.created_at)}`,
        `id=${card.id}`,
        `seq=${parsed.seq}/${parsed.total}`,
        `qty=${asNum(card.quantity)}`,
        `REQ=${parsed.req}`,
        `BZ=${parsed.bz}`,
        `NEED=${parsed.need}`,
        `status=${card.status}`,
        `machine=${card.machine || '-'}`,
        `nom=${nom?.name || card.nomenclature_id}`,
        zeroFlags.length ? `FLAGS=${zeroFlags.join(',')}` : ''
      ].filter(Boolean).join(' | '))
      console.log(`    info=${card.card_info || ''}`)
    })

  console.log('\nREQUESTS LINKED TO LAST REDO')
  if (lastRequestRows.length === 0) {
    console.log('  No linked/time-near material_requests found')
  } else {
    lastRequestRows
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      .forEach(req => {
        const nom = nomById.get(String(req.nomenclature_id))
        console.log([
          `  ${fmtTime(req.created_at)}`,
          `id=${req.id}`,
          `card_id=${req.card_id || '-'}`,
          `qty=${asNum(req.quantity)}`,
          `status=${req.status}`,
          `nom=${nom?.name || req.nomenclature_id || '-'}`,
          `details=${req.details || ''}`
        ].join(' | '))
      })
  }

  console.log('\nRECENT REDO GROUPS')
  const groups = []
  for (const card of redoCards.slice(0, 60)) {
    const time = new Date(card.created_at || 0).getTime()
    const existing = groups.find(group => Math.abs(group.time - time) <= 10 * 60 * 1000)
    if (existing) existing.cards.push(card)
    else groups.push({ time, cards: [card] })
  }
  groups.slice(0, 8).forEach((group, index) => {
    const byNom = {}
    group.cards.forEach(card => {
      const nom = nomById.get(String(card.nomenclature_id))
      const key = nom?.name || card.nomenclature_id || 'unknown'
      if (!byNom[key]) byNom[key] = { cards: 0, qty: 0, req: 0 }
      const parsed = parseInfo(card.card_info)
      byNom[key].cards += 1
      byNom[key].qty += asNum(card.quantity)
      byNom[key].req += parsed.req
    })
    console.log(`  #${index + 1} ${fmtTime(group.cards[0]?.created_at)} cards=${group.cards.length}`)
    Object.entries(byNom).forEach(([name, stat]) => {
      console.log(`     ${name}: cards=${stat.cards}, qty=${stat.qty}, req=${stat.req}`)
    })
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
