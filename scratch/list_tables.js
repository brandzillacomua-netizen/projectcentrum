import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const { data, error } = await supabase.rpc('get_tables') // check if a helper exists, or just query pg_catalog
  if (error) {
    // If RPC doesn't exist, we can try to query information_schema via a select, but RLS might block. Let's try select from pg_class/pg_namespace
    console.error('RPC Error:', error)
    // Let's try to query a few common table names to see if they fail or succeed
    const tables = ['management_tasks', 'material_requests', 'work_cards', 'tasks', 'machines', 'machine_calls', 'machine_notifications', 'machine_operations']
    for (const t of tables) {
      const { error: err } = await supabase.from(t).select('*').limit(1)
      console.log(`Table '${t}' exists/accessible:`, !err, err ? err.message : '')
    }
  } else {
    console.log('Tables:', data)
  }
}

check()
