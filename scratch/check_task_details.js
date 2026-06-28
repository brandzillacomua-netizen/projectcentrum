import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data, error } = await supabase
    .from('tasks')
    .select('plan_snapshot')
    .eq('id', '0940169f-6565-4d43-97b1-a3760fb7d3fb')
    .single()

  if (error) {
    console.error(error)
    return
  }

  console.log('plan_snapshot keys:', Object.keys(data.plan_snapshot))
  console.log('consumables:', JSON.stringify(data.plan_snapshot.consumables, null, 2))
  console.log('selectedCutters:', JSON.stringify(data.plan_snapshot.selectedCutters, null, 2))
}

main().catch(console.error)
