import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Rename test cutters to clear, distinct specific model names
const renames = [
  { oldId: 'd23887da-d00a-45a3-bf56-6cc9b0c8cd4b', newName: 'Фреза 6мм твердосплавна HRC55 (Тайвань)' },
  { oldId: '74f0cdca-89ee-4063-9960-612e6612ae24', newName: 'Фреза 2мм спіральна 2-західна (Німеччина)' },
  { oldId: 'b3f085a2-d2e2-4ece-905a-656e47024aab', newName: 'Фреза 3мм кукурудза (США)' }
]

for (const r of renames) {
  console.log(`Renaming nomenclature ${r.oldId} -> "${r.newName}"`)
  await supabase.from('nomenclatures').update({ name: r.newName }).eq('id', r.oldId)
  await supabase.from('inventory').update({ name: r.newName }).eq('nomenclature_id', r.oldId)
}

console.log('✅ Renamed cutters successfully!')
