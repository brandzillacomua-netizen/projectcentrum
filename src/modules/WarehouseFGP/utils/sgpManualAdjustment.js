/**
 * Resolves actor metadata from currentUser and records any total_qty delta
 * through the atomic `adjust_inventory_manually` RPC so all SGP additions
 * and edits appear in the manual adjustment journal and stock analysis modal.
 */
export function resolveAdjustmentActor(currentUser) {
  const fullName = [currentUser?.first_name, currentUser?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  const actorName = fullName || currentUser?.full_name || currentUser?.name || currentUser?.login || 'Користувач СГП'
  const numericId = Number(currentUser?.id)
  const actorId = Number.isFinite(numericId) ? numericId : null
  return { actorId, actorName }
}

export async function recordManualInventoryDelta({
  supabase,
  inventoryId,
  oldTotal = 0,
  newTotal = 0,
  currentUser = null,
  reason = 'Ручна корекція на СГП',
  sourceModule = 'warehouse_fgp'
}) {
  const prev = Number(oldTotal) || 0
  const next = Number(newTotal) || 0
  if (next < 0) {
    throw new Error('Залишок не може бути відʼємним.')
  }
  if (!inventoryId || next === prev) return null

  const action = next > prev ? 'add' : 'subtract'
  const deltaQty = Math.abs(next - prev)
  const { actorId, actorName } = resolveAdjustmentActor(currentUser)

  const { data, error } = await supabase.rpc('adjust_inventory_manually', {
    p_inventory_id: inventoryId,
    p_action: action,
    p_delta_qty: deltaQty,
    p_actor_id: actorId,
    p_actor_name: actorName,
    p_reason: reason,
    p_source_module: sourceModule
  })

  if (error) throw error
  return data
}
