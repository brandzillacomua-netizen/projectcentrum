import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const normalize = (s) => (s || '').toLowerCase().trim()
  .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
  .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
  .replace(/[хx]/g, 'x').replace(/[іi]/g, 'i').replace(/[уy]/g, 'y')
  .replace(/[кk]/g, 'k').replace(/[мm]/g, 'm').replace(/[нn]/g, 'n')
  .replace(/[вv]/g, 'v').replace(/[и]/g, 'y').replace(/\s/g, '')

async function run() {
  const { data: currentNoms } = await supabase.from('nomenclatures').select('*')
  const { data: currentInvs } = await supabase.from('inventory').select('*')
  
  const thicknesses = ['2мм', '3мм', '4мм', '5мм', '6мм', '7мм']

  console.log("Starting migration of sheet nomenclatures...")

  for (const thick of thicknesses) {
    const rawName = `Лист Т300 (${thick}) [Непідготовлений]`
    const prepName = `Лист Т300 (${thick}) [Підготовлений]`
    
    console.log(`\nProcessing thickness: ${thick}`)
    
    // 1. Find or create raw sheet nomenclature
    let rawNom = currentNoms.find(n => 
      (n.name.toLowerCase().includes('лист') && n.name.toLowerCase().includes('300') && n.material_type === thick && n.name.includes('[Непідготовлений]')) ||
      (n.name.toLowerCase().includes('лист') && n.name.toLowerCase().includes('300') && n.material_type === thick && !n.name.includes('[Підготовлений]'))
    )
    
    if (rawNom) {
      console.log(`- Found existing raw/base nomenclature: "${rawNom.name}" (${rawNom.id})`)
      if (rawNom.name !== rawName) {
        console.log(`  Updating name to: "${rawName}"`)
        const { error: updErr } = await supabase
          .from('nomenclatures')
          .update({ name: rawName, material_type: thick })
          .eq('id', rawNom.id)
        if (updErr) console.error(`  Error renaming raw:`, updErr.message)
        rawNom.name = rawName
      }
    } else {
      console.log(`- Creating new raw nomenclature: "${rawName}"`)
      const { data: created, error: crErr } = await supabase
        .from('nomenclatures')
        .insert([{
          name: rawName,
          material_type: thick,
          type: 'raw'
        }])
        .select()
        .single()
        
      if (crErr) {
        console.error(`  Error creating raw:`, crErr.message)
        continue
      }
      rawNom = created
    }
    
    // 2. Find or create prepared sheet nomenclature
    let prepNom = currentNoms.find(n => 
      n.name.toLowerCase().includes('лист') && n.name.toLowerCase().includes('300') && n.material_type === thick && n.name.includes('[Підготовлений]')
    )
    
    if (prepNom) {
      console.log(`- Found existing prep nomenclature: "${prepNom.name}" (${prepNom.id})`)
    } else {
      console.log(`- Creating new prep nomenclature: "${prepName}"`)
      const { data: created, error: crErr } = await supabase
        .from('nomenclatures')
        .insert([{
          name: prepName,
          material_type: thick,
          type: 'raw'
        }])
        .select()
        .single()
        
      if (crErr) {
        console.error(`  Error creating prep:`, crErr.message)
        continue
      }
      prepNom = created
    }
    
    // 3. Link Prep -> Raw in bom_items
    console.log(`- Linking BOM: ${prepNom.name} -> ${rawNom.name}`)
    await supabase.from('bom_items').delete().eq('parent_id', prepNom.id)
    const { error: bomErr } = await supabase.from('bom_items').insert([{
      parent_id: prepNom.id,
      child_id: rawNom.id,
      quantity_per_parent: 1
    }])
    if (bomErr) console.error(`  Error linking BOM:`, bomErr.message)
    
    // 4. Update inventory records
    const relevantInvs = currentInvs.filter(i => 
      i.name.toLowerCase().includes('лист') && i.name.toLowerCase().includes('300') && 
      (i.name.includes(thick) || i.name.includes(thick.replace('мм','')))
    )
    
    for (const inv of relevantInvs) {
      if (inv.warehouse === 'production') {
        console.log(`- Updating SV inventory "${inv.name}" (${inv.id}) -> "${rawName}" (NomID: ${rawNom.id})`)
        const { error: updErr } = await supabase
          .from('inventory')
          .update({
            name: rawName,
            nomenclature_id: rawNom.id
          })
          .eq('id', inv.id)
        if (updErr) console.error(`  Error updating SV inventory:`, updErr.message)
      } else if (inv.warehouse === 'operational') {
        console.log(`- Updating SO inventory "${inv.name}" (${inv.id}) -> "${prepName}" (NomID: ${prepNom.id})`)
        const { error: updErr } = await supabase
          .from('inventory')
          .update({
            name: prepName,
            nomenclature_id: prepNom.id
          })
          .eq('id', inv.id)
        if (updErr) console.error(`  Error updating SO inventory:`, updErr.message)
      }
    }
  }

  console.log("\nMigration completed successfully.")
}

run()
