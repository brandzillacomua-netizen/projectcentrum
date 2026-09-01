import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: requests } = await supabase.from('material_requests').select('*').eq('status', 'pending')
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: inventory } = await supabase.from('inventory').select('*')

  const activeTab = 'raw'

  function getMaterialType(r) {
    if (r.details && (r.details.includes('ЗАПИТ НА КОМПЛЕКТУВАННЯ') || r.details.includes('ПАКУВАННЯ'))) return 'finished'
    const nom = r.nomenclature_id ? nomenclatures.find(n => String(n.id) === String(r.nomenclature_id)) : null
    if (nom?.type === 'part' || nom?.type === 'product') return 'finished'
    return 'raw'
  }

  const pendingRequests = (requests || []).filter(r => {
    if (r.status !== 'pending' && r.status !== 'issued') return false
    if (r.card_id) {
      const card = (workCards || []).find(c => String(c.id) === String(r.card_id))
      const isReissue = !!card && (card.is_rework || String(card.card_info || '').includes('[REDO]'))
      const isMachineChange = String(r.details || '').includes('[BALANCED_MACHINE_CHANGE]')
      const isCutterOrConsumable = (r.details || '').toLowerCase().includes('фреза') ||
        (r.details || '').includes('ВИТРАТНІ МАТЕРІАЛИ') ||
        (nomenclatures || []).find(n => String(n.id) === String(r.nomenclature_id))?.type === 'consumable'

      if (!isReissue && !isMachineChange && !isCutterOrConsumable) return false
    }
    return getMaterialType(r) === activeTab
  })

  console.log(`Found ${pendingRequests.length} pendingRequests for activeTab='raw':`)
  console.table(pendingRequests.map(r => ({
    id: r.id?.slice(0, 8),
    card_id: r.card_id?.slice(0, 8),
    task_id: r.task_id?.slice(0, 8),
    qty: r.quantity,
    details: r.details
  })))
}

main().catch(console.error)
