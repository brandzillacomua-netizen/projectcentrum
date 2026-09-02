import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: users, error } = await supabase.from('system_users').select('id, login, position, access_rights')
  if (error) {
    console.error('DB Error:', error)
    return
  }
  console.log(`=== SYSTEM USERS ACCESS RIGHTS (${users.length}) ===`)
  users.forEach(u => {
    console.log(`User: ${u.login} | Position: ${u.position} | Type of access_rights: ${typeof u.access_rights}`)
    console.log(`Raw access_rights:`, JSON.stringify(u.access_rights))
    console.log('---')
  })
}

main().catch(console.error)
