import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('Most recent 10 material_requests:')
  console.table(reqs.map(r => ({
    id: r.id?.slice(0, 8),
    task_id: r.task_id?.slice(0, 8),
    card_id: r.card_id?.slice(0, 8),
    qty: r.quantity,
    status: r.status,
    details: r.details?.slice(0, 70),
    created_at: r.created_at
  })))
}

main().catch(console.error)
