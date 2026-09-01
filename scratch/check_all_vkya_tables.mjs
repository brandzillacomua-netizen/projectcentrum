import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkAllVkyaTables() {
  // Check work_card_history status field - do cards have an "on-hold" or VKYA status?
  const { data: vfst } = await supabase.from('vkya_final_scrap_totals').select('*')
  console.log('=== vkya_final_scrap_totals ===', vfst?.length, 'rows')
  vfst?.forEach(r => console.log(JSON.stringify(r)))

  // Check scrap_classifications - the real place quarantine records live
  const { data: sc, error: sce } = await supabase.from('scrap_classifications').select('*')
  console.log('\n=== scrap_classifications ===', sc?.length, 'rows', sce?.message || '')
  sc?.slice(0, 5).forEach(r => console.log(JSON.stringify(r)))

  // Check work_card_history for records with status at-vkya or quality-hold 
  const { data: hist } = await supabase.from('work_card_history').select('id,card_id,nomenclature_id,scrap_qty,stage_name,is_archived_scrap,task_id').gt('scrap_qty', 0)
  console.log('\n=== All non-zero scrap history ===', hist?.length, 'rows')
  hist?.forEach(r => console.log(JSON.stringify(r)))
}

checkAllVkyaTables().catch(console.error)
