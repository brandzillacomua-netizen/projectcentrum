-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 FIX: Видалення застарілих FK constraints, що посилаються на nomenclatures (V1)
--         та оновлення зв'язку work_cards -> nomenclatures_v2
-- ═══════════════════════════════════════════════════════════════════════════
-- Проблема:
-- При генерації робочих карток (work_cards) для деталей наряду виникає помилка:
-- "insert or update on table "work_cards" violates foreign key constraint "work_cards_nomenclature_id_fkey""
-- Причина:
-- Таблиця work_cards (та інші суміжні таблиці) все ще тримали старий foreign key constraint,
-- який вимагав наявності ID у старій таблиці public.nomenclatures (V1),
-- тоді як система вже працює на новій public.nomenclatures_v2.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Знаходимо та видаляємо ВСІ зовнішні ключі (FK), які досі посилаються на стару таблицю nomenclatures
  FOR r IN
    SELECT 
      conrelid::regclass::text AS tbl_name,
      conname AS fk_name
    FROM pg_constraint
    WHERE confrelid = 'public.nomenclatures'::regclass
      AND contype = 'f'
  LOOP
    RAISE NOTICE 'Видаляємо застарілий FK: % на таблиці %', r.fk_name, r.tbl_name;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl_name, r.fk_name);
  END LOOP;
END;
$$;

-- 2. Явно гарантуємо зняття обмеження з work_cards та work_card_history
ALTER TABLE public.work_cards DROP CONSTRAINT IF EXISTS work_cards_nomenclature_id_fkey;
ALTER TABLE public.work_card_history DROP CONSTRAINT IF EXISTS work_card_history_nomenclature_id_fkey;
ALTER TABLE public.material_requests DROP CONSTRAINT IF EXISTS material_requests_nomenclature_id_fkey;

-- 3. Додаємо новий зв'язок work_cards -> nomenclatures_v2(id)
-- Використовуємо NOT VALID, щоб не блокувати історичні записи зі старими UUID
DO $$
BEGIN
  ALTER TABLE public.work_cards
    ADD CONSTRAINT work_cards_nomenclature_id_fkey
      FOREIGN KEY (nomenclature_id)
      REFERENCES public.nomenclatures_v2(id)
      ON DELETE SET NULL
      NOT VALID;
  RAISE NOTICE 'Успішно додано FK work_cards -> nomenclatures_v2';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK work_cards_nomenclature_id_fkey вже існує або: %', SQLERRM;
END;
$$;

-- 4. Перевірка: виводимо залишок FK на стару таблицю nomenclatures
SELECT 
  conrelid::regclass AS table_with_legacy_fk,
  conname AS constraint_name
FROM pg_constraint
WHERE confrelid = 'public.nomenclatures'::regclass;
