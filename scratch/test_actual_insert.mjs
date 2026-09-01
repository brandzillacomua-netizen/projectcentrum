import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = '99190e0a-91b0-4a44-ab5e-b1a1ec393ffe'
  
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  const { data: order } = await supabase.from('orders').select('*').eq('id', task.order_id).single()
  const { data: noms } = await supabase.from('nomenclatures').select('*')
  const { data: machineOps } = await supabase.from('machine_operations').select('*')
  const { data: inv } = await supabase.from('inventory').select('*')

  const partNom = noms.find(n => n.name.includes('Тест-Деталь В2'))

  const requestsToInsert = [
    {
      order_id: task.order_id,
      task_id: task.id,
      card_id: null,
      quantity: 4,
      status: 'pending',
      inventory_id: '9d8271f8-ebea-4a38-880c-50a5674afaa9',
      nomenclature_id: 'd23887da-d00a-45a3-bf56-6cc9b0c8cd4b',
      details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ДОВИПУСКУ ${order?.order_num || '???'}: Тестова фреза 1 — 4 од. (для ${partNom?.name || '???'})`
    },
    {
      order_id: task.order_id,
      task_id: task.id,
      card_id: null,
      quantity: 12,
      status: 'pending',
      inventory_id: '8d90f676-8e5f-4296-b06c-fdf8e6f82102',
      nomenclature_id: '74f0cdca-89ee-4063-9960-612e6612ae24',
      details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ДОВИПУСКУ ${order?.order_num || '???'}: Тестова фреза 2 — 12 од. (для ${partNom?.name || '???'})`
    }
  ]

  console.log('Inserting test material_requests...')
  const { data, error } = await supabase.from('material_requests').insert(requestsToInsert).select()

  if (error) {
    console.error('❌ INSERT FAILED WITH ERROR:', error)
  } else {
    console.log('✅ INSERT SUCCESSFUL! Inserted:', data)
  }
}

main().catch(console.error)
