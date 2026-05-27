import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const test = async () => {
    const nomId = '7e8d056d-06b2-42a7-88e1-12186b914948'
    
    // 1. Get current inventory scrap quantity
    const { data: beforeInv } = await supabase
      .from('inventory')
      .select('total_qty')
      .eq('nomenclature_id', nomId)
      .eq('type', 'scrap')
      .maybeSingle()
      
    const initialQty = beforeInv ? beforeInv.total_qty : 0
    console.log('Initial inventory scrap quantity:', initialQty)
    
    // 2. Insert a work_card_history record with scrap_qty = 5
    const mockCardId = 'cfb58bbd-cffa-4f16-8b8b-37c455232b33'
    console.log('Inserting mock work_card_history record with scrap_qty = 5...')
    const { data: histRecord, error: histErr } = await supabase
      .from('work_card_history')
      .insert([{
        card_id: mockCardId,
        nomenclature_id: nomId,
        stage_name: 'Test Trigger Stage',
        operator_name: 'Test Trigger Operator',
        qty_at_start: 10,
        qty_completed: 5,
        scrap_qty: 5,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        is_archived_scrap: true,
        shift_name: 'Test Shift',
        manager_name: 'Test Manager',
        machine_name: 'Test Machine'
      }])
      .select()
      
    if (histErr) {
      console.error('History insert error:', histErr)
      return
    }
    
    console.log('Inserted history record ID:', histRecord[0].id)
    
    // Wait 2 seconds to make sure any trigger would have finished
    await new Promise(r => setTimeout(r, 2000))
    
    // 3. Get new inventory scrap quantity
    const { data: afterInv } = await supabase
      .from('inventory')
      .select('total_qty')
      .eq('nomenclature_id', nomId)
      .eq('type', 'scrap')
      .maybeSingle()
      
    const newQty = afterInv ? afterInv.total_qty : 0
    console.log('New inventory scrap quantity:', newQty)
    console.log('Difference:', newQty - initialQty)
    
    // 4. Clean up: delete mock history record
    console.log('Cleaning up mock history record...')
    await supabase.from('work_card_history').delete().eq('id', histRecord[0].id)
  }
  
  test()
} else {
  console.error('Could not find Supabase credentials')
}
