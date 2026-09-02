import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testSaveUser() {
  // Get current Roman record
  const { data: user } = await supabase.from('system_users').select('*').eq('login', 'director').single()
  console.log('Current rights before test update:', user.access_rights.crm)

  // Toggle crm right to true explicitly
  const testRights = { ...user.access_rights, crm: true, crm_clients: true, dashboard: true }
  const { data: updated, error } = await supabase.from('system_users').update({ access_rights: testRights }).eq('id', user.id).select()

  if (error) {
    console.error('Update failed:', error)
  } else {
    console.log('Update succeeded! New crm right in DB:', updated[0].access_rights.crm)
    console.log('New dashboard right in DB:', updated[0].access_rights.dashboard)
  }
}

testSaveUser().catch(console.error)
