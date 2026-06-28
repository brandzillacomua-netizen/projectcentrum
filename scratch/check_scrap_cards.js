import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const cardIds = [
    'faf610a7-61bb-4947-a2a0-9cafa7ea6edc',
    '1fbd1792-9b3d-48d4-bc0f-c7fd1c091a29',
    '0d15a9c2-d7c4-4ab4-9a2e-eb9367564c47',
    'f374eeb0-3e34-4651-97db-f8c20420fd42'
  ]
  const { data: cards } = await supabase.from('work_cards').select('*, tasks(id, step)').in('id', cardIds)
  console.log('Scrap Cards details:')
  cards?.forEach(c => {
    console.log(`- Card ID: ${c.id} | Status: "${c.status}" | Task ID: ${c.task_id} | Task Step: "${c.tasks?.step}" | Nomenclature: ${c.nomenclature_id}`)
  })
}

main().catch(console.error)
