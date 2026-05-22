import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function dumpString(s) {
  return s.split('').map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')
}

async function run() {
  const { data: noms } = await supabase.from('nomenclatures').select('id, name')
  const targets = ["F610-ІП24-Н-3-14", "КН-Нх10-F610-Х-2-12", "F610-ІП24-В-3-15", "F613-ІП47-П-10-22"]
  
  for (const t of targets) {
    console.log(`\nTarget: "${t}"`)
    const matches = noms.filter(n => {
      // Find closest matches by removing spaces and ignoring case, or using fuzzy matching
      const n1 = n.name.toLowerCase().replace(/[^a-z0-9а-яієґў]/g, '')
      const t1 = t.toLowerCase().replace(/[^a-z0-9а-яієґў]/g, '')
      return n1 === t1 || n.name.includes(t.substring(0, 5))
    })
    console.log(`Found ${matches.length} matches in DB:`)
    matches.forEach(m => {
      console.log(`- ID: ${m.id}\n  Name: "${m.name}"\n  Chars: ${dumpString(m.name)}`)
    })
  }
}

run()
