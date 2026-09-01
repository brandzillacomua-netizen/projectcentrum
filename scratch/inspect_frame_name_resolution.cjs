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
  console.log("=== INSPECTING PARENT FRAME NAMES FOR ORDERS & TASKS ===")
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: boms } = await supabase.from('bom_items').select('*')

  const ordersMap = new Map()
  orders?.forEach(o => ordersMap.set(String(o.id), o))

  const nomMap = new Map()
  nomenclatures?.forEach(n => nomMap.set(String(n.id), n))

  const packagedTasks = tasks?.filter(t => t.plan_snapshot?._metadata?.is_packaged === true && t.plan_snapshot?._metadata?.is_shipped !== true)

  packagedTasks?.forEach(t => {
    const order = ordersMap.get(String(t.order_id))
    const meta = t.plan_snapshot?._metadata || {}

    // Method A: Order items where nomenclature is a finished frame / assembly or product name
    const orderItemNoms = (order?.order_items || []).map(it => nomMap.get(String(it.nomenclature_id))).filter(Boolean)
    const finishedFrames = orderItemNoms.filter(n => n.type === 'finished' || n.type === 'assembly' || (n.name || '').includes('Рама'))

    // Method B: Find parent nomenclature from BOM if order_items contain child parts
    const childNomIds = (order?.order_items || []).map(it => String(it.nomenclature_id))
    const parentBomItems = boms?.filter(b => childNomIds.includes(String(b.child_id)))
    const parentNoms = parentBomItems?.map(b => nomMap.get(String(b.parent_id))).filter(Boolean)

    // Method C: Extract common prefix or frame title from child parts if no parent assembly
    let derivedFrameName = ''
    if (finishedFrames.length > 0) {
      derivedFrameName = finishedFrames.map(f => f.name).join(', ')
    } else if (parentNoms && parentNoms.length > 0) {
      derivedFrameName = Array.from(new Set(parentNoms.map(p => p.name))).join(', ')
    } else {
      // Fallback: parse part prefix (e.g. F415 or Drozd 9" or RND-87)
      const partNames = orderItemNoms.map(n => n.name)
      if (partNames.length > 0) {
        // e.g. "RND-87-Drozd 9"-Низ..." -> "Drozd 9"" or "F415"
        const sample = partNames[0]
        if (sample.includes('Drozd')) derivedFrameName = 'Рама Drozd 9"'
        else if (sample.startsWith('F415')) derivedFrameName = 'Рама F415'
        else derivedFrameName = sample.split('-')[0] + ' ' + (sample.split('-')[1] || '')
      }
    }

    console.log(`Order: ${order?.order_num || t.id.slice(0, 8)} | OrderCustomer: ${order?.customer} | FrameName: "${derivedFrameName || '—'}"`)
  })
}

run()
