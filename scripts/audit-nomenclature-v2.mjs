import { createClient } from '@supabase/supabase-js'

const requiredEnv = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'AUDIT_EMAIL',
  'AUDIT_PASSWORD'
]

for (const key of requiredEnv) {
  if (!process.env[key]) throw new Error(`Missing ${key}`)
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const { error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.AUDIT_EMAIL,
  password: process.env.AUDIT_PASSWORD
})
if (authError) throw authError

const PAGE_SIZE = 1000

async function fetchAll(table, columns) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { rows: [], error: error.message }
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return { rows, error: null }
  }
}

const [v1Result, v2Result] = await Promise.all([
  fetchAll('nomenclatures', 'id,name'),
  fetchAll('nomenclatures_v2', 'id,name,code,status')
])
if (v1Result.error) throw new Error(v1Result.error)
if (v2Result.error) throw new Error(v2Result.error)

const normalizeName = value => String(value || '').trim().toLocaleLowerCase('uk-UA')
const v2Ids = new Set(v2Result.rows.map(row => String(row.id)))
const promotedCatalogIds = new Set([...v2Ids, ...v1Result.rows.map(row => String(row.id))])
const v1ById = new Map(v1Result.rows.map(row => [String(row.id), row]))
const v2ByName = new Map()

for (const row of v2Result.rows) {
  const key = normalizeName(row.name)
  if (!v2ByName.has(key)) v2ByName.set(key, [])
  v2ByName.get(key).push(row)
}

const catalog = {
  v1Rows: v1Result.rows.length,
  v2Rows: v2Result.rows.length,
  v1OnlyIds: 0,
  v1IdsMappedByUniqueName: 0,
  ambiguousV2Names: [...v2ByName.values()].filter(rows => rows.length > 1).length,
  inactiveV2Rows: v2Result.rows.filter(row => row.status && row.status !== 'active').length
}

for (const row of v1Result.rows) {
  if (v2Ids.has(String(row.id))) continue
  catalog.v1OnlyIds += 1
  if ((v2ByName.get(normalizeName(row.name)) || []).length === 1) {
    catalog.v1IdsMappedByUniqueName += 1
  }
}

const tableSpecs = [
  ['orders', ['nomenclature_id']],
  ['order_items', ['nomenclature_id']],
  ['tasks', ['nomenclature_id']],
  ['work_cards', ['nomenclature_id']],
  ['work_card_history', ['nomenclature_id']],
  ['inventory', ['nomenclature_id']],
  ['material_requests', ['nomenclature_id']],
  ['machine_operations', ['nomenclature_id']],
  ['packaging_boxes', ['nomenclature_id']],
  ['scrap_classifications', ['nomenclature_id']],
  ['work_card_scrap_totals', ['nomenclature_id']],
  ['work_card_flow_totals', ['nomenclature_id']],
  ['vkya_restoration_cards', ['nomenclature_id']],
  ['vkya_restoration_reclassifications', ['nomenclature_id']],
  ['vkya_quality_hold_events', ['nomenclature_id']],
  ['cutter_restoration_batches', ['nomenclature_id']],
  ['cutter_restoration_events', ['nomenclature_id']],
  ['manual_inventory_issues', ['nomenclature_id']],
  ['bz_inventory_reservations', ['nomenclature_id']],
  ['bz_inventory_ledger', ['nomenclature_id']],
  ['inventory_stock_v2', ['nomenclature_id']],
  ['bom_items', ['parent_id', 'child_id']]
]

const references = []
for (const [table, columns] of tableSpecs) {
  const selection = ['id', ...columns].join(',')
  const result = await fetchAll(table, selection)
  if (result.error) {
    references.push({ table, unavailable: result.error })
    continue
  }

  for (const column of columns) {
    const populated = result.rows.filter(row => row[column])
    const nonV2 = populated.filter(row => !v2Ids.has(String(row[column])))
    const nonV2AfterPromotingV1 = populated.filter(row => !promotedCatalogIds.has(String(row[column])))
    const resolvable = nonV2.filter(row => {
      const legacy = v1ById.get(String(row[column]))
      return legacy && (v2ByName.get(normalizeName(legacy.name)) || []).length === 1
    })
    references.push({
      table,
      column,
      rows: result.rows.length,
      populated: populated.length,
      nonV2: nonV2.length,
      nonV2AfterPromotingV1: nonV2AfterPromotingV1.length,
      resolvableByUniqueName: resolvable.length,
      sampleIds: [...new Set(nonV2.slice(0, 5).map(row => String(row[column])))]
    })
  }
}

const tasksResult = await fetchAll('tasks', 'id,plan_snapshot')
let taskSnapshotKeys = null
if (!tasksResult.error) {
  let uuidKeys = 0
  let nonV2Keys = 0
  let resolvableKeys = 0
  for (const task of tasksResult.rows) {
    const snapshot = task.plan_snapshot
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) continue
    for (const key of Object.keys(snapshot)) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) continue
      uuidKeys += 1
      if (v2Ids.has(key)) continue
      nonV2Keys += 1
      const legacy = v1ById.get(key)
      if (legacy && (v2ByName.get(normalizeName(legacy.name)) || []).length === 1) {
        resolvableKeys += 1
      }
    }
  }
  taskSnapshotKeys = { tasks: tasksResult.rows.length, uuidKeys, nonV2Keys, resolvableKeys }
}

const canonicalId = id => {
  const value = String(id || '')
  if (v2Ids.has(value)) return value
  const legacy = v1ById.get(value)
  const matches = legacy ? (v2ByName.get(normalizeName(legacy.name)) || []) : []
  return matches.length === 1 ? String(matches[0].id) : value
}

const uniqueSpecs = [
  ['work_card_scrap_totals', ['card_id', 'nomenclature_id']],
  ['work_card_flow_totals', ['card_id', 'nomenclature_id', 'stage_name']],
  ['bz_inventory_reservations', ['operation_id', 'nomenclature_id']],
  ['cutter_restoration_batches', ['source_card_id', 'nomenclature_id']]
]
const canonicalizationCollisions = []
for (const [table, columns] of uniqueSpecs) {
  const result = await fetchAll(table, ['id', ...columns].join(','))
  if (result.error) {
    canonicalizationCollisions.push({ table, unavailable: result.error })
    continue
  }
  const seen = new Map()
  for (const row of result.rows) {
    const key = columns.map(column => column === 'nomenclature_id'
      ? canonicalId(row[column])
      : String(row[column] ?? '')).join('|')
    seen.set(key, (seen.get(key) || 0) + 1)
  }
  canonicalizationCollisions.push({
    table,
    rows: result.rows.length,
    collisionGroups: [...seen.values()].filter(count => count > 1).length
  })
}

console.log(JSON.stringify({ catalog, references, taskSnapshotKeys, canonicalizationCollisions }, null, 2))
