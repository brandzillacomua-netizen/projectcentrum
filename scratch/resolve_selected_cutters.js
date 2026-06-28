import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const selectedCutters = {
    "Фреза ф2": "0f8982c4-7640-4d93-9681-1403a4527a4a",
    "Фреза ф3": "0cb9d039-ae7c-4004-b408-ffd22b083510",
    "Фреза ф1.5": "ee9b97d2-64d8-4f41-85b2-60a37804fdd3",
    "Фреза ф6 (90)": "32d045cb-8004-4698-9fa3-00ccaa6217da"
  }

  for (const [generic, invId] of Object.entries(selectedCutters)) {
    const { data: inv } = await supabase.from('inventory').select('*').eq('id', invId).single()
    if (inv) {
      const { data: nom } = await supabase.from('nomenclatures').select('*').eq('id', inv.nomenclature_id).single()
      console.log(`Generic: "${generic}" -> Inventory ID: ${invId} -> Specific Name: "${nom?.name}" (ID: ${nom?.id})`)
    } else {
      console.log(`Generic: "${generic}" -> Inventory ID: ${invId} NOT FOUND in inventory!`)
    }
  }
}

main().catch(console.error)
