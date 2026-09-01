import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = '99190e0a-91b0-4a44-ab5e-b1a1ec393ffe'
  console.log('Checking material_requests for task:', taskId)

  const { data: reqs, error } = await supabase
    .from('material_requests')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching material_requests:', error)
  } else {
    console.log(`Found ${reqs?.length || 0} material_requests:`)
    console.table(reqs.map(r => ({
      id: r.id?.slice(0, 8),
      card_id: r.card_id?.slice(0, 8),
      nomenclature_id: r.nomenclature_id?.slice(0, 8),
      qty: r.quantity,
      status: r.status,
      details: r.details,
      created_at: r.created_at
    })))
  }
}

main().catch(console.error)
