import { resolveFlags } from './flags.mjs';
import { planCuttingCompletion } from './cuttingPlan.mjs';

export function calculateShadow(snapshot, overrides = {}) {
  const flags = resolveFlags(overrides);
  if (!flags.shop1_inventory_shadow) return null;
  return planCuttingCompletion(snapshot);
}
