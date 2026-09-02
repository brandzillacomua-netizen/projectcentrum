import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testRPC() {
  console.log('Testing RPC verify_user_password...')
  const passwords = ['admin', '123456', '1234', 'admin123', 'root', '0000']
  for (const p of passwords) {
    const { data, error } = await supabase.rpc('verify_user_password', {
      login_name: 'admin',
      plain_password: p
    })
    console.log(`RPC login "admin" pass "${p}":`, data, error)
  }
}

testRPC()
