import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('id, name')
    .ilike('name', '%Тест-Деталь В3%')

  console.log('Nomenclatures matching Тест-Деталь В3:', noms)

  if (noms && noms.length > 0) {
    const ids = noms.map(n => n.id)
    const { data: ops } = await supabase
      .from('machine_operations')
      .select('*')
      .in('nomenclature_id', ids)

    console.log('Machine operations for Тест-Деталь В3:', JSON.stringify(ops, null, 2))
  }
}

main().catch(console.error)
