import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

const run = async () => {
  const { data: workCards } = await supabase.from('work_cards').select('*').neq('status', 'completed')
  
  const waitingCards = workCards.filter(c => c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)'))
  const inWorkCards = workCards.filter(c => c.status === 'in-progress' && c.operation?.startsWith('Галтовка'))
  
  console.log('Waiting cards count:', waitingCards.length)
  console.log('In work cards count:', inWorkCards.length)
  
  // Test filtering with subStageFilter = 'вибростил'
  const filterMode = 'all'
  const subStageFilter = 'вибростил'
  
  let list = []
  if (filterMode === 'all' || filterMode === 'waiting') {
    list.push(...waitingCards.map(c => ({ ...c, type: 'waiting' })))
  }
  if (filterMode === 'all' || filterMode === 'in_work') {
    list.push(...inWorkCards.map(c => ({ ...c, type: 'in_work' })))
  }
  
  console.log('Initial list length:', list.length)
  
  const filtered = list.filter(c => {
    if (c.type === 'waiting') {
      if (subStageFilter === 'вибростил') return c.operation === 'Розкрій'
      if (subStageFilter === 'мийка') return c.operation === 'Галтовка (Вібростіл)'
      if (subStageFilter === 'галтовка') return c.operation === 'Галтовка (Мийка)'
      if (subStageFilter === 'сушка') return c.operation === 'Галтовка (Галтовка)'
    } else {
      if (subStageFilter === 'вибростил') return c.operation === 'Галтовка (Вібростіл)'
      if (subStageFilter === 'мийка') return c.operation === 'Галтовка (Мийка)'
      if (subStageFilter === 'галтовка') return c.operation === 'Галтовка (Галтовка)'
      if (subStageFilter === 'сушка') return c.operation === 'Галтовка (Сушка)'
    }
    return false
  })
  
  console.log('Filtered list length:', filtered.length)
  if (filtered.length > 0) {
    console.log('Filtered cards:', filtered.map(c => ({ id: c.id, operation: c.operation, status: c.status, type: c.type })))
  }
}

run()
