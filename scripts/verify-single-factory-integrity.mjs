import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function main() {
  console.log('🔍 Starting Single-Factory Integrity & Deduplication Check...\n')

  // 1. Check Inventory Table Deduplication
  console.log('📦 1. Checking inventory table for duplicate rows...')
  const { data: invRows, error: invErr } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, type, warehouse, total_qty')
    .not('nomenclature_id', 'is', null)

  if (invErr) {
    console.error('❌ Error reading inventory:', invErr.message)
  } else {
    const map = new Map()
    let duplicatesFound = 0

    ;(invRows || []).forEach(row => {
      const key = `${row.nomenclature_id}_${row.type}_${row.warehouse || 'production'}`
      if (map.has(key)) {
        duplicatesFound++
        console.warn(`  ⚠️ Duplicate found: ${row.name} [ID: ${row.nomenclature_id}] Type: ${row.type} WH: ${row.warehouse}`)
      } else {
        map.set(key, row)
      }
    })

    if (duplicatesFound === 0) {
      console.log('  ✅ PASSED: No duplicate inventory rows found for (nomenclature_id, type, warehouse)!')
    } else {
      console.warn(`  ⚠️ WARNING: Found ${duplicatesFound} legacy duplicate row(s). Run migration 20260918000001 to consolidate.`)
    }
  }

  // 2. Check RPC Functions
  console.log('\n⚡ 2. Verifying RPC functions availability...')
  const rpcs = [
    { name: 'rpc_handover_task_to_shop2_atomic', testParams: { p_task_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'rpc_handover_to_sgp_atomic', testParams: { p_card_id: '00000000-0000-0000-0000-000000000000' } },
    { name: 'rpc_submit_sorting_complete_atomic', testParams: { p_card_id: '00000000-0000-0000-0000-000000000000', p_good_qty: 0, p_scrap_qty: 0, p_rework_qty: 0, p_operator_name: 'test', p_shift_name: 'test' } }
  ]

  for (const rpc of rpcs) {
    const { data, error } = await supabase.rpc(rpc.name, rpc.testParams)
    if (error && error.code === '42883') {
      console.log(`  ❌ RPC ${rpc.name}: NOT INSTALLED in database (function does not exist).`)
    } else {
      console.log(`  ✅ RPC ${rpc.name}: INSTALLED and responsive!`)
    }
  }

  console.log('\n🏁 Single-Factory Integrity Check Completed.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
