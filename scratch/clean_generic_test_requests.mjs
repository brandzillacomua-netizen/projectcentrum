import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Find material requests with generic names like 'Фреза ф2' or 'Фреза ф6'
const { data: reqs } = await supabase
  .from('material_requests')
  .select('id, details')
  .or('details.ilike.%Фреза ф2%,details.ilike.%Фреза ф6%')

if (reqs && reqs.length > 0) {
  console.log(`Found ${reqs.length} generic material requests to clean:`)
  reqs.forEach(r => console.log(`- ${r.id} | ${r.details}`))
  const ids = reqs.map(r => r.id)
  await supabase.from('material_requests').delete().in('id', ids)
  console.log('✅ Cleaned generic test material requests!')
} else {
  console.log('No generic test material requests found.')
}
