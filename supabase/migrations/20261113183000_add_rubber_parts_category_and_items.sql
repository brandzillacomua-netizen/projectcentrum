-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 MIGRATION: Add Rubber Parts Category (HW.RUBBER) and 20 Verified Items
-- Source of truth: b:\ЗАГРУЗКИ З ГУГЛА\ГУМА.xlsx
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_parent_id UUID;
  v_group_id UUID;
  v_raw_2mm_id UUID;
  v_raw_4mm_id UUID;
  v_max_num INT;
  v_next_code TEXT;

  -- Array of items to insert
  -- format: (name, part_size, sheet_size, raw_code, thickness, yield, time_sec, item_time_sec)
  v_items RECORD;
BEGIN
  -- 1. Find parent group UUID for HW (02. Комплектуючі та Метизи)
  SELECT id INTO v_parent_id 
  FROM public.nomenclature_catalog_groups 
  WHERE code = 'HW' 
  LIMIT 1;

  -- 2. Upsert 'HW.RUBBER' group into nomenclature_catalog_groups
  SELECT id INTO v_group_id 
  FROM public.nomenclature_catalog_groups 
  WHERE code = 'HW.RUBBER' 
  LIMIT 1;

  IF v_group_id IS NULL THEN
    INSERT INTO public.nomenclature_catalog_groups (
      code, name, parent_id, sort_order
    ) VALUES (
      'HW.RUBBER',
      'Гумові вироби',
      v_parent_id,
      28
    )
    RETURNING id INTO v_group_id;
  ELSE
    UPDATE public.nomenclature_catalog_groups
    SET name = 'Гумові вироби',
        parent_id = COALESCE(parent_id, v_parent_id),
        sort_order = 28
    WHERE id = v_group_id;
  END IF;

  -- 3. Fetch raw material IDs
  SELECT id INTO v_raw_2mm_id FROM public.nomenclatures_v2 WHERE code = 'V2-90030' LIMIT 1;
  SELECT id INTO v_raw_4mm_id FROM public.nomenclatures_v2 WHERE code = 'V2-90031' LIMIT 1;

  -- Fallback to default raw IDs if not found by code
  IF v_raw_2mm_id IS NULL THEN
    v_raw_2mm_id := '1750f935-ef90-42f1-b4be-6d7cff8ac25c'::uuid;
  END IF;
  IF v_raw_4mm_id IS NULL THEN
    v_raw_4mm_id := 'fa29e490-cc05-4ca0-9ab3-2f9897e402e1'::uuid;
  END IF;

  -- 4. Determine next sequential V2 number (at least 90825)
  SELECT COALESCE(MAX(SUBSTRING(code FROM '^V2-([0-9]+)$')::integer), 90825)
  INTO v_max_num
  FROM public.nomenclatures_v2
  WHERE code ~ '^V2-[0-9]+$';

  IF v_max_num < 90825 THEN
    v_max_num := 90825;
  END IF;

  -- 5. Insert 20 verified rubber parts
  FOR v_items IN
    SELECT * FROM (VALUES
      ('Гума листова 58×9,16×2', '58×9,16×2', '500*500*2', 'V2-90030', 2, 512, 625, 1.22),
      ('Гума листова 58×9,16×4', '58×9,16×4', '500*500*4', 'V2-90031', 4, 512, 625, 1.22),
      ('Гума листова 52×8×2', '52×8×2', '500*500*2', 'V2-90030', 2, 589, 481, 0.82),
      ('Гума листова 52×8×4', '52×8×4', '500*500*4', 'V2-90031', 4, 589, 481, 0.82),
      ('Гума листова 85,75×8×2', '85,75×8×2', '500*500*2', 'V2-90030', 2, 350, 458, 1.31),
      ('Гума листова 85,75×8×4', '85,75×8×4', '500*500*4', 'V2-90031', 4, 350, 458, 1.31),
      ('Гума листова 45×6,5×2', '45×6,5×2', '500*500*2', 'V2-90030', 2, 836, 572, 0.68),
      ('Гума листова 45×6,5×4', '45×6,5×4', '500*500*4', 'V2-90031', 4, 836, 572, 0.68),
      ('Гума листова 40×23×2', '40×23×2', '500*500*2', 'V2-90030', 2, 336, 1863, 5.54),
      ('Гума листова 40×23×4', '40×23×4', '500*500*4', 'V2-90031', 4, 336, 1863, 5.54),
      ('Гума листова 40×9×2', '40×9×2', '500*500*2', 'V2-90030', 2, 768, 762, 0.99),
      ('Гума листова 40×9×4', '40×9×4', '500*500*4', 'V2-90031', 4, 768, 762, 0.99),
      ('Гума листова 110×44,3×2', '110×44,3×2', '500*500*2', 'V2-90030', 2, 55, 0, 0.0),
      ('Гума листова 110×44,3×4', '110×44,3×4', '500*500*4', 'V2-90031', 4, 55, 0, 0.0),
      ('Гума листова 52×32×2', '52×32×2', '500*500*2', 'V2-90030', 2, 135, 0, 0.0),
      ('Гума листова 52×32×4', '52×32×4', '500*500*4', 'V2-90031', 4, 135, 0, 0.0),
      ('Гума листова 128,34×29,95×2', '128,34×29,95×2', '500*500*2', 'V2-90030', 2, 57, 590, 10.35),
      ('Гума листова 128,34×29,95×4', '128,34×29,95×4', '500*500*4', 'V2-90031', 4, 57, 590, 10.35),
      ('Гума листова 55×84×100', '55×84×100', '500*500*4', 'V2-90031', 4, 40, 614, 15.35),
      ('Гума листова 46×151×4', '46*151', '500*500*4', 'V2-90031', 4, 30, 0, 0.0)
    ) AS t(item_name, part_size, sheet_size, raw_code, thickness, sheet_yield, time_sec, item_time_sec)
  LOOP
    -- Check if item with this name already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.nomenclatures_v2 
      WHERE lower(btrim(name)) = lower(btrim(v_items.item_name))
    ) THEN
      v_max_num := v_max_num + 1;
      v_next_code := 'V2-' || v_max_num;

      INSERT INTO public.nomenclatures_v2 (
        code,
        barcode,
        qr_code,
        name,
        group_id,
        unit,
        rule_type,
        rule_params,
        default_material_id,
        status,
        created_at,
        updated_at
      ) VALUES (
        v_next_code,
        v_next_code,
        v_next_code,
        v_items.item_name,
        COALESCE(v_group_id::text, 'grp_rubber_parts'),
        'шт',
        'rubber_part',
        jsonb_build_object(
          'part_size', v_items.part_size,
          'program_name', v_items.part_size,
          'sheet_size', v_items.sheet_size,
          'thickness', v_items.thickness,
          'sheet_yield', v_items.sheet_yield,
          'units_per_sheet', v_items.sheet_yield,
          'sheet_cutting_time_sec', v_items.time_sec,
          'item_cutting_time_sec', v_items.item_time_sec,
          'raw_material_code', v_items.raw_code,
          'raw_material_id', CASE WHEN v_items.raw_code = 'V2-90030' THEN v_raw_2mm_id ELSE v_raw_4mm_id END
        ),
        CASE WHEN v_items.raw_code = 'V2-90030' THEN v_raw_2mm_id ELSE v_raw_4mm_id END,
        'active',
        clock_timestamp(),
        clock_timestamp()
      );
    END IF;
  END LOOP;
END $$;
