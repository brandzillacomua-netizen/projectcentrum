const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

async function checkFlow() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/work_card_flow_totals?select=*&limit=100`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    })
    const data = await res.json()
    console.log(JSON.stringify(data.slice(0, 5), null, 2))
  } catch (err) {
    console.error(err)
  }
}

checkFlow()
