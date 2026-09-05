import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' }
  }
})

async function main() {
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', '3f02455f-e512-44de-b2bb-4251b05d6556')
    .single()

  console.log('Task plan_snapshot keys:', Object.keys(task.plan_snapshot || {}))
  for (const [k, v] of Object.entries(task.plan_snapshot || {})) {
    if (k !== 'selectedCutters' && k !== 'cuttersSelectionDetails') {
      console.log(`\nKey: ${k}`, JSON.stringify(v, null, 2))
    }
  }

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, card_info, nomenclature_id, quantity, status, operation, machine')
    .eq('task_id', task.id)
  
  const nomMap = {}
  for (const c of cards) {
    nomMap[c.nomenclature_id] = (nomMap[c.nomenclature_id] || 0) + 1
  }
  console.log('\nNom map in cards:', nomMap)

  for (const nomId of Object.keys(nomMap)) {
    const { data: nom } = await supabase
      .from('nomenclatures')
      .select('*')
      .eq('id', nomId)
      .maybeSingle()
    console.log(`Nom ${nomId}:`, nom ? `${nom.name} | type: ${nom.type} | mat: ${nom.material_type} | code: ${nom.nomenclature_code}` : 'NOT FOUND IN NOMENCLATURES TABLE!')
  }
}

main().catch(console.error)
