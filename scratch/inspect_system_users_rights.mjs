import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  const { data, error } = await supabase
    .from('system_users')
    .select('id, login, first_name, last_name, position, access_rights')
    .order('login')

  if (error) {
    console.error('Error fetching system_users:', error)
    return
  }

  console.log(`Found ${data.length} users:`)
  data.forEach(u => {
    console.log(`- ID: ${u.id} | Login: "${u.login}" | Position: "${u.position}" | Rights:`, JSON.stringify(u.access_rights))
  })
}

inspect()
