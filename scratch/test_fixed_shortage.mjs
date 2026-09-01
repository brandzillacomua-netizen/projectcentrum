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

async function checkP1038Scrap() {
  const taskId = '23ceb083-47f2-4f00-9922-339318478043'
  const { data: finalScrap } = await supabase.from('vkya_final_scrap_totals').select('*').eq('task_id', taskId)
  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  const p1038Nom = nomList.find(n => n.name && n.name.includes('F415-ІП27-П-10-38'))

  const rows = finalScrap.filter(s => String(s.nomenclature_id) === String(p1038Nom.id))
  console.log('Final Scrap rows for P-10-38:', rows)
  const sumUtilt = rows.reduce((s, r) => s + (Number(r.total_scrap) || 0), 0)
  console.log('Total Utilt (Cat 4) for P-10-38:', sumUtilt)
}

checkP1038Scrap().catch(console.error)
