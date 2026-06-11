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

const itemsToMove = [
  { name: 'KF-Пластинка-3-162', qty: 1340, type: 'raw' },
  { name: 'KR-F-line-Підкладка-10-238', qty: 1340, type: 'raw' }
]

async function run() {
  console.log('Початок переміщення на Склад БЗ...')
  
  for (const item of itemsToMove) {
    // 1. Отримуємо номенклатуру
    const { data: nom, error: nomErr } = await supabase
      .from('nomenclatures')
      .select('id, name')
      .ilike('name', item.name)
      .maybeSingle()

    if (nomErr || !nom) {
      console.error(`Не знайдено номенклатуру ${item.name}:`, nomErr)
      continue
    }

    // 2. Видаляємо залишок з оперативного складу (warehouse: 'operational', type: 'raw')
    console.log(`Видаляємо ${item.qty} шт ${item.name} з оперативного складу...`)
    const { data: existingOp, error: opErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('nomenclature_id', nom.id)
      .eq('warehouse', 'operational')
      .eq('type', 'raw')
      .maybeSingle()

    if (!opErr && existingOp) {
      const remainingQty = Math.max(0, (Number(existingOp.total_qty) || 0) - item.qty)
      if (remainingQty === 0) {
        // Якщо залишок став 0, можна видалити запис або оновити до 0. Краще видалити, щоб не засмічувати.
        await supabase.from('inventory').delete().eq('id', existingOp.id)
      } else {
        await supabase.from('inventory').update({ total_qty: remainingQty }).eq('id', existingOp.id)
      }
      console.log(`Видалено з оперативного складу (залишилось: ${remainingQty})`)
    }

    // 3. Записуємо/додаємо залишок на склад БЗ (warehouse: null або 'production', type: 'bz')
    // Згідно структури Centrum, БЗ склад - це type: 'bz', warehouse: null / default
    const { data: existingBz, error: bzErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('nomenclature_id', nom.id)
      .eq('type', 'bz')
      .maybeSingle()

    if (bzErr) {
      console.error(`Помилка пошуку БЗ залишків для ${item.name}:`, bzErr)
      continue
    }

    if (existingBz) {
      const newQty = (Number(existingBz.total_qty) || 0) + item.qty
      console.log(`Оновлюємо БЗ залишки для ${item.name}: було ${existingBz.total_qty}, стане ${newQty}...`)
      await supabase
        .from('inventory')
        .update({ total_qty: newQty, updated_at: new Date().toISOString() })
        .eq('id', existingBz.id)
      console.log(`✅ Залишки на складі БЗ для ${item.name} оновлено!`)
    } else {
      console.log(`Створюємо БЗ залишок для ${item.name} у кількості ${item.qty}...`)
      await supabase
        .from('inventory')
        .insert([{
          nomenclature_id: nom.id,
          name: item.name,
          type: 'bz', // тип складу БЗ
          unit: 'шт',
          total_qty: item.qty,
          reserved_qty: 0,
          updated_at: new Date().toISOString()
        }])
      console.log(`✅ Запис на складі БЗ для ${item.name} успішно створено!`)
    }
  }
  
  console.log('Done.')
}

run()
