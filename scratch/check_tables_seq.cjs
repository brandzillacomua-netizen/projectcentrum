const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
    }
  }
})

async function checkTables() {
  const tables = [
    'inventory',
    'warehouse_fgp_inventory',
    'material_requests',
    'purchase_requests',
    'bz_inventory_reservations',
    'nomenclatures',
    'nomenclatures_v2',
    'orders',
    'tasks',
    'work_cards'
  ]

  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`Table ${t}: count=${count}, error=${error?.message || 'none'}`)
  }
}

checkTables().then(() => process.exit(0)).catch(e => console.error(e))
