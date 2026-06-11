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

const itemsToAdd = [
  { name: 'KF-Пластинка-3-162', qty: 1340, type: 'raw' },
  { name: 'KR-F-line-Підкладка-10-238', qty: 1340, type: 'raw' }
]

async function run() {
  console.log('Початок додавання позицій...')
  for (const item of itemsToAdd) {
    // 1. Знайти або створити номенклатуру
    let { data: nom, error: nomErr } = await supabase
      .from('nomenclatures')
      .select('id, name')
      .ilike('name', item.name)
      .maybeSingle()

    if (nomErr) {
      console.error(`Помилка пошуку номенклатури ${item.name}:`, nomErr)
      continue
    }

    if (!nom) {
      console.log(`Створюємо номенклатуру для: ${item.name}...`)
      const { data: newNom, error: createNomErr } = await supabase
        .from('nomenclatures')
        .insert([{ name: item.name, type: item.type }])
        .select()
        .single()

      if (createNomErr) {
        console.error(`Помилка створення номенклатури ${item.name}:`, createNomErr)
        continue
      }
      nom = newNom
      console.log(`Створено номенклатуру ${nom.name} (ID: ${nom.id})`)
    } else {
      console.log(`Знайдено існуючу номенклатуру: ${nom.name} (ID: ${nom.id})`)
    }

    // 2. Додати залишки до таблиці inventory на склад raw/operational
    // Перевіряємо чи є на складі operational (СО склад)
    const { data: existingInv, error: invQueryErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('nomenclature_id', nom.id)
      .eq('warehouse', 'operational')
      .eq('type', item.type)
      .maybeSingle()

    if (invQueryErr) {
      console.error(`Помилка пошуку залишків для ${item.name}:`, invQueryErr)
      continue
    }

    if (existingInv) {
      const newQty = (Number(existingInv.total_qty) || 0) + item.qty
      console.log(`Оновлюємо залишки для ${item.name}: було ${existingInv.total_qty}, стане ${newQty}...`)
      const { error: updErr } = await supabase
        .from('inventory')
        .update({ total_qty: newQty, updated_at: new Date().toISOString() })
        .eq('id', existingInv.id)

      if (updErr) {
        console.error(`Помилка оновлення залишків для ${item.name}:`, updErr)
      } else {
        console.log(`✅ Залишки для ${item.name} оновлено успішно!`)
      }
    } else {
      console.log(`Створюємо новий запис в інвентарі для ${item.name}: ${item.qty} шт...`)
      const { error: insErr } = await supabase
        .from('inventory')
        .insert([{
          nomenclature_id: nom.id,
          name: item.name,
          type: item.type,
          warehouse: 'operational',
          unit: 'шт',
          total_qty: item.qty,
          reserved_qty: 0,
          updated_at: new Date().toISOString()
        }])

      if (insErr) {
        console.error(`Помилка створення залишків для ${item.name}:`, insErr)
      } else {
        console.log(`✅ Новий запис в інвентарі для ${item.name} створено!`)
      }
    }
  }
  console.log('Done.')
}

run()
