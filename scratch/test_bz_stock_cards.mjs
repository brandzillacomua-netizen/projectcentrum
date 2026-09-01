import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))

  console.log(`Cards with operation 'Склад БЗ':`)
  const bzCards = cards.filter(c => String(c.operation || '').toLowerCase().includes('склад бз') || String(c.operation || '').toLowerCase().includes('склад bz'))
  console.log(`Found ${bzCards.length} BZ cards`)

  bzCards.slice(0, 15).forEach(c => {
    const nom = nomMap.get(c.nomenclature_id)
    console.log(`  Card ${c.id.slice(-8)} | nom: ${nom?.name} | op: ${c.operation} | status: ${c.status} | qty: ${c.quantity} | task_id: ${c.task_id?.slice(-8)}`)
  })

  console.log(`\nChecking plan_snapshot stock in tasks:`)
  tasks.filter(t => t.plan_snapshot).slice(0, 10).forEach(t => {
    const snap = t.plan_snapshot
    if (snap && typeof snap === 'object') {
      Object.keys(snap).forEach(k => {
        if (!k.startsWith('_') && snap[k]?.stock > 0) {
          const nom = nomMap.get(k)
          console.log(`  Task ${t.id.slice(-8)} (order ${t.order_id?.slice(-8)}) | nom: ${nom?.name} | stock: ${snap[k].stock} | need: ${snap[k].need}`)
        }
      })
    }
  })
}

run().catch(console.error)
