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
  console.log("=== INSPECTING PACKAGED TASKS & ORDERS FOR LOGISTICS ===")
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: boxes } = await supabase.from('packaging_boxes').select('*')

  const ordersMap = new Map()
  orders?.forEach(o => ordersMap.set(String(o.id), o))

  const nomMap = new Map()
  nomenclatures?.forEach(n => nomMap.set(String(n.id), n))

  const packagedTasks = tasks?.filter(t => t.plan_snapshot?._metadata?.is_packaged === true && t.plan_snapshot?._metadata?.is_shipped !== true)

  console.log(`Total packaged tasks ready for shipping: ${packagedTasks?.length}`)

  packagedTasks?.forEach(t => {
    const order = ordersMap.get(String(t.order_id))
    const meta = t.plan_snapshot?._metadata || {}
    let productNames = order?.order_items?.map(it => nomMap.get(String(it.nomenclature_id))?.name).filter(Boolean).join(', ')
    if (!productNames && t.plan_snapshot) {
      productNames = Object.values(t.plan_snapshot)
        .map(s => nomMap.get(String(s?.id))?.name || s?.name)
        .filter(Boolean)
        .join(', ')
    }

    const taskBoxes = boxes?.filter(b => String(b.order_id) === String(t.order_id) && String(b.batch_index) === String(t.batch_index || '1'))
    const boxNumbers = new Set(taskBoxes?.map(b => b.box_number))

    console.log(`Task ${t.id.slice(-8)} | Order ${order?.order_num || meta.order_num || '???'} | Customer: ${order?.customer || meta.customer || '—'} | Frame: ${productNames || '—'} | Sets: ${t.planned_sets || meta.planned_sets || '—'} | Boxes: ${boxNumbers.size}`)
  })
}

run()
