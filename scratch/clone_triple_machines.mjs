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
  console.log('Пошук існуючих Триголових верстатів (3060)...')
  const { data: existingMachines, error: queryErr } = await supabase
    .from('machines')
    .select('*')
    .or('name.ilike.%3060%,type.ilike.%3060%,type.ilike.%Три Головий%')
    
  if (queryErr) {
    console.error('Помилка пошуку верстатів:', queryErr)
    return
  }

  console.log(`Знайдено триголових верстатів: ${existingMachines?.length || 0}`)
  
  // Шаблон
  const template = existingMachines && existingMachines.length > 0 ? existingMachines[0] : {
    name: 'CNC 3060х1600',
    type: 'CNC 3060х1600 - 3-36 листів (Три Головий)',
    sheet_capacity: 36,
    status: 'idle',
    floor: 'Локація не вказана'
  }

  const inserts = []

  for (let i = 1; i <= 4; i++) {
    const seqNum = `3.${i}`
    
    // Перевіряємо чи вже є такий порядковий номер
    const alreadyExists = existingMachines?.some(m => String(m.sequence_number) === seqNum)
    
    if (alreadyExists) {
      console.log(`Верстат з порядковим номером ${seqNum} вже існує. Пропускаємо.`)
      continue
    }

    inserts.push({
      name: template.name,
      type: template.type,
      sheet_capacity: template.sheet_capacity || 36,
      status: template.status || 'idle',
      floor: template.floor || 'Локація не вказана',
      sequence_number: seqNum
    })
  }

  if (inserts.length === 0) {
    console.log('Немає нових верстатів для додавання.')
    return
  }

  console.log(`Додаємо ${inserts.length} нових Триголових верстатів у базу даних...`)
  const { data: inserted, error: insertErr } = await supabase
    .from('machines')
    .insert(inserts)
    .select()

  if (insertErr) {
    console.error('Помилка додавання верстатів:', insertErr)
  } else {
    console.log(`✅ Успішно додано ${inserted?.length || 0} верстатів (від 3.1 до 3.4)!`)
  }
}

run()
