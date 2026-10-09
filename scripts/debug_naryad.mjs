import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envText = fs.readFileSync('.env', 'utf8')
const env = {}
envText.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: cards, error } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, card_info')
    .ilike('card_info', '%261001-5%')

  console.log('Cards error:', error)
  console.log('Cards count for 261001-5:', cards?.length)

  if (!cards || cards.length === 0) return

  const nomGroup = {}
  cards.forEach(c => {
    if (!nomGroup[c.nomenclature_id]) nomGroup[c.nomenclature_id] = []
    nomGroup[c.nomenclature_id].push(c)
  })

  console.log('\n--- SUMMARY OF CARDS ---')
  for (const nid of Object.keys(nomGroup)) {
    const nomCards = nomGroup[nid]
    console.log(`\nNOM_ID: ${nid} - Total cards: ${nomCards.length}`)
    const cardSummary = {}
    nomCards.forEach(c => {
      const key = (c.operation || 'EMPTY') + ' | ' + c.status
      cardSummary[key] = (cardSummary[key] || 0) + (c.quantity || 0)
    })
    console.table(cardSummary)

    nomCards.forEach(c => {
      console.log(`  Card ${c.id}: op="${c.operation}", status="${c.status}", qty=${c.quantity}, used=${c.used_in_shop2_qty}, info="${c.card_info}"`)
    })
  }
}

main().catch(console.error)
