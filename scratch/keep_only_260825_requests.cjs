const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log("=== KEEPING ONLY 260825-1 PACKAGING REQUESTS ON SGP ===")

  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  })

  // 1. Fetch all packaging requests
  let allReqs = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('material_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + 999)
    if (error) { console.error(error); break }
    if (!data || data.length === 0) break
    allReqs = allReqs.concat(data)
    if (data.length < 1000) break
    from += 1000
  }

  const isPackaging = (r) => {
    if (!r || !r.details) return false
    const d = r.details.toUpperCase()
    return (
      d.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') ||
      d.includes('КОМПЛЕКТУВАННЯ') ||
      d.includes('ПАКУВАННЯ') ||
      d.includes('PACKAGING_SOURCE')
    )
  }

  const packReqs = allReqs.filter(isPackaging)
  console.log(`Total packaging requests in system: ${packReqs.length}`)

  // Identify the target 260825-1 requests
  const targetReqs = packReqs.filter(r => (r.details || '').includes('260825-1'))
  const otherPackReqs = packReqs.filter(r => !(r.details || '').includes('260825-1'))

  console.log(`Target 260825-1 requests to KEEP: ${targetReqs.length}`)
  console.log(`Other packaging requests to DELETE: ${otherPackReqs.length}`)

  // 2. Delete all other packaging requests
  if (otherPackReqs.length > 0) {
    const idsToDelete = otherPackReqs.map(r => r.id)
    for (let i = 0; i < idsToDelete.length; i += 50) {
      const batch = idsToDelete.slice(i, i + 50)
      const { error: delErr } = await supabase.from('material_requests').delete().in('id', batch)
      if (delErr) console.error("Error deleting batch:", delErr)
    }
    console.log(`Successfully deleted ${otherPackReqs.length} other packaging requests.`)
  }

  // 3. Make sure the 7 target requests are in 'pending' status
  if (targetReqs.length > 0) {
    const targetIds = targetReqs.map(r => r.id)
    const { error: updateErr } = await supabase
      .from('material_requests')
      .update({ status: 'pending' })
      .in('id', targetIds)
    if (updateErr) {
      console.error("Error setting target requests to pending:", updateErr)
    } else {
      console.log(`Successfully updated ${targetIds.length} target requests to 'pending' status.`)
    }
  }

  // 4. Verify what remains
  const { data: remainingReqs } = await supabase
    .from('material_requests')
    .select('id,status,details,quantity')
  
  const remainingPack = (remainingReqs || []).filter(isPackaging)
  console.log(`\nVerification: Remaining packaging requests on SGP: ${remainingPack.length}`)
  remainingPack.forEach(r => {
    console.log(`- [${r.status}] ${r.details}`)
  })
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
