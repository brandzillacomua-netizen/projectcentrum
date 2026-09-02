import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDB() {
  const tables = ['system_users', 'orders', 'work_cards', 'nomenclatures', 'inventory', 'system_configs', 'company_structure', 'company_positions']
  console.log('Testing Supabase DB connection...')

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact', head: true })
      if (error) {
        console.log(`❌ Table "${table}": Error -`, error.message, error.details || '')
      } else {
        console.log(`✅ Table "${table}": ${count} records found`)
      }
    } catch (e) {
      console.log(`❌ Table "${table}": Exception -`, e.message)
    }
  }
}

checkDB()
