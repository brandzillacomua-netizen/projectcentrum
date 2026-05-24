import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log("Reverting accidental updates to parts/sheets...")
  
  // 1. Revert Part: ІП-72-F5-В-3-45 (ID: 258eef07-1f38-487d-9f90-3c2d5e52199c)
  await supabase.from('inventory').update({
    name: "ІП-72-F5-В-3-45 (Лист T300 (3мм))",
    nomenclature_id: "43a60844-3e54-448d-8d67-7658a040dc0a"
  }).eq('id', '258eef07-1f38-487d-9f90-3c2d5e52199c')

  // Find the migrated 7mm raw/prep IDs
  const { data: noms } = await supabase.from('nomenclatures').select('*')
  
  const raw7mm = noms.find(n => n.name === 'Лист Т300 (7мм) [Непідготовлений]')
  const prep7mm = noms.find(n => n.name === 'Лист Т300 (7мм) [Підготовлений]')
  const raw4mm = noms.find(n => n.name === 'Лист Т300 (4мм) [Непідготовлений]')
  const prep4mm = noms.find(n => n.name === 'Лист Т300 (4мм) [Підготовлений]')
  const raw3mm = noms.find(n => n.name === 'Лист Т300 (3мм) [Непідготовлений]')
  const prep3mm = noms.find(n => n.name === 'Лист Т300 (3мм) [Підготовлений]')

  // 2. Revert 7mm raw sheet in SV (ID: bfcbe6d6-01c0-41a5-90c7-bf563cb7d64b)
  if (raw7mm) {
    await supabase.from('inventory').update({
      name: "Лист Т300 (7мм) [Непідготовлений]",
      nomenclature_id: raw7mm.id
    }).eq('id', 'bfcbe6d6-01c0-41a5-90c7-bf563cb7d64b')
  }

  // 3. Revert 7mm prep sheet in SO (ID: ff1ead9e-9039-427f-acd1-5ce692dec3e1)
  if (prep7mm) {
    await supabase.from('inventory').update({
      name: "Лист Т300 (7мм) [Підготовлений]",
      nomenclature_id: prep7mm.id
    }).eq('id', 'ff1ead9e-9039-427f-acd1-5ce692dec3e1')
  }

  // 4. Revert 4mm raw sheet in SV (ID: 97892f70-2a99-4405-95f2-edea3cced37f)
  if (raw4mm) {
    await supabase.from('inventory').update({
      name: "Лист Т300 (4мм) [Непідготовлений]",
      nomenclature_id: raw4mm.id
    }).eq('id', '97892f70-2a99-4405-95f2-edea3cced37f')
  }

  console.log("Accidental updates reverted.")

  console.log("\nStarting clean sheet inventory migration...")
  const { data: currentInvs } = await supabase.from('inventory').select('*')
  
  const thicknesses = ['2мм', '3мм', '4мм', '5мм', '6мм', '7мм']
  
  for (const thick of thicknesses) {
    const rawName = `Лист Т300 (${thick}) [Непідготовлений]`
    const prepName = `Лист Т300 (${thick}) [Підготовлений]`
    
    const rNom = noms.find(n => n.name === rawName)
    const pNom = noms.find(n => n.name === prepName)
    
    if (!rNom || !pNom) {
      console.log(`Warning: Nomenclatures for ${thick} not found.`)
      continue
    }

    // Filter only type === 'raw' AND containing thick in name
    const relevantInvs = currentInvs.filter(i => 
      i.type === 'raw' &&
      i.name.toLowerCase().includes('лист') && 
      i.name.toLowerCase().includes('300') && 
      (i.name.includes(`(${thick})`) || i.name.includes(` ${thick}`) || i.name.includes(thick))
    )

    console.log(`\nThickness: ${thick} (Found ${relevantInvs.length} relevant inventory items)`)
    
    for (const inv of relevantInvs) {
      if (inv.warehouse === 'production') {
        console.log(`- Updating SV inventory "${inv.name}" (${inv.id}) -> "${rawName}" (NomID: ${rNom.id})`)
        const { error: updErr } = await supabase
          .from('inventory')
          .update({
            name: rawName,
            nomenclature_id: rNom.id
          })
          .eq('id', inv.id)
        if (updErr) console.error(`  Error updating:`, updErr.message)
      } else if (inv.warehouse === 'operational') {
        console.log(`- Updating SO inventory "${inv.name}" (${inv.id}) -> "${prepName}" (NomID: ${pNom.id})`)
        const { error: updErr } = await supabase
          .from('inventory')
          .update({
            name: prepName,
            nomenclature_id: pNom.id
          })
          .eq('id', inv.id)
        if (updErr) console.error(`  Error updating:`, updErr.message)
      }
    }
  }

  console.log("\nMigration completed successfully.")
}

run()
