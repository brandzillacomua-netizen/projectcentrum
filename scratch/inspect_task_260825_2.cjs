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
  console.log("=== INSPECTING TASK 260825-2 ===")

  // Find order
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_num')
    .ilike('order_num', '%260825-2%')
    .maybeSingle()

  console.log("Order found:", order)

  const { data: allTasks } = await supabase.from('tasks').select('*').eq('order_id', order.id)
  console.log("Tasks found for order:", allTasks?.map(t => ({ id: t.id, status: t.status, step: t.step })))
  task = allTasks?.[0]

  console.log("Task found:", task?.id, task?.planned_sets, task?.status)
  console.log("Plan snapshot keys:", Object.keys(task?.plan_snapshot || {}))

  if (task) {
    const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', task.id)
    console.log(`Work cards count: ${cards?.length}`)

    // Group cards by nomenclature_id
    const byNom = {}
    cards.forEach(c => {
      if (!byNom[c.nomenclature_id]) byNom[c.nomenclature_id] = []
      byNom[c.nomenclature_id].push(c)
    })

    for (const [nomId, nomCards] of Object.entries(byNom)) {
      const { data: nom } = await supabase.from('nomenclatures').select('name, units_per_sheet').eq('id', nomId).maybeSingle()
      console.log(`\n--- Part: ${nom?.name} (ID: ${nomId}) ---`)
      console.log(`Units per sheet: ${nom?.units_per_sheet}`)
      const snap = task.plan_snapshot?.[nomId] || {}
      console.log("Snapshot:", snap)

      nomCards.forEach(c => {
        console.log(`  Card #${c.id.slice(-8)} | op: ${c.operation} | status: ${c.status} | card_info: ${c.card_info} | qty: ${c.quantity} | actual_sheets: ${c.actual_sheets} | is_rework: ${c.is_rework}`)
      })
    }

    // Inspect history / scrap for this task
    const cardIds = cards.map(c => c.id)
    const { data: history } = await supabase.from('work_card_history').select('*').in('card_id', cardIds)
    console.log(`\nHistory rows count: ${history?.length}`)
    const scrapHistory = history?.filter(h => Number(h.scrap_qty) > 0 || Number(h.scrap) > 0)
    console.log("Scrap history entries:", scrapHistory)
  }
}

run()
