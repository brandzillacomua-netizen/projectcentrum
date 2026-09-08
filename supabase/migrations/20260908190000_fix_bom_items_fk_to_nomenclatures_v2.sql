-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 FIX: bom_items FK → nomenclatures_v2
-- Крок 1: Очищуємо старі BOM записи де child_id або parent_id не існують в nomenclatures_v2
-- Крок 2: Перепризначаємо FK на nomenclatures_v2
-- ═══════════════════════════════════════════════════════════════════════════

-- ДІАГНОСТИКА: Показати скільки рядків будуть видалені
SELECT
  COUNT(*) FILTER (WHERE child_id NOT IN (SELECT id FROM public.nomenclatures_v2))  AS orphan_child_count,
  COUNT(*) FILTER (WHERE parent_id NOT IN (SELECT id FROM public.nomenclatures_v2)) AS orphan_parent_count,
  COUNT(*) AS total_bom_rows
FROM public.bom_items;

-- КРОК 1: Видалити bom_items де child_id або parent_id не існує в nomenclatures_v2
-- (це старі V1 записи, вони вже не актуальні)
DELETE FROM public.bom_items
WHERE child_id NOT IN (SELECT id FROM public.nomenclatures_v2)
   OR parent_id NOT IN (SELECT id FROM public.nomenclatures_v2);

-- КРОК 2: Видаляємо всі старі FK constraints на bom_items
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.bom_items'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.bom_items DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- КРОК 3: Додаємо нові FK що посилаються на nomenclatures_v2
ALTER TABLE public.bom_items
  ADD CONSTRAINT bom_items_child_id_fkey
    FOREIGN KEY (child_id)
    REFERENCES public.nomenclatures_v2(id)
    ON DELETE CASCADE;

ALTER TABLE public.bom_items
  ADD CONSTRAINT bom_items_parent_id_fkey
    FOREIGN KEY (parent_id)
    REFERENCES public.nomenclatures_v2(id)
    ON DELETE CASCADE;

-- КРОК 4: Індекси для продуктивності
CREATE INDEX IF NOT EXISTS idx_bom_items_parent_id ON public.bom_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_child_id  ON public.bom_items(child_id);

-- ПІДТВЕРДЖЕННЯ: Показати кількість залишених BOM записів
SELECT COUNT(*) AS remaining_bom_rows FROM public.bom_items;
