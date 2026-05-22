import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  // Query rows in machine_operations
  const { data: rows, error: rowsErr } = await supabase.from('machine_operations').select('id, nomenclature_id, machine_type, machine_id')
  console.log('--- Direct query of machine_operations table ---')
  if (rowsErr) {
    console.error('Error fetching machine_operations:', rowsErr)
  } else {
    console.log(`Found ${rows.length} rows directly.`)
    console.log('Sample rows:', rows.slice(0, 5))
  }

  // Use exec_sql to inspect RLS policies on machine_operations
  console.log('\n--- Querying RLS policies via SQL ---')
  const rlsQuery = `
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'machine_operations';
  `
  const { data: rlsStatus, error: rlsStatusErr } = await supabase.rpc('exec_sql', { sql: rlsQuery })
  console.log('RLS Status:', { data: rlsStatus, error: rlsStatusErr })

  const policiesQuery = `
    SELECT policyname, cmd, roles, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'machine_operations';
  `
  const { data: policies, error: policiesErr } = await supabase.rpc('exec_sql', { sql: policiesQuery })
  console.log('Policies:', { data: policies, error: policiesErr })
  
  // Also count total rows using SQL bypass
  const countQuery = `SELECT count(*) FROM machine_operations;`
  const { data: sqlCount, error: sqlCountErr } = await supabase.rpc('exec_sql', { sql: countQuery })
  console.log('SQL Count of machine_operations:', { data: sqlCount, error: sqlCountErr })
}

run()
