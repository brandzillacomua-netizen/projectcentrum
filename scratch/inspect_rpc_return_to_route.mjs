import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkRpc() {
  const { data: resolutions, error } = await supabase.from('vkya_quality_resolutions').select('*')
  console.log('resolutions error:', error)
  console.log('resolutions count:', resolutions?.length)

  // Check if there are any records in vkya_scrap_lot_allocations
  const { data: lots, error: lotErr } = await supabase.from('vkya_scrap_lot_allocations').select('*')
  console.log('lots count:', lots?.length, lotErr)
}

checkRpc().catch(console.error)
