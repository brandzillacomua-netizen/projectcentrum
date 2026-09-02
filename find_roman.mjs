const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json'
}

async function main() {
  const res = await fetch(`${supabaseUrl}/rest/v1/system_users?select=*`, { headers })
  const users = await res.json()
  const matching = users.filter(u => JSON.stringify(u).toLowerCase().includes('пілець') || JSON.stringify(u).toLowerCase().includes('роман'))
  console.log(`Found ${matching.length} matching users:`)
  matching.forEach(u => {
    console.log('ID:', u.id)
    console.log('Login:', u.login)
    console.log('Full Name / Username:', u.full_name, u.username)
    console.log('Position:', u.position)
    console.log('Access rights:', JSON.stringify(u.access_rights, null, 2))
  })
}

main().catch(console.error)
