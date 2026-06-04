import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'packaging_boxes';
  ` })
  if (error) {
    // If exec_sql doesn't work, we can try to select one row or inspect error
    console.error('Error fetching columns via exec_sql:', error)
    
    // Fallback: try to select a row and see the keys
    const { data: rows, error: selErr } = await supabase.from('packaging_boxes').select('*').limit(1)
    console.log('Select result keys:', rows ? Object.keys(rows[0] || {}) : null, 'Error:', selErr)
  } else {
    console.log('Columns of packaging_boxes:', data)
  }
}

check()
