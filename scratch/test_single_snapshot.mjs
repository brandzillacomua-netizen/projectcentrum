import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))

  const ord = orders.find(o => String(o.order_num) === '260827-2')
  console.log(`Order 260827-2 id: ${ord?.id}`)

  const matchedTasks = tasks.filter(t => String(t.order_id) === String(ord.id) && t.plan_snapshot)
  console.log(`Matched tasks for 260827-2: ${matchedTasks.length}`)

  const snap = matchedTasks[0]?.plan_snapshot
  if (snap && typeof snap === 'object') {
    Object.keys(snap).forEach(k => {
      if (!k.startsWith('_') && snap[k]) {
        const nom = nomMap.get(k)
        console.log(`  Part: ${nom?.name} | need: ${snap[k].need} | stock: ${snap[k].stock}`)
      }
    })
  }
}

run().catch(console.error)
