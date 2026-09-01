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

async function run() {
  console.log('--- Fetching existing sheet nomenclatures ---')
  const { data: sheets, error } = await supabase
    .from('nomenclatures')
    .select('*')
    .ilike('name', '%тест%')

  if (error) {
    console.error('Error fetching:', error)
    return
  }

  console.log('Found test nomenclatures:', sheets?.map(s => s.name))

  // Target test nomenclatures
  const testSheetsToEnsure = [
    { name: 'Тест-Лист Т300 (4мм) [Підготовлений]', type: 'raw', unit: 'ЛИСТІВ', material_type: '4мм' },
    { name: 'Тест-Лист Т700 (4мм) [Підготовлений]', type: 'raw', unit: 'ЛИСТІВ', material_type: '4мм' },
    { name: 'Тест-Лист Т300 (4мм) [Непідготовлений]', type: 'raw', unit: 'ЛИСТІВ', material_type: '4мм' },
    { name: 'Тест-Лист Т700 (4мм) [Непідготовлений]', type: 'raw', unit: 'ЛИСТІВ', material_type: '4мм' }
  ]

  for (const item of testSheetsToEnsure) {
    const existing = sheets?.find(s => s.name === item.name)
    let nomId = existing?.id

    if (!existing) {
      console.log(`Creating nomenclature: ${item.name}`)
      const { data: inserted, error: insertErr } = await supabase
        .from('nomenclatures')
        .insert([item])
        .select()
      if (insertErr) {
        console.error(`Error inserting ${item.name}:`, insertErr)
      } else {
        nomId = inserted[0]?.id
        console.log(`Inserted ${item.name} with ID: ${nomId}`)
      }
    } else {
      console.log(`Already exists: ${item.name} (ID: ${nomId})`)
    }

    if (nomId) {
      // Ensure inventory entry in operational warehouse
      const { data: inv } = await supabase
        .from('inventory')
        .select('*')
        .eq('nomenclature_id', nomId)

      if (!inv || inv.length === 0) {
        console.log(`Creating inventory for ${item.name}`)
        await supabase.from('inventory').insert([
          {
            nomenclature_id: nomId,
            name: item.name,
            total_qty: 500,
            warehouse: 'operational',
            type: 'raw',
            unit: 'ЛИСТІВ'
          }
        ])
      }
    }
  }

  // Rename generic sheet nomenclature "Тест-Лист (4мм)" if present so it doesn't conflict
  const oldTestNom = sheets?.find(s => s.name === 'Тест-Лист (4мм)' || s.name === 'Тест-Лист (4мм) [Підготовлений]')
  if (oldTestNom) {
    console.log(`Updating old generic sheet nomenclature ${oldTestNom.name}...`)
    await supabase
      .from('nomenclatures')
      .update({ name: 'Тест-Лист Т300 (4мм) [Підготовлений]' })
      .eq('id', oldTestNom.id)
  }

  console.log('--- Done updating test sheets! ---')
}

run()
