import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const f610 = 'ab44ab2a-51ed-4955-a290-39fe2df232ea'
  const f613 = '815f422e-336c-40bb-8507-d3a6c8bbd600'
  
  const { data: boms } = await supabase.from('bom_items').select('*').in('parent_id', [f610, f613])
  console.log('BOM items:', JSON.stringify(boms, null, 2))
}

run()
