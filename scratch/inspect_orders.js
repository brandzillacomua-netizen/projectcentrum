import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: orders } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(20)
  
  console.log("Recent 20 orders:")
  for (const o of orders) {
    let nomName = "N/A"
    if (o.nomenclature_id) {
      const { data: nom } = await supabase.from('nomenclatures').select('name').eq('id', o.nomenclature_id).maybeSingle()
      nomName = nom ? nom.name : "NOT FOUND IN DB"
    }
    console.log(`- ID: ${o.id}\n  Order Num: ${o.order_num}\n  Product Name in order (accessories): "${o.accessories}"\n  Linked Nom ID: ${o.nomenclature_id} ("${nomName}")\n  Status: ${o.status}\n  Created At: ${o.created_at}`)
  }
}

run()
