import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Query one row or schema of customers
const { data, error } = await supabase
  .from('customers')
  .select('*')
  .limit(1)

if (error) {
  console.error('Error fetching customers:', error)
} else {
  console.log('Customers table sample row / columns:')
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]))
    console.log(data[0])
  } else {
    console.log('No rows in customers table, checking via rpc or metadata if possible...')
  }
}
