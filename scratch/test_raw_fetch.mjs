const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

async function testFetch() {
  const res = await fetch(`${supabaseUrl}/rest/v1/system_users?select=count`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  })

  console.log('Status:', res.status, res.statusText)
  const headers = {}
  res.headers.forEach((v, k) => headers[k] = v)
  console.log('Response Headers:', headers)
  const text = await res.text()
  console.log('Response Body:', text.slice(0, 100))
}

testFetch()
