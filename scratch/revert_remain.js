import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log("Reverting remaining two items...")
  
  await supabase.from('inventory').update({
    name: "ІП-72-F5-Х-5-63 (Лист T300 (2мм))",
    nomenclature_id: "34a86bc0-fb04-4853-bd00-b068fcbc3a50"
  }).eq('id', '148ba38c-3d1d-4a6e-844e-e1fb0f9a2df2')

  await supabase.from('inventory').update({
    name: "ІП-72-F5-В-3-45 (Лист T300 (3мм))",
    nomenclature_id: "43a60844-3e54-448d-8d67-7658a040dc0a"
  }).eq('id', '258eef07-1f38-487d-9f90-3c2d5e52199c')

  console.log("Reversion complete.")
}

run()
