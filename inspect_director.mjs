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
  const director = users.find(u => (u.full_name || u.login || '').includes('Пілецький') || (u.full_name || u.login || '').includes('Роман') || (u.position || '').includes('Директор'))
  console.log('Director id:', director?.id)
  console.log('Director full_name:', director?.full_name)
  console.log('Director position:', director?.position)
  console.log('Director access_rights:', director?.access_rights)
}

main().catch(console.error)
