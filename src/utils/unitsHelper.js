/**
 * Safely resolves the number of units per sheet (шт/л) for a nomenclature item.
 * Supports V1 nomenclatures (units_per_sheet), V2 nomenclatures (rule_params.unitsPerSheet or rule_params.units_per_sheet),
 * and parses standardized name suffix fallback (e.g. "RND-230-Верх-3-32" -> 32).
 */
export function getNomUnitsPerSheet(nom, snapshot = null) {
  if (nom) {
    // 1. Direct property: units_per_sheet or unitsPerSheet
    const direct = Number(nom.units_per_sheet || nom.unitsPerSheet);
    if (!isNaN(direct) && direct > 0) return direct;

    // 2. V2 rule_params: unitsPerSheet or units_per_sheet
    if (nom.rule_params && typeof nom.rule_params === 'object') {
      const rp = Number(nom.rule_params.unitsPerSheet || nom.rule_params.units_per_sheet);
      if (!isNaN(rp) && rp > 0) return rp;
    }

    // 3. Parse from standardized name suffix (e.g. "RND-230-Верх-3-32" -> 32, "RND-230-Промінь-правий-8-25" -> 25)
    if (nom.name && typeof nom.name === 'string') {
      const match = nom.name.trim().match(/-(\d+)$/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  }

  // 4. Check snapshot if nom failed or is missing
  if (snapshot) {
    const snapVal = Number(snapshot.units_per_sheet || snapshot.unitsPerSheet);
    if (!isNaN(snapVal) && snapVal > 0) {
      if (snapVal > 1 || !nom) return snapVal;
    }
  }

  return 1;
}
