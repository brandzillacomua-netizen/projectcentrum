import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  console.log('Standardizing machine names for ФЕЯ...')
  const { data, error } = await supabase
    .from('machines')
    .update({ name: 'CNC KE XIN - ФЕЯ' })
    .or('type.ilike.%ФЕЯ%,name.ilike.%KEXIN%,name.ilike.%KE XIN%')
    .select('id, name, sequence_number, type')

  if (error) {
    console.error('Error updating machines:', error)
  } else {
    console.log(`Successfully updated ${data?.length} machines to "CNC KE XIN - ФЕЯ":`)
    console.table(data)
  }
}

main().catch(console.error)
