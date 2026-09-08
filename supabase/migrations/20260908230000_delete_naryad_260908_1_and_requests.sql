-- ═══════════════════════════════════════════════════════════════════════════
-- 🗑️ ВИДАЛЕННЯ НАРЯДУ №260908-1 ТА НЕКОРЕКТНОГО ЗАПИТУ НА СКЛАД
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Видалити помилковий запит на комплектацію (Карбонова пластина Т700 500*600 7мм — 87 од.)
-- 2. Видалити всі робочі картки (work_cards) та історію по наряду №260908-1
-- 3. Видалити сам наряд (task) №260908-1
-- 4. Повернути замовлення в статус 'pending', щоб майстер міг переформувати наряд на ЛИСТИ.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_task_ids UUID[];
  v_order_ids UUID[];
  v_card_ids UUID[];
BEGIN
  -- 1. Знаходимо ID замовлення за номером 260908-1
  SELECT ARRAY_AGG(id) INTO v_order_ids
  FROM public.orders
  WHERE order_num ILIKE '%260908-1%';

  -- 2. Знаходимо всі пов'язані завдання (Розкрій, Пакування тощо)
  SELECT ARRAY_AGG(id) INTO v_task_ids
  FROM public.tasks
  WHERE order_id = ANY(v_order_ids)
     OR id IN (SELECT task_id FROM public.material_requests WHERE details ILIKE '%260908-1%');

  -- 2. Знаходимо робочі картки
  SELECT ARRAY_AGG(id) INTO v_card_ids
  FROM public.work_cards
  WHERE task_id = ANY(v_task_ids)
     OR order_id = ANY(v_order_ids);

  -- 3. Видаляємо зв'язані сутності
  -- 3.1. Запити матеріалів (включаючи запит на 87 од. карбонових пластин)
  DELETE FROM public.material_requests
  WHERE task_id = ANY(v_task_ids)
     OR order_id = ANY(v_order_ids)
     OR details ILIKE '%260908-1%'
     OR (quantity = 87 AND created_at > NOW() - INTERVAL '2 hours');

  -- 3.2. Резервації БЗ та рухи
  DELETE FROM public.bz_inventory_reservations
  WHERE task_id = ANY(v_task_ids)
     OR order_id = ANY(v_order_ids);

  -- 3.3. Історія карток та брак
  IF v_card_ids IS NOT NULL AND array_length(v_card_ids, 1) > 0 THEN
    DELETE FROM public.work_card_history WHERE card_id = ANY(v_card_ids);
    DELETE FROM public.work_card_scrap_totals WHERE card_id = ANY(v_card_ids);
  END IF;

  IF v_task_ids IS NOT NULL AND array_length(v_task_ids, 1) > 0 THEN
    DELETE FROM public.work_card_scrap_totals WHERE task_id = ANY(v_task_ids);
  END IF;

  -- 3.4. Робочі картки
  DELETE FROM public.work_cards
  WHERE task_id = ANY(v_task_ids)
     OR order_id = ANY(v_order_ids);

  -- 3.5. Самі завдання (наряди)
  DELETE FROM public.tasks
  WHERE id = ANY(v_task_ids);

  -- 5. Повертаємо замовлення у статус очікування формування наряду
  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    UPDATE public.orders
    SET status = 'pending'
    WHERE id = ANY(v_order_ids);
  END IF;

  RAISE NOTICE 'Наряд 260908-1 та пов''язані запити успішно видалено.';
END $$;

-- ПІДТВЕРДЖЕННЯ:
SELECT count(*) AS remaining_tasks FROM public.tasks WHERE order_id IN (SELECT id FROM public.orders WHERE order_num ILIKE '%260908-1%');
SELECT count(*) AS remaining_requests FROM public.material_requests WHERE details ILIKE '%260908-1%';
