-- ═══════════════════════════════════════════════════════════════════════════
-- 📦 MES CENTRUM: ATOMIC PACKAGING TASK SPLIT RPC
-- Процедура: rpc_split_packaging_task
-- Призначення: Розділення єдиного наряду пакування на окремі партії за графіком
--              з інтерактивним розподілом спакованого факту та миттєвим виходом
--              готових партій на відвантаження.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS rpc_split_packaging_task(UUID, JSONB, TEXT);

CREATE OR REPLACE FUNCTION rpc_split_packaging_task(
  p_parent_task_id UUID,
  p_splits JSONB,
  p_user_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent RECORD;
  v_order RECORD;
  v_split JSONB;
  v_idx INT := 0;
  v_batch_num INT;
  v_batch_index TEXT;
  v_quantity NUMERIC;
  v_deadline TEXT;
  v_packed_qty NUMERIC;
  v_is_packed BOOLEAN;
  v_new_meta JSONB;
  v_new_snapshot JSONB;
  v_created_task_ids UUID[] := ARRAY[]::UUID[];
  v_current_report JSONB;
  v_schedule JSONB;
  v_updated_schedule JSONB := '[]'::JSONB;
  v_sched_elem JSONB;
BEGIN
  -- 1. Перевірка вхідних даних
  IF p_parent_task_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_parent_task_id є обов''язковим');
  END IF;

  IF p_splits IS NULL OR jsonb_array_length(p_splits) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Для розділення потрібно щонайменше 2 партії в p_splits');
  END IF;

  -- 2. Блокування та зчитування батьківського наряду
  SELECT * INTO v_parent
  FROM tasks
  WHERE id = p_parent_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Наряд пакування не знайдено в БД');
  END IF;

  IF v_parent.step IS NOT NULL AND LOWER(v_parent.step) NOT LIKE '%пакув%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Наряд не належить до етапу Пакування: ' || COALESCE(v_parent.step, 'null'));
  END IF;

  -- 3. Зчитування замовлення
  SELECT * INTO v_order
  FROM orders
  WHERE id = v_parent.order_id
  FOR UPDATE;

  -- Зчитування існуючого batch_schedule з orders.report
  IF v_order.report IS NOT NULL AND v_order.report <> '' THEN
    BEGIN
      v_current_report := v_order.report::JSONB;
    EXCEPTION WHEN OTHERS THEN
      v_current_report := '{}'::JSONB;
    END;
  ELSE
    v_current_report := '{}'::JSONB;
  END IF;

  v_schedule := COALESCE(v_current_report->'batch_schedule', '[]'::JSONB);

  -- 4. Ітерація по масиву розбивки
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    v_batch_num := COALESCE((v_split->>'batch_num')::INT, v_idx + 1);
    v_batch_index := 'П' || v_batch_num;
    v_quantity := COALESCE((v_split->>'quantity')::NUMERIC, 0);
    v_deadline := v_split->>'deadline';
    v_packed_qty := COALESCE((v_split->>'packed_quantity')::NUMERIC, 0);
    v_is_packed := (v_packed_qty >= v_quantity AND v_quantity > 0);

    -- Формування snapshot metadata
    v_new_meta := jsonb_build_object(
      'is_packaged', v_is_packed,
      'batch_index', v_batch_index,
      'batch_num', v_batch_num,
      'planned_sets', v_quantity,
      'packed_sets', v_packed_qty,
      'packaged_at', CASE WHEN v_is_packed THEN NOW()::text ELSE NULL END,
      'packaged_by', CASE WHEN v_is_packed THEN COALESCE(p_user_name, 'Пакувальник') ELSE NULL END
    );

    IF v_idx = 0 THEN
      -- Перший елемент оновлює вихідний батьківський наряд in-place
      v_new_snapshot := COALESCE(v_parent.plan_snapshot, '{}'::JSONB);
      v_new_snapshot := jsonb_set(v_new_snapshot, '{_metadata}', v_new_meta, true);

      UPDATE tasks
      SET
        batch_index = v_batch_index,
        planned_sets = v_quantity,
        planned_deadline = CASE WHEN v_deadline IS NOT NULL AND v_deadline <> '' THEN v_deadline::TIMESTAMPTZ ELSE planned_deadline END,
        status = CASE WHEN v_is_packed THEN 'completed' ELSE 'in-progress' END,
        completed_at = CASE WHEN v_is_packed THEN COALESCE(completed_at, NOW()) ELSE NULL END,
        plan_snapshot = v_new_snapshot
      WHERE id = v_parent.id;

      v_created_task_ids := array_append(v_created_task_ids, v_parent.id);

      -- Оновлення коробок для першої партії
      UPDATE packaging_boxes
      SET batch_index = v_batch_index
      WHERE order_id = v_parent.order_id
        AND (batch_index IS NULL OR batch_index = '' OR batch_index = '1' OR batch_index = 'whole');

    ELSE
      -- Наступні елементи вставляються як нові таски
      v_new_snapshot := jsonb_build_object('_metadata', v_new_meta);

      INSERT INTO tasks (
        order_id,
        step,
        machine_name,
        batch_index,
        planned_sets,
        planned_deadline,
        status,
        completed_at,
        plan_snapshot,
        created_at
      ) VALUES (
        v_parent.order_id,
        'Пакування',
        v_parent.machine_name,
        v_batch_index,
        v_quantity,
        CASE WHEN v_deadline IS NOT NULL AND v_deadline <> '' THEN v_deadline::TIMESTAMPTZ ELSE v_parent.planned_deadline END,
        CASE WHEN v_is_packed THEN 'completed' ELSE 'in-progress' END,
        CASE WHEN v_is_packed THEN NOW() ELSE NULL END,
        v_new_snapshot,
        NOW()
      )
      RETURNING id INTO v_parent;

      v_created_task_ids := array_append(v_created_task_ids, v_parent.id);
    END IF;

    -- Синхронізація розкладу партій
    v_updated_schedule := v_updated_schedule || jsonb_build_array(jsonb_build_object(
      'batch_num', v_batch_num,
      'quantity', v_quantity,
      'deadline', v_deadline,
      'packaged', v_is_packed,
      'packaged_at', CASE WHEN v_is_packed THEN NOW()::text ELSE NULL END,
      'packaged_by', CASE WHEN v_is_packed THEN COALESCE(p_user_name, 'Пакувальник') ELSE NULL END
    ));

    v_idx := v_idx + 1;
  END LOOP;

  -- 5. Запис оновленого batch_schedule в orders.report
  IF v_order.id IS NOT NULL THEN
    v_current_report := jsonb_set(v_current_report, '{batch_schedule}', v_updated_schedule, true);
    UPDATE orders
    SET report = v_current_report::TEXT
    WHERE id = v_order.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'parent_task_id', p_parent_task_id,
    'splits_count', v_idx,
    'task_ids', v_created_task_ids
  );
END;
$$;

COMMENT ON FUNCTION rpc_split_packaging_task IS 'Атомарне розділення наряду пакування на окремі партії з інтерактивним збереженням факту та синхронізацією з відвантаженням';
