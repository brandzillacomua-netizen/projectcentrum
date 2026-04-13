
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const nom_name = 'ІП-72-F5-П-5-147'
    console.log(`Searching for nomenclature: ${nom_name}...`)
    
    // 1. Find nomenclature
    const { data: noms } = await supabase.from('nomenclatures').select('*').ilike('name', `%${nom_name}%`)
    if (!noms || noms.length === 0) {
      console.log('Nomenclature not found.')
      return
    }
    const nom = noms[0]
    console.log(`Found Nomenclature ID: ${nom.id}`)

    // 2. Check inventory
    const { data: inv } = await supabase.from('inventory').select('*').eq('nomenclature_id', nom.id)
    console.log('\n--- Inventory ---')
    console.table(inv.map(i => ({ id: i.id, type: i.type, qty: i.total_qty, reserved: i.reserved_qty })))

    // 3. Check recent work cards for this nomenclature
    const { data: cards } = await supabase.from('work_cards')
      .select('id, task_id, status, operation, quantity, card_info, created_at')
      .eq('nomenclature_id', nom.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    console.log('\n--- Recent Work Cards ---')
    console.table(cards)

    // 4. Check the latest task
    const latestTask = cards.length > 0 ? cards[0].task_id : null
    if (latestTask) {
       const { data: task } = await supabase.from('tasks').select('*').eq('id', latestTask).single()
       console.log('\n--- Latest Task Plan Snapshot ---')
       console.log(JSON.stringify(task.plan_snapshot?.[nom.id] || task.plan_snapshot?.[String(nom.id)], null, 2))
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
