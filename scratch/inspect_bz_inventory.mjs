import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const { data: bzItems } = await supabase
    .from('inventory')
    .select('*')
    .eq('type', 'bz')
    .gt('total_qty', 0)

  console.log(`Active BZ inventory items in DB: ${bzItems?.length}`)
  console.log('Sample BZ items:', bzItems?.slice(0, 15))

  const { data: bzCards } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, quantity, card_info, created_at')
    .eq('operation', 'Склад БЗ')
    .order('created_at', { ascending: false })
    .limit(20)

  console.log(`Recent BZ work cards:`, bzCards)
}

check()
