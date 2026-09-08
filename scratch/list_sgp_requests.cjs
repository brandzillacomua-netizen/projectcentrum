const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function list() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  })

  // Fetch all material requests that match packaging
  // Paginate through all 2513 requests
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

  console.log(`Total material_requests fetched: ${allReqs.length}`)

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
  console.log(`Total packaging requests across entire table: ${packReqs.length}`)

  const groups = {}
  packReqs.forEach(r => {
    const match = (r.details || '').match(/ЗАПИТ НА КОМПЛЕКТУВАННЯ\s*\(([^)]+)\)/i) || (r.details || '').match(/для наряду\s+([^\s)]+)/i)
    const key = match ? match[1] : (r.order_num || r.order_id || 'UNKNOWN')
    if (!groups[key]) groups[key] = { key, count: 0, statuses: {}, items: [] }
    groups[key].count++
    groups[key].statuses[r.status] = (groups[key].statuses[r.status] || 0) + 1
    groups[key].items.push(r)
  })

  console.log("\nGroups found:")
  for (const k in groups) {
    const g = groups[k]
    console.log(`- Order/Naryad: "${k}" | Total: ${g.count} | Statuses: ${JSON.stringify(g.statuses)}`)
  }
}

list().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
