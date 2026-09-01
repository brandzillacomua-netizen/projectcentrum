import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Find any material_requests containing "Тест" or "ТЕСТ" in details
const { data: reqs, error: errReq } = await supabase
  .from('material_requests')
  .select('id, details, task_id, card_id, quantity')
  .ilike('details', '%тест%')

if (!errReq && reqs && reqs.length > 0) {
  console.log(`Found ${reqs.length} test material requests:`)
  reqs.forEach(r => console.log(`- ${r.id} | ${r.details}`))
  const ids = reqs.map(r => r.id)
  await supabase.from('material_requests').delete().in('id', ids)
  console.log('✅ Deleted test material requests!')
} else {
  console.log('No test material requests found.')
}
