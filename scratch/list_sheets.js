import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJleHAiOjIwODk5NTMzNjJ9.sE4wWof8JtWjV4W4-m-y6K-m6HhM_S8A0F2nBszXn6s'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkNoms() {
  const { data } = await supabase.from('nomenclatures').select('name, material_type, type')
    .ilike('name', '%Лист%')
  console.log(data)
}
checkNoms()
