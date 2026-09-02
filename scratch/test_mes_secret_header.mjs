import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function testSecret() {
  const tables = ['system_users', 'orders', 'work_cards', 'nomenclatures', 'inventory']
  console.log('Testing Supabase WITH x-mes-secret header...')

  for (const t of tables) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' }).limit(5)
    if (error) {
      console.log(`Table ${t}: Error - ${error.message}`)
    } else {
      console.log(`Table ${t}: ${count} total rows. Sample: ${data.length} items`)
      if (data.length > 0) {
        console.log(`   First row:`, data[0].id || data[0].name || data[0].login || JSON.stringify(data[0]).slice(0, 80))
      }
    }
  }
}

testSecret()
