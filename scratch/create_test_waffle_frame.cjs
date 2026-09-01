const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  console.log("=== РЕНЕЙМІНГ ТЕСТОВИХ ЛИСТІВ ТА ОНОВЛЕННЯ ДЕТАЛЕЙ ===")

  // 1. Rename raw test sheet nomenclatures
  const sheetRenames = [
    { old: 'Лист Т300 (4мм) [Підготовлений]', new: 'Тест-Лист Т300 (4мм) [Підготовлений]' },
    { old: 'Лист Т700 (4мм) [Підготовлений]', new: 'Тест-Лист Т700 (4мм) [Підготовлений]' }
  ]

  for (const item of sheetRenames) {
    const { data: nom } = await supabase.from('nomenclatures').select('id').eq('name', item.old).maybeSingle()
    if (nom) {
      await supabase.from('nomenclatures').update({ name: item.new }).eq('id', nom.id)
      console.log(`✓ Перейменовано: ${item.old} -> ${item.new}`)
    } else {
      // Check if new name already exists
      const { data: newNom } = await supabase.from('nomenclatures').select('id').eq('name', item.new).maybeSingle()
      if (!newNom) {
        await supabase.from('nomenclatures').insert({ name: item.new, type: 'raw', unit: 'лист' })
        console.log(`+ Створено новий тестовий лист: ${item.new}`)
      }
    }
  }

  // 2. Update material_type for Test Parts
  const partUpdates = [
    { name: 'Тест-Деталь В1 (Верхня планка Вафель)', material: 'Тест-Лист Т300 (4мм)' },
    { name: 'Тест-Деталь В2 (Нижня планка Вафель)', material: 'Тест-Лист Т300 (4мм)' },
    { name: 'Тест-Деталь В3 (Боковина Вафель)', material: 'Тест-Лист Т700 (4мм)' }
  ]

  for (const part of partUpdates) {
    const { data: nom } = await supabase.from('nomenclatures').select('id').eq('name', part.name).maybeSingle()
    if (nom) {
      await supabase.from('nomenclatures').update({ material_type: part.material }).eq('id', nom.id)
      console.log(`✓ Оновлено матеріал для ${part.name} -> ${part.material}`)
    }
  }

  // 3. Ensure test stock items in inventory
  const testStockItems = [
    { nomName: 'Тест-Лист Т300 (4мм) [Підготовлений]', qty: 150, type: 'raw' },
    { nomName: 'Тест-Лист Т700 (4мм) [Підготовлений]', qty: 100, type: 'raw' }
  ]

  for (const stock of testStockItems) {
    const { data: nom } = await supabase.from('nomenclatures').select('id').eq('name', stock.nomName).maybeSingle()
    if (!nom) continue

    const { data: existingInv } = await supabase
      .from('inventory')
      .select('id')
      .eq('nomenclature_id', nom.id)
      .eq('warehouse', 'operational')
      .maybeSingle()

    if (existingInv) {
      await supabase.from('inventory').update({ total_qty: stock.qty, reserved_qty: 0 }).eq('id', existingInv.id)
      console.log(`✓ Оновлено залишок для ${stock.nomName}: ${stock.qty}`)
    } else {
      await supabase.from('inventory').insert({
        nomenclature_id: nom.id,
        warehouse: 'operational',
        type: stock.type,
        total_qty: stock.qty,
        reserved_qty: 0,
        pocket_owner: 'Не вказано'
      })
      console.log(`+ Створено залишок для ${stock.nomName}: ${stock.qty}`)
    }
  }

  console.log("=== ТЕСТОВІ ЛИСТИ УСПІШНО ІЗОЛЬОВАНО! ===")
}

run()
