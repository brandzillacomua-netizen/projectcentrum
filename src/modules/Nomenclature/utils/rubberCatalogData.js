/**
 * Master catalog data and utilities for Shop 2 Rubber Cutting (Порізка гуми)
 * Source of truth: b:\ЗАГРУЗКИ З ГУГЛА\ГУМА.xlsx (20 verified parts)
 */

export const RUBBER_GROUP_DEF = {
  id: 'grp_rubber_parts',
  code: 'HW.RUBBER',
  name: 'Гумові вироби',
  parent_id: 'cat_hw',
  sort_order: 28,
  rule_type: 'rubber_part'
};

export const RAW_RUBBER_SHEETS = {
  '2mm': {
    code: 'V2-90030',
    name: 'Гума еластична листова 500*500*2мм',
    dimensions: '500*500*2',
    thickness: 2
  },
  '4mm': {
    code: 'V2-90031',
    name: 'Гума еластична листова 500*500*4мм',
    dimensions: '500*500*4',
    thickness: 4
  }
};

export const VERIFIED_RUBBER_PARTS = [
  {
    part_size: '58×9,16×2',
    name: 'Гума листова 58×9,16×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 512,
    sheet_cutting_time_sec: 625,
    item_cutting_time_sec: 1.22
  },
  {
    part_size: '58×9,16×4',
    name: 'Гума листова 58×9,16×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 512,
    sheet_cutting_time_sec: 625,
    item_cutting_time_sec: 1.22
  },
  {
    part_size: '52×8×2',
    name: 'Гума листова 52×8×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 589,
    sheet_cutting_time_sec: 481,
    item_cutting_time_sec: 0.82
  },
  {
    part_size: '52×8×4',
    name: 'Гума листова 52×8×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 589,
    sheet_cutting_time_sec: 481,
    item_cutting_time_sec: 0.82
  },
  {
    part_size: '85,75×8×2',
    name: 'Гума листова 85,75×8×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 350,
    sheet_cutting_time_sec: 458,
    item_cutting_time_sec: 1.31
  },
  {
    part_size: '85,75×8×4',
    name: 'Гума листова 85,75×8×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 350,
    sheet_cutting_time_sec: 458,
    item_cutting_time_sec: 1.31
  },
  {
    part_size: '45×6,5×2',
    name: 'Гума листова 45×6,5×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 836,
    sheet_cutting_time_sec: 572,
    item_cutting_time_sec: 0.68
  },
  {
    part_size: '45×6,5×4',
    name: 'Гума листова 45×6,5×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 836,
    sheet_cutting_time_sec: 572,
    item_cutting_time_sec: 0.68
  },
  {
    part_size: '40×23×2',
    name: 'Гума листова 40×23×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 336,
    sheet_cutting_time_sec: 1863,
    item_cutting_time_sec: 5.54
  },
  {
    part_size: '40×23×4',
    name: 'Гума листова 40×23×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 336,
    sheet_cutting_time_sec: 1863,
    item_cutting_time_sec: 5.54
  },
  {
    part_size: '40×9×2',
    name: 'Гума листова 40×9×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 768,
    sheet_cutting_time_sec: 762,
    item_cutting_time_sec: 0.99
  },
  {
    part_size: '40×9×4',
    name: 'Гума листова 40×9×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 768,
    sheet_cutting_time_sec: 762,
    item_cutting_time_sec: 0.99
  },
  {
    part_size: '110×44,3×2',
    name: 'Гума листова 110×44,3×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 55,
    sheet_cutting_time_sec: 0,
    item_cutting_time_sec: 0
  },
  {
    part_size: '110×44,3×4',
    name: 'Гума листова 110×44,3×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 55,
    sheet_cutting_time_sec: 0,
    item_cutting_time_sec: 0
  },
  {
    part_size: '52×32×2',
    name: 'Гума листова 52×32×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 135,
    sheet_cutting_time_sec: 0,
    item_cutting_time_sec: 0
  },
  {
    part_size: '52×32×4',
    name: 'Гума листова 52×32×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 135,
    sheet_cutting_time_sec: 0,
    item_cutting_time_sec: 0
  },
  {
    part_size: '128,34×29,95×2',
    name: 'Гума листова 128,34×29,95×2',
    sheet_size: '500*500*2',
    raw_material_code: 'V2-90030',
    thickness: 2,
    sheet_yield: 57,
    sheet_cutting_time_sec: 590,
    item_cutting_time_sec: 10.35
  },
  {
    part_size: '128,34×29,95×4',
    name: 'Гума листова 128,34×29,95×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 57,
    sheet_cutting_time_sec: 590,
    item_cutting_time_sec: 10.35
  },
  {
    part_size: '55×84×100',
    name: 'Гума листова 55×84×100',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 40,
    sheet_cutting_time_sec: 614,
    item_cutting_time_sec: 15.35
  },
  {
    part_size: '46*151',
    name: 'Гума листова 46×151×4',
    sheet_size: '500*500*4',
    raw_material_code: 'V2-90031',
    thickness: 4,
    sheet_yield: 30,
    sheet_cutting_time_sec: 0,
    item_cutting_time_sec: 0
  }
];

/**
 * Ensures rubber group and 20 verified rubber items exist in Supabase.
 * Assigns next unique V2-XXXXX codes sequentially without collisions.
 */
export async function seedRubberPartsIfMissing(supabase, existingItems = []) {
  if (!supabase) return { count: 0, created: [] };

  try {
    // 1. Ensure rubber group in nomenclature_catalog_groups
    const { data: grpData } = await supabase
      .from('nomenclature_catalog_groups')
      .select('id, code')
      .eq('code', 'HW.RUBBER')
      .maybeSingle();

    let targetGroupId = grpData?.id || 'grp_rubber_parts';
    if (!grpData) {
      const { data: parentGrp } = await supabase
        .from('nomenclature_catalog_groups')
        .select('id')
        .eq('code', 'HW')
        .maybeSingle();

      const { data: insertedGrp } = await supabase
        .from('nomenclature_catalog_groups')
        .insert([{
          code: 'HW.RUBBER',
          name: 'Гумові вироби',
          parent_id: parentGrp?.id || null,
          sort_order: 28
        }])
        .select('id')
        .maybeSingle();

      if (insertedGrp?.id) {
        targetGroupId = insertedGrp.id;
      }
    }

    // 2. Fetch raw material sheet IDs
    const { data: rawSheets } = await supabase
      .from('nomenclatures_v2')
      .select('id, code')
      .in('code', ['V2-90030', 'V2-90031']);

    const rawMap = {};
    (rawSheets || []).forEach(s => {
      rawMap[s.code] = s.id;
    });

    // 3. Scan existing items to find next V2 code and existing rubber items
    let maxNum = 90000;
    const existingRubberNames = new Set();
    const existingRubberCodes = new Set();

    (existingItems || []).forEach(it => {
      const codeStr = String(it.code || '').trim();
      const m = codeStr.match(/^V2-(\d{5,6})$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum && n < 999999) maxNum = n;
      }
      if (it.name) existingRubberNames.add(String(it.name).trim().toLowerCase());
      if (it.code) existingRubberCodes.add(codeStr);
    });

    // Also double check DB for max code if existingItems was small
    if (existingItems.length < 50) {
      const { data: allV2 } = await supabase.from('nomenclatures_v2').select('code, name');
      (allV2 || []).forEach(it => {
        const codeStr = String(it.code || '').trim();
        const m = codeStr.match(/^V2-(\d{5,6})$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxNum && n < 999999) maxNum = n;
        }
        if (it.name) existingRubberNames.add(String(it.name).trim().toLowerCase());
        if (it.code) existingRubberCodes.add(codeStr);
      });
    }

    const itemsToInsert = [];
    let currentCodeNum = maxNum;

    for (const spec of VERIFIED_RUBBER_PARTS) {
      const normalizedName = spec.name.trim().toLowerCase();
      if (existingRubberNames.has(normalizedName)) {
        continue;
      }

      currentCodeNum++;
      const itemCode = `V2-${currentCodeNum}`;
      const defaultMatId = rawMap[spec.raw_material_code] || null;

      itemsToInsert.push({
        code: itemCode,
        barcode: itemCode,
        qr_code: itemCode,
        name: spec.name,
        group_id: targetGroupId,
        unit: 'шт',
        rule_type: 'rubber_part',
        rule_params: {
          part_size: spec.part_size,
          program_name: spec.part_size,
          sheet_size: spec.sheet_size,
          thickness: spec.thickness,
          sheet_yield: spec.sheet_yield,
          units_per_sheet: spec.sheet_yield,
          sheet_cutting_time_sec: spec.sheet_cutting_time_sec,
          item_cutting_time_sec: spec.item_cutting_time_sec,
          raw_material_code: spec.raw_material_code,
          raw_material_id: defaultMatId
        },
        default_material_id: defaultMatId,
        status: 'active'
      });
    }

    if (itemsToInsert.length === 0) {
      return { count: 0, created: [] };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('nomenclatures_v2')
      .insert(itemsToInsert)
      .select();

    if (insertErr) {
      console.warn('Error inserting rubber items:', insertErr);
      return { count: 0, error: insertErr };
    }

    return { count: inserted.length, created: inserted };
  } catch (err) {
    console.error('seedRubberPartsIfMissing failed:', err);
    return { count: 0, error: err };
  }
}

