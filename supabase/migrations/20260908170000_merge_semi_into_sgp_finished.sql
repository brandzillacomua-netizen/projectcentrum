-- ==============================================================================
-- MIGRATION: 20260908170000_merge_semi_into_sgp_finished.sql
-- DESCRIPTION: Об'єднання залишків напівфабрикатів (semi, semi_shop2) у
--              Готову Продукцію (finished) на СГП (warehouse = 'sgp').
-- ==============================================================================

DO $$
DECLARE
  r RECORD;
  target_id UUID;
BEGIN
  -- 1. Для кожної позиції semi / semi_shop2:
  FOR r IN 
    SELECT id, name, total_qty, reserved_qty, unit 
    FROM inventory 
    WHERE type IN ('semi', 'semi_shop2')
  LOOP
    -- Шукаємо чи вже є готова продукція з такою ж назвою на СГП
    SELECT id INTO target_id 
    FROM inventory 
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(r.name)) 
      AND type = 'finished' 
      AND warehouse = 'sgp' 
    LIMIT 1;

    IF target_id IS NOT NULL THEN
      -- Додаємо залишок до існуючої готової продукції
      UPDATE inventory 
      SET total_qty = total_qty + COALESCE(r.total_qty, 0)
      WHERE id = target_id;

      -- Видаляємо дублюючий запис semi
      DELETE FROM inventory WHERE id = r.id;
    ELSE
      -- Якщо позиції не було на СГП, переводимо запис у finished на sgp
      UPDATE inventory 
      SET type = 'finished', warehouse = 'sgp' 
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
