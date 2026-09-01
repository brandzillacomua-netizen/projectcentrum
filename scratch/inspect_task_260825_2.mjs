import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function checkScrapVsVkya() {
  const taskId = '23ceb083-47f2-4f00-9922-339318478043'
  
  const { data: rawScrap } = await supabase.from('work_card_scrap_totals').select('*').eq('task_id', taskId)
  console.log('RAW WORK_CARD_SCRAP_TOTALS (detected at terminals):', rawScrap)

  const { data: finalScrap } = await supabase.from('vkya_final_scrap_totals').select('*').eq('task_id', taskId)
  console.log('FINAL SCRAP (Category 4 = Утиль):', finalScrap)
}

checkScrapVsVkya().catch(console.error)
