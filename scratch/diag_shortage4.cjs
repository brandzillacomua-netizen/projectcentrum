const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function diagnose() {
  const taskId = 'a7f6ab43-9013-40d8-8e8e-8c371323695d'
  const { data: t } = await supabase.from('tasks').select('id, plan_snapshot').eq('id', taskId).single()
  const snapshot = t?.plan_snapshot || {}
  
  const snapshotKeys = Object.keys(snapshot)
  console.log(`Plan snapshot keys: ${snapshotKeys.length}`)
  console.log('Sample keys:', snapshotKeys.slice(0, 5))
  
  // Check what these keys map to
  if (snapshotKeys.length > 0) {
    // Only check non-underscore keys
    const nomKeys = snapshotKeys.filter(k => !k.startsWith('_'))
    console.log(`Nomenclature keys (non-underscore): ${nomKeys.length}`)
    console.log('Sample nom keys:', nomKeys.slice(0, 3))
    
    if (nomKeys.length > 0) {
      const { data: noms } = await supabase.from('nomenclatures').select('id, name, type').in('id', nomKeys.slice(0, 10))
      console.log('Matching nomenclatures:', noms?.map(n => `${n.id} → ${n.name} (${n.type})`))
      
      // Check type distribution
      const allKeys = nomKeys
      const batchSize = 50
      let allNoms = []
      for (let i = 0; i < allKeys.length; i += batchSize) {
        const { data: batch } = await supabase.from('nomenclatures').select('id, name, type').in('id', allKeys.slice(i, i + batchSize))
        allNoms = [...allNoms, ...(batch || [])]
      }
      
      const byType = {}
      allNoms.forEach(n => { byType[n.type || 'unknown'] = (byType[n.type] || 0) + 1 })
      console.log('Nomenclature types in snapshot:', byType)
      
      // Check snapshot values for 'part' type
      const partNoms = allNoms.filter(n => n.type === 'part')
      console.log(`\nPart noms in snapshot: ${partNoms.length}`)
      partNoms.forEach(n => {
        const snap = snapshot[String(n.id)]
        console.log(`  ${n.name}: need=${snap?.need}, stock=${snap?.stock}, sheets=${snap?.sheets}`)
      })
      
      // Check the scrap noms
      const scrapNomIds = ['50947afc-4e40-4165-a682-780275d5feda', '5ecf63e5-802d-4f98-8291-aad9a52bfaa4']
      const { data: scrapNoms } = await supabase.from('nomenclatures').select('id, name, type').in('id', scrapNomIds)
      console.log('\nNomenclatures with scrap:')
      scrapNoms?.forEach(n => {
        const inSnapshot = snapshot[String(n.id)]
        console.log(`  ${n.name} (type=${n.type}) → in snapshot: ${inSnapshot ? 'YES' : 'NO'}`)
        if (inSnapshot) console.log(`    need=${inSnapshot.need}, stock=${inSnapshot.stock}`)
      })
    }
  }
  
  // Also check history fetch issue
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id')
    .eq('task_id', taskId)
    .limit(10)
  
  const sampleIds = (cards||[]).map(c => c.id)
  console.log('\n\nTesting history fetch with small chunks:')
  console.log('Sample card IDs (first 10):', sampleIds)
  
  if (sampleIds.length > 0) {
    const { data: h, error: hErr } = await supabase
      .from('work_card_history')
      .select('id, card_id, scrap_qty')
      .in('card_id', sampleIds)
    
    console.log(`History for 10 cards: ${(h||[]).length} entries, error: ${hErr?.message || 'none'}`)
  }
}

diagnose().catch(console.error)
