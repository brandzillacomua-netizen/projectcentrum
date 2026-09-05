import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' }
  }
})

function normStr(str) {
  return str ? String(str).toLowerCase().replace(/[^a-z0-9а-яєіїґ]/g, '') : ''
}

function isRequestForCard(req, card, task, nom) {
  if (!req) return false
  if (req.card_id && String(req.card_id) === String(card.id)) return true
  if (String(req.task_id) !== String(card.task_id)) return false

  const reqDetailsNorm = normStr(req.details || '')
  const nomNameNorm = normStr(nom?.name || '')

  // 1. Check if request details explicitly mentions the part name
  if (nomNameNorm && reqDetailsNorm.includes(nomNameNorm)) {
    return true
  }

  // 2. Check task.plan_snapshot.materialSummary for sheets
  const matSummary = task?.plan_snapshot?.materialSummary || {}
  for (const [matKey, summary] of Object.entries(matSummary)) {
    if (String(summary.nomenclature_id) === String(req.nomenclature_id) || normStr(summary.matName) === normStr(req.details)) {
      const components = summary.components || []
      const matchesComponent = components.some(c => normStr(c).includes(nomNameNorm))
      if (matchesComponent) return true
      // If summary has components and NONE match this card, this request is definitely NOT for this card!
      if (components.length > 0) return false
    }
  }

  // 3. If request details explicitly mentions ANOTHER part in the task, it does NOT belong to this card
  const allTaskNomNames = Object.values(task?.plan_snapshot || {})
    .filter(p => p && typeof p === 'object' && p.name)
    .map(p => normStr(p.name))
  const mentionsOtherPart = allTaskNomNames.some(otherName => otherName !== nomNameNorm && otherName.length > 3 && reqDetailsNorm.includes(otherName))
  if (mentionsOtherPart) return false

  return true
}

async function test() {
  const { data: task } = await supabase.from('tasks').select('*').eq('id', '3f02455f-e512-44de-b2bb-4251b05d6556').single()
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', task.id)
  const { data: reqs } = await supabase.from('material_requests').select('*').eq('task_id', task.id)
  const { data: noms } = await supabase.from('nomenclatures').select('*')

  console.log('Testing cards matching:')
  const distinctNomIds = [...new Set(cards.map(c => c.nomenclature_id))]
  for (const nomId of distinctNomIds) {
    const card = cards.find(c => c.nomenclature_id === nomId)
    const nom = noms.find(n => n.id === nomId)
    console.log(`\n=== Card Nom: ${nom?.name} (id: ${card.id.slice(0, 8)}) ===`)
    
    const matchedReqs = reqs.filter(r => isRequestForCard(r, card, task, nom))
    console.log(`Matched requests (${matchedReqs.length}/${reqs.length}):`)
    matchedReqs.forEach(r => {
      console.log(`  - [${r.status.toUpperCase()}] ${r.quantity} шт/л: ${r.details?.slice(0, 80)}`)
    })

    const pendingForThisCard = matchedReqs.filter(r => r.status === 'pending')
    console.log(`  >>> Pending for this card: ${pendingForThisCard.length}`)
  }
}

test().catch(console.error)
