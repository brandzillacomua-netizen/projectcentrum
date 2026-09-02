import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: user, error: getErr } = await supabase
    .from('system_users')
    .select('id, login, access_rights')
    .ilike('last_name', '%пілецьк%')
    .single()

  if (getErr || !user) {
    console.error('User not found:', getErr)
    return
  }

  const updatedRights = {
    ...user.access_rights,
    crm: true,
    crm_clients: true,
    dashboard: true,
    manager: true,
    kanban: true,
    chat: true,
    director: true,
    master: true,
    foreman: true,
    foreman2: true,
    warehouse: true,
    warehouse_fgp: true,
    warehouse_boxes: true,
    engineer: true,
    engineer_v2: true,
    economy: true,
    shipping: true,
    supply: true,
    procurement: true,
    nomenclature: true,
    nomenclature_v2: true,
    shop1: true,
    shop2: true,
    shop2_card_gen: true,
    shop2_terminal: true,
    machines: true,
    reports: true,
    analytics: true,
    brak: true
  }

  const { data: updated, error: updateErr } = await supabase
    .from('system_users')
    .update({ access_rights: updatedRights })
    .eq('id', user.id)
    .select()

  if (updateErr) {
    console.error('Update error:', updateErr)
  } else {
    console.log('Successfully updated Roman Piletsky access_rights:', updated[0]?.login)
  }
}

main().catch(console.error)
