import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: configs } = await supabase.from('system_configs').select('*')
  console.log('system_configs:', configs)

  // Try RPC verify_user_password for admin or typical logins
  const logins = ['admin', 'roman', 'manager', 'operator', 'shop1', 'master']
  for (const l of logins) {
    const { data, error } = await supabase.from('system_users').select('*').eq('login', l)
    console.log(`User query "${l}":`, data, error)
  }
}

test()
