import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    // We can query information_schema or similar if we have enough permissions
    // Or we can rpc custom sql. Let's try running a direct query via a SQL RPC if it exists, or just query known tables.
    // Let's query information_schema.columns:
    const { data: cols, error: err } = await supabase.rpc('get_table_columns_info') // might not exist
    if (err) {
      console.log("RPC failed, let's query postgres system views")
      // Let's try to query pg_class or other tables using standard select if accessible
      const { data: tables, error: err2 } = await supabase.from('pg_tables').select('*') // usually not exposed via PostgREST unless there is a view
      console.log("pg_tables error:", err2?.message)
    } else {
      console.log("Columns:", cols)
    }
    
    // Let's list what we can by inspecting common tables:
    // Let's query nomenclatures, orders, tasks, packaging_boxes, work_cards, machines, users
    // Let's query one row of each to print their fields.
    const tables = ['nomenclatures', 'tasks', 'orders', 'order_items', 'packaging_boxes', 'work_cards', 'machines', 'system_users']
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select('*').limit(1)
      if (data && data[0]) {
        console.log(`Table ${t} columns:`, Object.keys(data[0]))
      }
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
