import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkTasks() {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, order_id, status, step, batch_index, warehouse_conf, engineer_conf, director_conf, plan_snapshot')
    .in('status', ['in-progress', 'active', 'new', 'completed'])
    .limit(500)

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_num, status')

  const orderMap = new Map((orders || []).map(o => [o.id, o]))

  console.log('=== Всі активні/завершені наряди ===')
  const shop1Filter = (t) => {
    const stepName = (t.step || '').toLowerCase()
    const isLaser = stepName.includes('розкрій') || stepName.includes('різка')
    return (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser
  }

  const packagingFilter = (t) => {
    if (t.plan_snapshot?._metadata?.is_packaged === true) return false
    return t.status === 'in-progress' || t.status === 'completed' || t.status === 'active' || t.status === 'new'
  }

  const inPackaging = (tasks || []).filter(packagingFilter)
  const inShop1 = (tasks || []).filter(shop1Filter)

  console.log(`У Пакуванні: ${inPackaging.length} нарядів`)
  console.log(`В Цеху 1: ${inShop1.length} нарядів`)

  console.log('\n=== Наряди, які Є в Пакуванні, але НЕМАЄ в Цеху 1: ===')
  inPackaging.forEach(t => {
    const isShop1 = shop1Filter(t)
    if (!isShop1) {
      const order = orderMap.get(t.order_id)
      console.log(`- Order: ${order?.order_num || t.order_id} | Batch: ${t.batch_index || '1'} | Step: "${t.step}" | Status: ${t.status} | Conf (W/E/D): ${t.warehouse_conf}/${t.engineer_conf}/${t.director_conf}`)
    }
  })
}

checkTasks().catch(console.error)
