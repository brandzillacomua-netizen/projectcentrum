import { supabase } from '../src/supabase.js'

async function checkFlow() {
  const { data, error } = await supabase
    .from('work_card_flow_totals')
    .select('*')
    .limit(10)
  
  if (error) {
    console.error(error)
  } else {
    console.log(JSON.stringify(data, null, 2))
  }
  process.exit(0)
}

checkFlow()
