import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function check() {
  const { data: testSheets } = await supabase
    .from('nomenclatures')
    .select('id, name, type, unit, material_type')
    .ilike('name', '%Тест-Лист%')

  console.log('Test sheet nomenclatures in DB:')
  console.table(testSheets)

  const { data: inv } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, total_qty, warehouse')
    .in('nomenclature_id', testSheets.map(s => s.id))

  console.log('Inventory entries for test sheets:')
  console.table(inv)
}

check()
