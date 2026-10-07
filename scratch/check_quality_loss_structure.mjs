import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' } }
})

async function inspectScrap() {
  const { data: finalScrap, error: err1 } = await supabase.from('vkya_final_scrap_totals').select('*')
  console.log('=== vkya_final_scrap_totals (Утиль) count:', finalScrap?.length, 'err:', err1?.message)
  if (finalScrap && finalScrap.length > 0) {
    console.log('Sample vkya_final_scrap_totals:', finalScrap.slice(0, 5))
  }

  const { data: scrapTotals, error: err2 } = await supabase.from('work_card_scrap_totals').select('*')
  console.log('=== work_card_scrap_totals count:', scrapTotals?.length, 'err:', err2?.message)
  if (scrapTotals && scrapTotals.length > 0) {
    console.log('Sample work_card_scrap_totals:', scrapTotals.slice(0, 5))
  }

  const { data: catRows, error: err3 } = await supabase.from('scrap_classification_categories').select('*')
  console.log('=== scrap_classification_categories count:', catRows?.length, 'err:', err3?.message)
  if (catRows && catRows.length > 0) {
    console.log('Sample categories:', catRows.slice(0, 5))
  }
}

inspectScrap().catch(console.error)
