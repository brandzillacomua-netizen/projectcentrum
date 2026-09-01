import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function cleanNotesInDb() {
  const { data: customers } = await supabase.from('customers').select('*')
  for (const c of (customers || [])) {
    if (c.notes && (c.notes.includes('[DELIVERY_ADDRESSES_') || c.notes.includes(']'))) {
      let clean = c.notes
        .replace(/\[DELIVERY_ADDRESSES_JSON:[\s\S]*$/, '')
        .replace(/\[DELIVERY_ADDRESSES_B64:[\s\S]*$/, '')
        .replace(/\]+/g, '')
        .trim()

      console.log(`Cleaning notes for customer ${c.name}: "${c.notes}" -> "${clean}"`)
      await supabase.from('customers').update({ notes: clean }).eq('id', c.id)
    }
  }
  console.log('Finished cleaning notes!')
}

cleanNotesInDb().catch(console.error)
