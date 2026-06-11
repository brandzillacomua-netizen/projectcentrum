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
  console.log('Пошук існуючих швидкісних верстатів (3050)...')
  const { data: existingMachines, error: queryErr } = await supabase
    .from('machines')
    .select('*')
    .or('name.ilike.%швидкісний%,name.ilike.%3050%,type.ilike.%швидкісний%')
    
  if (queryErr) {
    console.error('Помилка пошуку верстатів:', queryErr)
    return
  }

  console.log(`Знайдено швидкісних верстатів: ${existingMachines?.length || 0}`)
  
  // Визначаємо шаблон (використовуємо знайдений або дефолт)
  const template = existingMachines && existingMachines.length > 0 ? existingMachines[0] : {
    name: 'CNC 3050',
    type: 'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
    sheet_capacity: 12,
    status: 'idle',
    floor: 'Локація не вказана'
  }

  const inserts = []

  for (let i = 1; i <= 2; i++) {
    const seqNum = `2.${i}`
    
    // Перевіряємо чи вже є такий порядковий номер
    const alreadyExists = existingMachines?.some(m => String(m.sequence_number) === seqNum)
    
    if (alreadyExists) {
      console.log(`Верстат з порядковим номером ${seqNum} вже існує. Пропускаємо.`)
      continue
    }

    inserts.push({
      name: template.name,
      type: template.type,
      sheet_capacity: template.sheet_capacity || 12,
      status: template.status || 'idle',
      floor: template.floor || 'Локація не вказана',
      sequence_number: seqNum
    })
  }

  if (inserts.length === 0) {
    console.log('Немає нових верстатів для додавання.')
    return
  }

  console.log(`Додаємо ${inserts.length} нових швидкісних верстатів у базу даних...`)
  const { data: inserted, error: insertErr } = await supabase
    .from('machines')
    .insert(inserts)
    .select()

  if (insertErr) {
    console.error('Помилка додавання верстатів:', insertErr)
  } else {
    console.log(`✅ Успішно додано ${inserted?.length || 0} швидкісних верстатів (від 2.1 до 2.2)!`)
  }
}

run()
