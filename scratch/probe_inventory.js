import { supabase } from '../src/supabase.js'

async function inspect() {
  // We can't easily see constraints via JS, but we can try to find duplicates in other warehouses
  const { data: allItems } = await supabase.from('inventory').select('name, type, warehouse').limit(100)
  console.log('Current items sample:', allItems)
}

inspect()
