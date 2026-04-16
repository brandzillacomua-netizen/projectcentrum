
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables')
  if (error) {
    // If RPC doesn't exist, try a simple select from a known table or inform
    console.log('Error listing tables via RPC:', error)
    // Fallback: try to see what we can find
    console.log('Trying to query common tables...')
    const tables = ['orders', 'users', 'tasks', 'inventory', 'machines', 'material_requests', 'work_cards', 'work_card_history']
    for (const t of tables) {
      const { error: e } = await supabase.from(t).select('count').limit(1)
      console.log(`Table ${t}: ${e ? 'Error/Missing' : 'Exists'}`)
    }
  } else {
    console.log('Tables:', data)
  }
}

listTables()
