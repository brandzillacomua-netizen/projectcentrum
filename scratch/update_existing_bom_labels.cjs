const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// ─── AUTO-CLASSIFY helper (mirrors PackagingModule / EngineerModule logic) ─────────────────────
function autoClassify(nom) {
  if (!nom) return 'Інше'
  const name = (nom.name || '').toLowerCase()
  const type = (nom.type || '').toLowerCase()
  const code = (nom.nomenclature_code || '').toLowerCase()

  // Метизи: гвинт, гайка, болт, шайба, прес-гайка
  if (
    name.includes('гвинт') ||
    name.includes('гайка') ||
    name.includes('болт') ||
    name.includes('шайба') ||
    name.includes('прес гайк') ||
    name.includes('прес-гайк') ||
    name.includes('втулка') ||
    type === 'consumable'
  ) return 'Метизи'

  // Кріплення / 3D-друк
  if (
    name.includes('кріплення') ||
    name.includes('друк') ||
    name.includes('3д') ||
    name.includes('3d')
  ) return '3D-друк'

  // Стійки
  if (name.includes('стійка') || name.includes('стийка')) return 'Стійки'

  // Накладки
  if (
    name.includes('накладка') ||
    name.includes('накладки') ||
    name.includes('наклад')
  ) return 'Накладки'

  // Гума / Пластик
  if (
    name.includes('гума') ||
    name.includes('пластик') ||
    name.includes('пвх') ||
    name.includes('каучук') ||
    name.includes('уплітнювач') ||
    name.includes('прокладка') ||
    name.includes('проклад')
  ) return 'Гума/Пластик'

  // Деталі: ІП- префікс, код ІП, type=part
  if (
    name.startsWith('іп') ||
    name.startsWith('іп-') ||
    name.includes(' іп') ||
    code.startsWith('іп') ||
    type === 'part'
  ) return 'Деталі'

  // Вузоли / субасемблі
  if (type === 'assembly') return 'Комплектуючі'

  return 'Інше'
}

async function runMigration() {
  console.log('Fetching all nomenclatures...')
  const { data: nomenclatures, error: nomError } = await supabase
    .from('nomenclatures')
    .select('*')
  
  if (nomError) throw nomError
  console.log(`Loaded ${nomenclatures.length} nomenclatures.`)

  console.log('Fetching all bom_items...')
  const { data: bomItems, error: bomError } = await supabase
    .from('bom_items')
    .select('*')
  
  if (bomError) throw bomError
  console.log(`Loaded ${bomItems.length} bom_items.`)

  console.log('Updating group labels for existing BOM items...')
  let updatedCount = 0

  for (const item of bomItems) {
    const childNom = nomenclatures.find(n => String(n.id) === String(item.child_id))
    if (!childNom) continue

    const correctGroup = autoClassify(childNom)
    
    // Update only if group_label is different (or currently matches default 'Деталі' but shouldn't)
    if (item.group_label !== correctGroup) {
      console.log(`Updating item ID: ${item.id} (${childNom.name}) -> ${correctGroup}`)
      const { error: updateError } = await supabase
        .from('bom_items')
        .update({ group_label: correctGroup })
        .eq('id', item.id)
      
      if (updateError) {
        console.error(`Failed to update item ID: ${item.id}:`, updateError.message)
      } else {
        updatedCount++
      }
    }
  }

  console.log(`🎉 Finished migration. Updated ${updatedCount} BOM items to their proper group labels.`)
}

runMigration().catch(console.error)
