import { supabase } from '../src/supabase.js'

async function inspect() {
  const { data: users } = await supabase.from('system_users').select('id, login').limit(2)
  console.log('Users sample:', users)
}

inspect()
