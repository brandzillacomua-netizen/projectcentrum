import { createClient } from '@supabase/supabase-js'
import { getScrapBreakdown } from '../src/modules/Foreman/utils/foremanHelpers.js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testForemanScrap() {
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')

  const targetOrder = orders.find(o => o.order_num === '260827-2')
  const s1Task = tasks.find(t => t.order_id === targetOrder.id && t.step?.includes('Розкрій'))

  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec' // Detail 1

  const activeCards = (workCards || []).filter(c => String(c.task_id) === String(s1Task.id) && String(c.nomenclature_id) === String(nomId))
  const cardIdsStrings = activeCards.map(c => String(c.id))
  const groupHistory = (history || []).filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))

  const laserCards = activeCards.filter(c => c.operation !== 'Склад БЗ')
  const groupBreakdown = getScrapBreakdown(laserCards, groupHistory, workCards)

  console.log('Foreman Breakdown for Detail 1:', groupBreakdown)
}

testForemanScrap().catch(console.error)
