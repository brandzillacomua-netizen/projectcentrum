import { supabase } from '../src/supabase.js'

async function inspect() {
  const { data, error } = await supabase.from('material_requests').select('*').limit(1)
  if (error) {
    console.error(error)
    return
  }
  console.log('Columns:', Object.keys(data[0] || {}))
}

inspect()
