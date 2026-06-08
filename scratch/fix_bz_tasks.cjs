const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
)

async function main() {
  // Знайти всі наряди з step = 'Паквання' та status = 'completed'
  const { data: bzTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('step', 'Паквання')
    .eq('status', 'completed')

  if (error) { console.error('Error:', error); return }
  if (!bzTasks || bzTasks.length === 0) {
    console.log('Не знайдено BZ-нарядів зі step="Паквання"')
    return
  }

  console.log(`Знайдено ${bzTasks.length} BZ-нарядів для виправлення:`)
  bzTasks.forEach(t => console.log(`  ID: ${t.id}, order_id: ${t.order_id}, batch_index: ${t.batch_index}`))

  // Оновлюємо step з 'Паквання' → 'Розкрій'
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ step: 'Розкрій' })
    .eq('step', 'Паквання')
    .eq('status', 'completed')

  if (updateError) { console.error('Update error:', updateError); return }
  console.log(`\n✅ Оновлено step → 'Розкрій' для ${bzTasks.length} нарядів`)

  // Для кожного такого наряду — перевіряємо чи є вже Shop2-наряд, якщо ні — створюємо
  for (const task of bzTasks) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('order_id', task.order_id)
      .eq('batch_index', task.batch_index)
      .ilike('step', '%Пресування%')
      .limit(1)
      .maybeSingle()

    if (existing) {
      console.log(`  Цех 2 вже є для order_id=${task.order_id}, batch=${task.batch_index}`)
      continue
    }

    const { error: insertError } = await supabase.from('tasks').insert([{
      order_id: task.order_id,
      step: 'Пресування [ЦЕХ №2]',
      status: 'completed',
      completed_at: task.completed_at || new Date().toISOString(),
      machine_name: task.machine_name || 'Не вказано',
      estimated_time: 0,
      engineer_conf: true,
      warehouse_conf: true,
      director_conf: true,
      plan_snapshot: { ...(task.plan_snapshot || {}), arrivals: [] },
      planned_sets: task.planned_sets || 0,
      batch_index: task.batch_index || null,
      planned_deadline: task.planned_deadline || null
    }])

    if (insertError) {
      console.error(`  ❌ Помилка створення Shop2-наряду для order_id=${task.order_id}:`, insertError)
    } else {
      console.log(`  ✅ Створено Shop2-наряд для order_id=${task.order_id}, batch=${task.batch_index}`)
    }
  }

  console.log('\nГотово!')
}

main()
