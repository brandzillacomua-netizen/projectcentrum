import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspect() {
  console.log('--- Fetching data from DB ---')
  const { data: workCards, error: errCards } = await supabase.from('work_cards').select('*')
  if (errCards) console.error('Error work_cards:', errCards)

  const { data: noms, error: errNoms } = await supabase.from('nomenclatures').select('*')
  if (errNoms) console.error('Error nomenclatures:', errNoms)

  const { data: orders, error: errOrders } = await supabase.from('orders').select('*')
  if (errOrders) console.error('Error orders:', errOrders)

  console.log(`Total work cards: ${workCards ? workCards.length : 0}`)
  console.log(`Total nomenclatures: ${noms ? noms.length : 0}`)
  console.log(`Total orders: ${orders ? orders.length : 0}`)

  if (workCards && workCards.length > 0) {
    console.log('\n--- SAMPLE WORK CARD ---')
    console.log(JSON.stringify(workCards[0], null, 2))
    
    console.log('\n--- ALL WORK CARDS STATUSES & OPERATIONS ---')
    const statuses = {}
    const operations = {}
    workCards.forEach(c => {
      statuses[c.status] = (statuses[c.status] || 0) + 1
      operations[c.operation] = (operations[c.operation] || 0) + 1
    })
    console.log('Statuses:', statuses)
    console.log('Operations:', operations)
  }

  if (noms && noms.length > 0) {
    const targetNomId = '7e8d056d-06b2-42a7-88e1-12186b914948'
    const targetNom = noms.find(n => n.id === targetNomId)
    console.log('\n--- TARGET NOMENCLATURE ---')
    console.log(JSON.stringify(targetNom, null, 2))

    const { data: bom, error: errBom } = await supabase.from('bom_items').select('*')
    if (errBom) console.error('Error bom_items:', errBom)
    
    if (bom) {
      const parentBoms = bom.filter(b => b.child_id === targetNomId)
      console.log('\n--- BOM ITEMS LINKING TO TARGET ---')
      console.log(parentBoms)
      
      parentBoms.forEach(b => {
        const parent = noms.find(n => n.id === b.parent_id)
        console.log(`Parent Name: "${parent ? parent.name : 'Unknown'}" (ID: ${b.parent_id})`)
      })
    }
  }
}

inspect()
