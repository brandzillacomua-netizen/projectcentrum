import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data, error } = await supabase.rpc('mes_fulfillment_queue', {
    p_queue: 'packaging',
    p_open_batch_limit: 300,
    p_archive_batch_limit: 60
  })

  console.log('RPC mes_fulfillment_queue error:', error)
  console.log('RPC mes_fulfillment_queue data returned count:', data ? data.length : 0)
  if (data) {
    console.log('Sample RPC data:', JSON.stringify(data.slice(0, 3), null, 2))
  }
}

run().catch(console.error)
