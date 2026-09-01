import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
)

console.log('=== Перевіряємо наряди Цеху 1 (in-progress/active/new) ===\n')

// 1. Беремо всі активні наряди
const { data: activeTasks } = await supabase
  .from('tasks')
  .select('id, order_id, status, batch_index, created_at, plan_snapshot, step')
  .in('status', ['in-progress', 'active', 'new'])
  .order('created_at', { ascending: false })
  .limit(50)

console.log(`Активних нарядів (всього): ${activeTasks?.length || 0}`)
activeTasks?.slice(0, 15).forEach(t => {
  const isPackaged = t.plan_snapshot?._metadata?.is_packaged
  console.log(`  id=${t.id} | status=${t.status} | step=${t.step || '—'} | order_id=${t.order_id} | batch_index=${t.batch_index || '—'} | is_packaged=${isPackaged}`)
})

// 2. Беремо RPC результат
console.log('\n=== RPC mes_fulfillment_queue для packaging ===')
const { data: rpcData, error: rpcError } = await supabase.rpc('mes_fulfillment_queue', {
  p_queue: 'packaging',
  p_open_batch_limit: 300,
  p_archive_batch_limit: 60
})

if (rpcError) {
  console.log('RPC ПОМИЛКА:', rpcError.message, rpcError.code)
} else {
  const allTasksFromRpc = (rpcData || []).flatMap(row => Array.isArray(row?.tasks) ? row.tasks : [])
  console.log(`RPC повернув ${rpcData?.length || 0} батчів, ${allTasksFromRpc.length} завдань`)
  if (allTasksFromRpc.length > 0) {
    allTasksFromRpc.slice(0, 5).forEach(t => {
      console.log(`  id=${t.id} | status=${t.status} | order_id=${t.order_id}`)
    })
  } else {
    console.log('  !! RPC повернув ПОРОЖНІЙ список !!')
    // Подивимось на структуру RPC відповіді
    if (rpcData && rpcData.length > 0) {
      console.log('  Структура батчів:', JSON.stringify(rpcData[0]).slice(0, 200))
    }
  }
}

// 3. Compatibility fallback — що він поверне?
console.log('\n=== Compatibility Fallback (що було б за фолбеком) ===')
const { data: fallbackData, error: fallbackError } = await supabase
  .from('tasks')
  .select('id, order_id, status, batch_index, plan_snapshot, step')
  .in('status', ['in-progress', 'completed', 'active', 'new'])
  .order('created_at', { ascending: false })
  .limit(1000)

if (fallbackError) {
  console.log('Fallback ПОМИЛКА:', fallbackError.message)
} else {
  // Фільтр як у batchList
  const notPackaged = (fallbackData || []).filter(t => t.plan_snapshot?._metadata?.is_packaged !== true)
  console.log(`Fallback повернув ${fallbackData?.length || 0} завдань, з них не запакованих: ${notPackaged.length}`)
  notPackaged.slice(0, 10).forEach(t => {
    console.log(`  id=${t.id} | status=${t.status} | step=${t.step || '—'} | order_id=${t.order_id} | batch_index=${t.batch_index || '—'}`)
  })
}

// 4. Перевіримо чи є наряди з step що вказує на Цех 1
console.log('\n=== Наряди зі step що вказує на Цех 1 ===')
const shop1Tasks = (activeTasks || []).filter(t => {
  const step = (t.step || '').toLowerCase()
  return step.includes('цех') || step.includes('розкр') || step.includes('shop') || step.includes('1')
})
console.log(`Нарядів Цеху 1: ${shop1Tasks.length}`)
shop1Tasks.forEach(t => {
  console.log(`  id=${t.id} | step="${t.step}" | status=${t.status} | order_id=${t.order_id}`)
})
