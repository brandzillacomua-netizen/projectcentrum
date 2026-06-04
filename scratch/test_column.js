import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log('Running ALTER TABLE via exec_sql RPC...')
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE system_users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"new_order": true, "material_request": true, "packaging_request": true, "supply_request": true}'::jsonb;`
  })

  if (error) {
    console.error('Error executing SQL:', error)
  } else {
    console.log('SQL executed successfully! Result:', data)
    
    // Now verify the column exists by fetching one user
    const { data: users, error: selectError } = await supabase.from('system_users').select('id, login, notification_settings').limit(3)
    if (selectError) {
      console.error('Error selecting:', selectError)
    } else {
      console.log('Sample users after migration:', users)
    }
  }
}

test()
