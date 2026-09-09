// Phase 1 supports offline calculation only. No environment/global state is read.
export const DEFAULT_FLAGS = Object.freeze({
  shop1_inventory_shadow: false,
  shop1_sheet_reservation_v2: false,
  shop1_sheet_consumption_v2: false,
  shop1_cutter_reservation_v2: false,
  shop1_cutter_consumption_v2: false,
});

export function resolveFlags(overrides = {}) {
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in DEFAULT_FLAGS) || typeof value !== 'boolean') throw new Error('Invalid feature flag');
    if (key !== 'shop1_inventory_shadow' && value) throw new Error('Live inventory writes are unavailable in Phase 1');
  }
  return Object.freeze({ ...DEFAULT_FLAGS, ...overrides });
}
