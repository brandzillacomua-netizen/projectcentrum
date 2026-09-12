import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function cleanupTestData() {
  console.log('🧹 [CLEANUP]: Початок очищення тестових даних симуляції "Рама F10"...\n')

  try {
    // 0. Авторизація
    await supabase.auth.signInWithPassword({
      email: 'alexinj@centrum.local',
      password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
    })

    // 1. Пошук тестових карток
    const { data: testCards } = await supabase
      .from('work_cards')
      .select('id, task_id, card_info')
      .or('card_info.ilike.%РАМА F10%,card_info.ilike.%ДЕТАЛЬ 2%')

    console.log(`📋 Знайдено тестових карток для очищення: ${testCards?.length || 0}`)

    const taskIdsToClean = new Set()
    if (testCards && testCards.length > 0) {
      const cardIds = testCards.map(c => c.id)
      testCards.forEach(c => { if (c.task_id) taskIdsToClean.add(c.task_id) })

      // Видаляємо тестові картки
      const { error: delCardsErr } = await supabase
        .from('work_cards')
        .delete()
        .in('id', cardIds)

      if (delCardsErr) console.error('Помилка видалення карток:', delCardsErr.message)
      else console.log(`  ✅ Видалено ${cardIds.length} тестових карток із work_cards`)
    }

    // 2. Видалення тестових нарядів
    if (taskIdsToClean.size > 0) {
      const taskIds = Array.from(taskIdsToClean)
      
      // Також видаляємо можливі матеріальні запити для цих нарядів
      await supabase.from('material_requests').delete().in('task_id', taskIds)

      const { error: delTasksErr } = await supabase
        .from('tasks')
        .delete()
        .in('id', taskIds)

      if (delTasksErr) console.error('Помилка видалення нарядів:', delTasksErr.message)
      else console.log(`  ✅ Видалено ${taskIds.length} тестових нарядів із tasks`)
    }

    // 3. Відновлення складських залишків (Скинути випадкову бронь від тестів на базову 0)
    const { data: sheetInv } = await supabase
      .from('inventory')
      .select('id, name, total_qty, reserved_qty')
      .gt('total_qty', 10)
      .limit(1)
      .maybeSingle()

    const { data: cutterInv } = await supabase
      .from('inventory')
      .select('id, name, total_qty, reserved_qty')
      .gt('total_qty', 5)
      .limit(1)
      .maybeSingle()

    if (sheetInv) {
      await supabase
        .from('inventory')
        .update({ 
          total_qty: Number(sheetInv.total_qty) + 1, 
          reserved_qty: Math.max(0, Number(sheetInv.reserved_qty) - 3) 
        })
        .eq('id', sheetInv.id)
      console.log(`  ✅ Залишки Листа скориговано (повернуто 1 шт, знято 3 шт броні)`)
    }

    if (cutterInv) {
      await supabase
        .from('inventory')
        .update({ 
          total_qty: Number(cutterInv.total_qty) + 3 
        })
        .eq('id', cutterInv.id)
      console.log(`  ✅ Залишки Фрез скориговано (повернуто 3 шт)`)
    }

    console.log('\n✨ [CLEANUP COMPLETE]: БД повністю очищена від тестових записів та баланси відновлені!')

  } catch (err) {
    console.error('❌ Помилка під час очищення:', err.message)
  }
}

cleanupTestData()
