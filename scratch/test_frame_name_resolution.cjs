const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')

  const ordersMap = new Map()
  orders?.forEach(o => ordersMap.set(String(o.id), o))

  const nomMap = new Map()
  nomenclatures?.forEach(n => nomMap.set(String(n.id), n))

  const packagedTasks = tasks?.filter(t => t.plan_snapshot?._metadata?.is_packaged === true && t.plan_snapshot?._metadata?.is_shipped !== true)

  console.log("=== TESTING RESOLVED FRAME NAMES FOR PACKAGED TASKS ===")
  packagedTasks?.forEach(t => {
    const order = ordersMap.get(String(t.order_id))
    const meta = t.plan_snapshot?._metadata || {}

    // Priority 1: order.accessories (e.g. "Рама (інд.проект 27), F415, Київ К")
    let frameName = order?.accessories || ''

    // Priority 2: order.nomenclature_id (parent nomenclature name)
    if (!frameName && order?.nomenclature_id) {
      frameName = nomMap.get(String(order.nomenclature_id))?.name || ''
    }

    // Priority 3: order.order_items finished/assembly nomenclature
    if (!frameName && order?.order_items) {
      const finishedItem = order.order_items.map(it => nomMap.get(String(it.nomenclature_id))).find(n => n && (n.type === 'finished' || n.type === 'assembly' || (n.name || '').includes('Рама')))
      if (finishedItem) frameName = finishedItem.name
    }

    // Priority 4: plan_snapshot metadata frame_name or product_name
    if (!frameName && meta.frame_name) frameName = meta.frame_name
    if (!frameName && meta.product_name) frameName = meta.product_name

    // Priority 5: Fallback to part names summary if no parent frame found
    if (!frameName && t.plan_snapshot) {
      const partNames = Object.values(t.plan_snapshot)
        .filter(s => s && typeof s === 'object' && s.id && !String(s.id).startsWith('_'))
        .map(s => nomMap.get(String(s?.id))?.name || s?.name)
        .filter(Boolean)

      if (partNames.length > 0) {
        // e.g. "RND-87-Drozd 9"-Низ-3-26" -> "Рама Drozd 9"" or "F415"
        const first = partNames[0]
        if (first.includes('Drozd')) frameName = 'Рама Drozd 9"'
        else if (first.includes('F415') || first.includes('ІП27')) frameName = 'Рама F415 (інд.проект 27)'
        else if (first.includes('KHARAK') || first.includes('KR-')) frameName = 'Рама KHARAK'
        else frameName = partNames.join(', ')
      }
    }

    console.log(`Task ${t.id.slice(-8)} | Order ${order?.order_num || '—'} | Customer: ${order?.customer || '—'} | FrameName: "${frameName || 'Деталі рами'}"`)
  })
}

run()
