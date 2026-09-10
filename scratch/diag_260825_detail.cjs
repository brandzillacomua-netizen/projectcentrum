const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
)

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' })

  // Fetch all requests for 260825-1
  const { data: allReqs } = await supabase
    .from('material_requests')
    .select('id, status, details, category, target_warehouse, nomenclature_id, quantity, task_id, order_id')
    .order('created_at', { ascending: true })

  const reqs = (allReqs || []).filter(r => (r.details || '').includes('260825'))
  console.log(`\nЗнайдено запитів для 260825: ${reqs.length}\n`)

  // Fetch order info
  const orderIds = [...new Set(reqs.map(r => r.order_id).filter(Boolean))]
  const { data: orders } = await supabase.from('orders').select('id, order_num, status').in('id', orderIds)
  const orderMap = Object.fromEntries((orders || []).map(o => [o.id, o]))

  // Логіка getMaterialType (копія з useWarehouseComputed.js)
  const getNomType = (nomId, noms) => noms.find(n => String(n.id) === String(nomId))?.type || null

  const { data: noms } = await supabase.from('nomenclatures').select('id, name, type').in('id', reqs.map(r => r.nomenclature_id).filter(Boolean))

  reqs.forEach(r => {
    const src    = r.details?.match(/\[PACKAGING_SOURCE:(SGP|BZ|SO)\]/)?.[1]
    const isKit  = r.details?.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ')
    const cat    = r.category
    const tw     = r.target_warehouse
    const nom    = (noms || []).find(n => String(n.id) === String(r.nomenclature_id))
    const order  = orderMap[r.order_id]

    // Симулюємо getMaterialType
    let getMat
    if (tw === 'sgp' || cat === 'hardware')                         getMat = 'finished → СГП'
    else if (tw === 'operational' || cat === 'sheet' || cat === 'cutter') getMat = '🔴 raw → СО (причина: cat або tw!)'
    else if (isKit)                                                 getMat = 'finished → СГП'
    else if (nom?.type === 'part' || nom?.type === 'product')       getMat = 'finished → СГП'
    else                                                            getMat = '🔴 raw → СО (за замовч.)'

    // Визначення чи є [PACKAGING_SOURCE]
    const srcInfo = src ? `✅ [PACKAGING_SOURCE:${src}]` : (isKit ? '⚠️  МАРКЕР ВІДСУТНІЙ!' : 'не кіттинг')

    const orderNum = order?.order_num || r.order_id
    console.log(`═══════════════════════════════════════════`)
    console.log(`Наряд: ${orderNum} | status: ${r.status}`)
    console.log(`getMaterialType → ${getMat}`)
    console.log(`Джерело:  ${srcInfo}`)
    console.log(`Ном:      ${nom?.name || '?'} (type=${nom?.type || '?'})`)
    console.log(`category: ${cat || 'null'} | target_wh: ${tw || 'null'}`)
    console.log(`details:  ${(r.details || '').substring(0, 160)}`)
  })
}

run().catch(console.error)
