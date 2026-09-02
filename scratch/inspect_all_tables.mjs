import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectAll() {
  const allTables = [
    'system_users', 'company_structure', 'company_positions',
    'orders', 'work_cards', 'work_card_history', 'nomenclatures',
    'bom_items', 'inventory', 'material_requests', 'reception_docs',
    'purchase_requests', 'machines', 'machine_calls', 'machine_operations',
    'tasks', 'management_tasks', 'task_projects', 'customers', 'system_configs'
  ]

  console.log('--- Database Table Record Audit ---')
  for (const t of allTables) {
    const { data, error, count } = await supabase.from(t).select('*', { count: 'exact' }).limit(5)
    if (error) {
      console.log(`Table ${t}: Error - ${error.message}`)
    } else {
      console.log(`Table ${t}: ${count} total rows. Sample: ${data.length} items`)
      if (data.length > 0) {
        console.log(`   First row ID:`, data[0].id || data[0].name || JSON.stringify(data[0]).slice(0, 80))
      }
    }
  }
}

inspectAll()
