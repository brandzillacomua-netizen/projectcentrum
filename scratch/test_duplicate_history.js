import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const cardId = 'cfb58bbd-cffa-4f16-8b8b-37c455232b33'
    const nomId = '7e8d056d-06b2-42a7-88e1-12186b914948'
    
    console.log('Inserting first duplicate history record:')
    const { data: res1, error: err1 } = await supabase
      .from('work_card_history')
      .insert([{
        card_id: cardId,
        nomenclature_id: nomId,
        stage_name: 'Test Duplicate Stage',
        qty_at_start: 10,
        qty_completed: 10,
        scrap_qty: 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      }])
      .select()
      
    console.log('Result 1:', { res1, err1 })
    
    console.log('Inserting second duplicate history record:')
    const { data: res2, error: err2 } = await supabase
      .from('work_card_history')
      .insert([{
        card_id: cardId,
        nomenclature_id: nomId,
        stage_name: 'Test Duplicate Stage',
        qty_at_start: 10,
        qty_completed: 10,
        scrap_qty: 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      }])
      .select()
      
    console.log('Result 2:', { res2, err2 })
    
    // Clean up
    console.log('Cleaning up...')
    if (res1) await supabase.from('work_card_history').delete().eq('id', res1[0].id)
    if (res2) await supabase.from('work_card_history').delete().eq('id', res2[0].id)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
