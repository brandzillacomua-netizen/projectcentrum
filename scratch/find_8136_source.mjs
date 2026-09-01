import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function findCardsSumming8136() {
  const { data: cards } = await supabase.from('work_cards').select('id, task_id, status, operation, quantity, used_in_shop2_qty, card_info')
  const { data: tasks } = await supabase.from('tasks').select('id, step, name')

  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  let usedInShop2Sum = 0
  let atShop2BufferSum = 0
  let inProgressAnySum = 0

  cards?.forEach(c => {
    if (c.status === 'at-shop2-buffer') {
      usedInShop2Sum += Number(c.used_in_shop2_qty || 0)
      atShop2BufferSum += Number(c.quantity || 0)
    }
    if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer'].includes(c.status)) {
      inProgressAnySum += Number(c.quantity || 0)
    }
  })

  console.log('=== FINDING 8136 SOURCE ===')
  console.log(`Sum of used_in_shop2_qty on at-shop2-buffer cards: ${usedInShop2Sum} шт`)
  console.log(`Sum of quantity on at-shop2-buffer cards: ${atShop2BufferSum} шт`)
  console.log(`Sum of active cards across all tasks in DB: ${inProgressAnySum} шт`)
}

findCardsSumming8136().catch(console.error)
