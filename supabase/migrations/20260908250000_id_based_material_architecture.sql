-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ARCHITECTURAL MILESTONE: ID-Based Relational ERP Core
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Додати поле default_material_id UUID у nomenclatures_v2
-- 2. Автоматично зв'язати кожну деталь розкрою з її точним робочим листом (СО) за ID
-- 3. Структурувати таблицю material_requests (категорія, цільовий склад)
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Стовпчик default_material_id у таблиці nomenclatures_v2
ALTER TABLE public.nomenclatures_v2 
  ADD COLUMN IF NOT EXISTS default_material_id UUID REFERENCES public.nomenclatures_v2(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nomenclatures_v2_default_material_id 
  ON public.nomenclatures_v2(default_material_id);

-- КРОК 2: Структурні стовпчики в material_requests
ALTER TABLE public.material_requests 
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS target_warehouse text DEFAULT 'operational';

CREATE INDEX IF NOT EXISTS idx_material_requests_category_wh 
  ON public.material_requests(target_warehouse, category);

-- КРОК 3: Автоматичний бекфіл зв'язків: Деталь -> ID Робочого Листа (СО)
DO $$
DECLARE
  rec RECORD;
  v_sheet_id UUID;
  v_grade TEXT;
  v_thick TEXT;
  v_raw_str TEXT;
  v_linked_count INT := 0;
BEGIN
  FOR rec IN
    SELECT 
      id, 
      name, 
      group_id,
      COALESCE(rule_params->>'rawSheet', rule_params->>'material', '') AS raw_sheet_param
    FROM public.nomenclatures_v2
    WHERE default_material_id IS NULL
      AND (
        group_id = 'cat_parts' 
        OR rule_type = 'frame_part'
        OR rule_params->>'rawSheet' IS NOT NULL
        OR name ILIKE 'Київ%'
        OR name ILIKE 'К-%'
        OR name ILIKE '%деталь%'
      )
  LOOP
    v_raw_str := rec.raw_sheet_param || ' ' || rec.name;

    -- Визначаємо марку карбону
    IF v_raw_str ILIKE '%Т700%' OR v_raw_str ILIKE '%T700%' THEN
      v_grade := 'Т700';
    ELSE
      v_grade := 'Т300';
    END IF;

    -- Визначаємо товщину
    v_thick := substring(v_raw_str from '\(([0-9]+(?:[.,][0-9]+)?)\s*мм\)');
    IF v_thick IS NULL THEN
      v_thick := substring(v_raw_str from '([0-9]+(?:[.,][0-9]+)?)\s*мм');
    END IF;
    IF v_thick IS NULL THEN
      v_thick := substring(v_raw_str from '-([0-9]+(?:[.,][0-9]+)?)$');
    END IF;

    IF v_thick IS NOT NULL THEN
      v_thick := replace(v_thick, ',', '.');
      
      -- Шукаємо робочий лист у nomenclatures_v2 за маркою і товщиною
      SELECT id INTO v_sheet_id
      FROM public.nomenclatures_v2
      WHERE (group_id = 'grp_prepared_sheets' OR name ILIKE 'Лист ' || v_grade || '%')
        AND name NOT ILIKE '%пластина%'
        AND name NOT ILIKE '%гума%'
        AND name NOT ILIKE '%непідготовлений%'
        AND (name ILIKE '%' || v_grade || '%')
        AND (
          substring(name from '\(([0-9]+(?:[.,][0-9]+)?)\s*мм\)') = v_thick
          OR substring(name from '([0-9]+(?:[.,][0-9]+)?)\s*мм') = v_thick
        )
      LIMIT 1;

      IF v_sheet_id IS NOT NULL THEN
        UPDATE public.nomenclatures_v2
        SET default_material_id = v_sheet_id,
            rule_params = jsonb_set(COALESCE(rule_params, '{}'::jsonb), '{default_material_id}', to_jsonb(v_sheet_id::text))
        WHERE id = rec.id;
        
        v_linked_count := v_linked_count + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Успішно пов''язано деталей з листами за ID: %', v_linked_count;
END $$;

-- КРОК 4: Категоризація існуючих запитів на склад
UPDATE public.material_requests
SET category = 'sheet', target_warehouse = 'operational'
WHERE category IS NULL AND (details ILIKE '%лист%' OR details ILIKE '%склад оперативний%');

UPDATE public.material_requests
SET category = 'cutter', target_warehouse = 'operational'
WHERE category IS NULL AND (details ILIKE '%фрез%');

UPDATE public.material_requests
SET category = 'prep', target_warehouse = 'sv'
WHERE category IS NULL AND (details ILIKE '%підготов%');

UPDATE public.material_requests
SET category = 'hardware', target_warehouse = 'sgp'
WHERE category IS NULL AND (details ILIKE '%комплектування%' OR details ILIKE '%пакування%');

-- ПІДТВЕРДЖЕННЯ РЕЗУЛЬТАТІВ:
SELECT 
  COUNT(*) FILTER (WHERE default_material_id IS NOT NULL) AS parts_with_sheet_id,
  COUNT(*) FILTER (WHERE default_material_id IS NULL) AS parts_without_sheet_id
FROM public.nomenclatures_v2
WHERE group_id = 'cat_parts' OR rule_type = 'frame_part';
