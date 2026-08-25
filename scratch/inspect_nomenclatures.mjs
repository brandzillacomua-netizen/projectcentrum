import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspect() {
  const { data: testItems } = await supabase
    .from('nomenclatures')
    .select('*')
    .ilike('name', '%1488%')
  
  console.log('Items matching 1488 in nomenclatures:', testItems)

  const { data: allProds } = await supabase
    .from('nomenclatures')
    .select('id, name, type, created_at')
    .in('type', ['product', 'assembly'])

  console.log(`Total product/assembly items in nomenclatures: ${allProds?.length}`)

  // Group by name
  const nameCounts = {}
  allProds.forEach(p => {
    nameCounts[p.name] = (nameCounts[p.name] || 0) + 1
  })

  const duplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1)
  console.log(`Duplicate names count: ${duplicates.length}`)
  console.log('Sample duplicates:', duplicates.slice(0, 10))
}

inspect()
