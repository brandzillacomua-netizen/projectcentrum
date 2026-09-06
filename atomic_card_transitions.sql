-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE HIGH-LOAD MIGRATION: ATOMIC CARD STATUS TRANSITIONS
-- Процедура: rpc_transition_work_card_atomic (Enterprise FSM + True Idempotency)
-- Версія: 2026-09-05.fsm_matrix_v3
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🏛️ АРХІТЕКТУРА ТРЬОХ ШАРІВ:
--
--              RPC request
--                   │
--          ┌────────▼────────┐
--          │ Row lock        │ SELECT ... FOR UPDATE (блокування рядка в PostgreSQL)
--          └────────┬────────┘
--                   ▼
--          ┌─────────────────┐
--          │ Idempotency     │ Той самий idempotency_key в історії?
--          │ same key?       │ ──► ТАК ──► RETURN { success: true, reason: "idempotent_replay" }
--          └────────┬────────┘
--                НІ │
--                   ▼
--          ┌─────────────────┐
--          │ FSM guard       │ Перевірка матриці переходів для поточного стану
--          │ legal transition│ ──► КОЛІЗІЯ ──► RETURN { success: false, conflict: true, already_claimed: true }
--          └────────┬────────┘ ──► НЕВАЛІДНО ─► RETURN { success: false, conflict: true, illegal_transition: true }
--             ЛЕГАЛЬНО
--                   ▼
--          ┌─────────────────┐
--          │ Mutation +      │ UPDATE work_cards + INSERT work_card_history
--          │ History         │ ──► RETURN { success: true, card_id, status, operation }
--          └─────────────────┘
--
-- 📋 ПОВНА ТАБЛИЦЯ ПЕРЕХОДІВ СТАНІВ (FSM TRANSITION MATRIX):
-- ┌─────────────────────┬────────────────────────────────────────────────────────┬──────────────────────────────────────────┐
-- │ Цільовий статус     │ Дозволені попередні статуси (current_status)           │ Поведінка при target_status == current   │
-- ├─────────────────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
-- │ in-progress         │ new, paused, waiting-materials, waiting-cutters,       │ Якщо зміна операції (Галтовка) або       │
-- │                     │ at-buffer (Галтовка/Сортування), at-shop2-buffer (Ц2)  │ перезмінка -> OK. Інакше -> ALREADY_CLAIM│
-- ├─────────────────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
-- │ paused              │ in-progress                                            │ ALREADY_CLAIMED ("Вже на паузі")         │
-- ├─────────────────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
-- │ at-buffer           │ in-progress                                            │ Якщо зміна операції -> OK, інакше CLAIMED│
-- ├─────────────────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
-- │ at-shop2-buffer     │ in-progress, at-buffer                                 │ ALREADY_CLAIMED ("Вже в буфері Цеху №2") │
-- ├─────────────────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
-- │ completed           │ in-progress, at-buffer, at-shop2-buffer                │ ALREADY_CLAIMED ("Вже завершено")        │
-- ├─────────────────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
-- │ new (Reset/Rerun)   │ completed, in-progress, paused, at-buffer, at-shop2-buf│ ALREADY_CLAIMED ("Вже в статусі new")    │
-- └─────────────────────┴────────────────────────────────────────────────────────┴──────────────────────────────────────────┘
-- ═══════════════════════════════════════════════════════════════════════════

-- Очищаємо застарілі перевантажені сигнатури для усунення конфлікту вибору функцій (PGRST203)
DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB);
DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT);
DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT, TEXT);

CREATE OR REPLACE FUNCTION rpc_transition_work_card_atomic(
  p_card_id UUID,
  p_card_update JSONB,
  p_history_data JSONB DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_client_session TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-05.fsm_matrix_v9';
  v_current_card RECORD;
  v_target_status TEXT;
  v_target_op TEXT;
  v_is_valid_transition BOOLEAN := false;
  v_final_card_info TEXT;
  v_is_shift_change BOOLEAN := false;
  v_existing_session TEXT;
  v_effective_session TEXT;
  v_caller_operator TEXT;
BEGIN
  -- 1. ТРАНЗАКЦІЙНЕ БЛОКУВАННЯ РЯДКА (FOR UPDATE)
  -- Серіалізує конкурентні виклики від декількох планшетів на рівні ядра PostgreSQL
  SELECT * INTO v_current_card
  FROM work_cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Card not found',
      'rpc_version', v_rpc_version
    );
  END IF;

  -- 2. ШАР 1: IDEMPOTENCY KEY CHECK (Exact Retry Idempotency)
  -- Якщо прийшов повторний запит з ТИМ САМИМ ключем (retry того самого термінала через мережевий збій)
  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM work_card_history 
    WHERE card_id = p_card_id 
      AND card_info LIKE '%[IDEMPOTENCY_KEY:' || p_idempotency_key || ']%'
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'reason', 'idempotent_replay',
      'idempotency_key', p_idempotency_key,
      'card_id', p_card_id,
      'status', v_current_card.status,
      'operation', v_current_card.operation,
      'rpc_version', v_rpc_version,
      'message', 'Запит є повтором вже успішно виконаної дії цього терміналу'
    );
  END IF;

  v_target_status := p_card_update->>'status';
  v_target_op := COALESCE(p_card_update->>'operation', v_current_card.operation);

  -- Визначаємо, чи це законна дія перезмінки (Shift Change)
  v_is_shift_change := (
    (p_history_data IS NOT NULL AND (
      p_history_data->>'stage_name' LIKE '%перезмінка%' OR
      p_history_data->>'card_info' LIKE '%[REPLACED_BY:%'
    )) OR
    (p_card_update ? 'card_info' AND p_card_update->>'card_info' LIKE '%[REPLACED_BY:%')
  );

  -- Витягуємо оператора, який ініціював цей запит (з оновлення картки або з даних історії)
  v_caller_operator := NULLIF(TRIM(COALESCE(p_card_update->>'operator_name', p_history_data->>'operator_name')), '');

  -- ─── СТРОГИЙ КОНТРОЛЬ ОСОБИ (OPERATOR IDENTITY GUARD) ───
  -- 1. Неможливо взяти наряд у роботу анонімно (з new, at-buffer, at-shop2-buffer, paused тощо)
  IF v_target_status = 'in-progress' AND v_current_card.status != 'in-progress' THEN
    IF v_caller_operator IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'missing_operator', true,
        'current_status', v_current_card.status,
        'target_status', v_target_status,
        'rpc_version', v_rpc_version,
        'message', 'Операція відхилена: обов''язково вкажіть ім''я оператора для взяття наряду в роботу зі статусу "' || v_current_card.status || '"'
      );
    END IF;
  END IF;

  -- 2. Будь-які дії з нарядом у роботі (in-progress) вимагають обов'язкового зазначення оператора
  IF v_current_card.status = 'in-progress' THEN
    IF v_caller_operator IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'missing_operator', true,
        'current_status', v_current_card.status,
        'claimed_by', v_current_card.operator_name,
        'rpc_version', v_rpc_version,
        'message', 'Операція відхилена: обов''язково вкажіть ім''я оператора для дій з нарядом у роботі (зараз закріплено за: ' || COALESCE(v_current_card.operator_name, 'Невідомо') || ')'
      );
    END IF;

    -- Якщо запит шле інший оператор і це не офіційна перезмінка -> СУВОРА КОЛІЗІЯ!
    IF v_caller_operator != v_current_card.operator_name AND NOT v_is_shift_change THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'already_claimed', true,
        'claimed_by', v_current_card.operator_name,
        'caller_operator', v_caller_operator,
        'machine', v_current_card.machine,
        'current_status', v_current_card.status,
        'rpc_version', v_rpc_version,
        'message', 'Картку вже взято в роботу оператором ' || COALESCE(v_current_card.operator_name, 'Інший') || '. Для передачі наряду виконайте офіційну перезмінку.'
      );
    END IF;
  END IF;

  -- Витягуємо наявний тег сесії з поточного стану картки
  v_existing_session := substring(v_current_card.card_info from '\[SESSION:([^\]]+)\]');

  -- Розраховуємо ефективну сесію:
  -- 1) При перезмінці — сесія попереднього оператора повністю очищається
  -- 2) При скиданні в 'new' — сесія очищається
  -- 3) При звичайному оновленні — зберігається інформаційно
  IF v_target_status = 'new' OR v_is_shift_change THEN
    v_effective_session := NULL;
  ELSE
    v_effective_session := COALESCE(p_client_session, v_existing_session);
  END IF;

  -- 3. ШАР 2: FSM GUARD (Машина виробничих станів та переходів)
  IF v_target_status IS NOT NULL THEN
    
    -- ─── ВИПАДОК А: Зміна статусу на інший (target_status != current_status) ───
    IF v_target_status != v_current_card.status THEN
      v_is_valid_transition := CASE
        -- [ФЛОУ 1: Розкрій (Shop 1)]
        WHEN v_current_card.status IN ('new', 'paused', 'waiting-materials', 'waiting-cutters') 
             AND v_target_status = 'in-progress' THEN true
        WHEN v_current_card.status = 'in-progress' 
             AND v_target_status = 'paused' THEN true
        WHEN v_current_card.status = 'in-progress' 
             AND v_target_status = 'at-buffer' THEN true
        WHEN v_current_card.status IN ('in-progress', 'at-buffer') 
             AND v_target_status = 'at-shop2-buffer' THEN true
        WHEN v_current_card.status IN ('in-progress', 'at-buffer') 
             AND v_target_status = 'completed' THEN true

        -- [ФЛОУ 2: Галтовка (Tumbling)]
        WHEN v_current_card.status = 'at-buffer' 
             AND v_target_status = 'in-progress' THEN true

        -- [ФЛОУ 3: Сортування (Sorting)]
        WHEN v_current_card.status IN ('at-buffer', 'new') 
             AND v_target_status = 'in-progress' THEN true
        WHEN v_current_card.status IN ('in-progress', 'at-buffer') 
             AND v_target_status = 'at-shop2-buffer' THEN true

        -- [ФЛОУ 4: Цех №2, Прийомка, Склад, Майстер та QC Rework]
        WHEN v_current_card.status = 'at-shop2-buffer' 
             AND v_target_status = 'in-progress' THEN true
        WHEN v_current_card.status IN ('in-progress', 'at-buffer', 'at-shop2-buffer') 
             AND v_target_status = 'completed' THEN true
        WHEN v_current_card.status IN ('completed', 'in-progress', 'paused', 'at-buffer', 'at-shop2-buffer') 
             AND v_target_status = 'new' THEN true

        ELSE false
      END;

      IF NOT v_is_valid_transition THEN
        RETURN jsonb_build_object(
          'success', false,
          'conflict', true,
          'illegal_transition', true,
          'current_status', v_current_card.status,
          'target_status', v_target_status,
          'rpc_version', v_rpc_version,
          'message', 'Неприпустимий перехід стану: з "' || v_current_card.status || '" у "' || v_target_status || '"'
        );
      END IF;

    -- ─── ВИПАДОК Б: Статус той самий (target_status == current_status) ───
    ELSIF v_target_status = v_current_card.status THEN
      
      -- 1. in-progress -> in-progress
      IF v_current_card.status = 'in-progress' THEN
        -- Перехід між підстадіями Галтовки (Вібростіл -> Галтовка -> Мийка -> Сушка)
        IF v_target_op IS DISTINCT FROM v_current_card.operation THEN
          v_is_valid_transition := true;
        -- Перезмінка (новий робітник приймає картку, що вже в роботі)
        ELSIF v_is_shift_change THEN
          v_is_valid_transition := true;
        -- Тільки підтверджений власник наряду має право оновлювати його в роботі:
        ELSIF v_caller_operator = v_current_card.operator_name THEN
          v_is_valid_transition := true;
        ELSE
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'claimed_by', COALESCE(v_current_card.operator_name, 'Інший оператор'),
            'machine', v_current_card.machine,
            'current_status', v_current_card.status,
            'operation', v_current_card.operation,
            'rpc_version', v_rpc_version,
            'message', 'Картку вже взято в роботу оператором ' || COALESCE(v_current_card.operator_name, 'іншим робітником') || COALESCE(' на верстаті ' || v_current_card.machine, '')
          );
        END IF;

      -- 2. at-buffer -> at-buffer
      ELSIF v_current_card.status = 'at-buffer' THEN
        IF v_target_op IS DISTINCT FROM v_current_card.operation THEN
          v_is_valid_transition := true;
        ELSE
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'operation', v_current_card.operation,
            'rpc_version', v_rpc_version,
            'message', 'Картку вже переведено в буфер стадії "' || v_current_card.operation || '"'
          );
        END IF;

      -- 3. at-shop2-buffer -> at-shop2-buffer
      ELSIF v_current_card.status = 'at-shop2-buffer' THEN
        RETURN jsonb_build_object(
          'success', false,
          'conflict', true,
          'already_claimed', true,
          'current_status', v_current_card.status,
          'rpc_version', v_rpc_version,
          'message', 'Картку вже передано в буфер Цеху №2'
        );

      -- 4. paused -> paused
      ELSIF v_current_card.status = 'paused' THEN
        RETURN jsonb_build_object(
          'success', false,
          'conflict', true,
          'already_claimed', true,
          'current_status', v_current_card.status,
          'rpc_version', v_rpc_version,
          'message', 'Картка вже знаходиться на паузі'
        );

      -- 5. completed -> completed
      ELSIF v_current_card.status = 'completed' THEN
        RETURN jsonb_build_object(
          'success', false,
          'conflict', true,
          'already_claimed', true,
          'current_status', v_current_card.status,
          'rpc_version', v_rpc_version,
          'message', 'Картку вже завершено'
        );

      END IF;

    END IF;
  END IF;

  -- 4. АТОМАРНЕ ОНОВЛЕННЯ РОБОЧОЇ КАРТКИ
  UPDATE work_cards
  SET
    status = COALESCE(v_target_status, status),
    operation = COALESCE(v_target_op, operation),
    quantity = CASE WHEN p_card_update ? 'quantity' THEN (p_card_update->>'quantity')::NUMERIC ELSE quantity END,
    started_at = CASE 
      WHEN p_card_update ? 'started_at' AND p_card_update->>'started_at' IS NULL THEN NULL 
      WHEN p_card_update ? 'started_at' THEN (p_card_update->>'started_at')::TIMESTAMPTZ 
      ELSE started_at 
    END,
    completed_at = CASE 
      WHEN p_card_update ? 'completed_at' AND p_card_update->>'completed_at' IS NULL THEN NULL 
      WHEN p_card_update ? 'completed_at' THEN (p_card_update->>'completed_at')::TIMESTAMPTZ 
      ELSE completed_at 
    END,
    operator_name = CASE 
      WHEN p_card_update ? 'operator_name' AND p_card_update->>'operator_name' IS NULL THEN NULL 
      WHEN p_card_update ? 'operator_name' THEN p_card_update->>'operator_name' 
      ELSE operator_name 
    END,
    shift_name = CASE 
      WHEN p_card_update ? 'shift_name' AND p_card_update->>'shift_name' IS NULL THEN NULL 
      WHEN p_card_update ? 'shift_name' THEN p_card_update->>'shift_name' 
      ELSE shift_name 
    END,
    manager_name = CASE 
      WHEN p_card_update ? 'manager_name' AND p_card_update->>'manager_name' IS NULL THEN NULL 
      WHEN p_card_update ? 'manager_name' THEN p_card_update->>'manager_name' 
      ELSE manager_name 
    END,
    machine = CASE 
      WHEN p_card_update ? 'machine' AND p_card_update->>'machine' IS NULL THEN NULL 
      WHEN p_card_update ? 'machine' THEN p_card_update->>'machine' 
      ELSE machine 
    END,
    machine_id = CASE 
      WHEN p_card_update ? 'machine_id' AND p_card_update->>'machine_id' IS NULL THEN NULL 
      WHEN p_card_update ? 'machine_id' THEN (p_card_update->>'machine_id')::UUID 
      ELSE machine_id 
    END,
    cutters_used = CASE 
      WHEN p_card_update ? 'cutters_used' THEN (p_card_update->>'cutters_used')::NUMERIC 
      ELSE cutters_used 
    END,
    card_info = CASE
      -- Якщо статус скидається в 'new' (Reset), очищаємо старий тег сесії
      WHEN v_target_status = 'new' THEN
        TRIM(regexp_replace(COALESCE(p_card_update->>'card_info', card_info), '\[SESSION:[^\]]+\]', '', 'g'))
      -- Якщо є ефективна сесія, а новий рядок не містить тегу [SESSION: — автоматично зберігаємо/дописуємо його!
      WHEN v_effective_session IS NOT NULL AND COALESCE(p_card_update->>'card_info', card_info) NOT LIKE '%[SESSION:%'
      THEN TRIM(COALESCE(p_card_update->>'card_info', card_info) || ' [SESSION:' || v_effective_session || ']')
      -- Якщо це перезмінка на новий планшет і рядок вже містив старий тег — замінюємо на новий
      WHEN v_is_shift_change AND p_client_session IS NOT NULL AND COALESCE(p_card_update->>'card_info', card_info) LIKE '%[SESSION:%'
      THEN TRIM(regexp_replace(COALESCE(p_card_update->>'card_info', card_info), '\[SESSION:[^\]]+\]', '[SESSION:' || p_client_session || ']', 'g'))
      ELSE COALESCE(p_card_update->>'card_info', card_info)
    END
  WHERE id = p_card_id;

  -- 5. АТОМАРНИЙ ЗАПИС В ІСТОРІЮ З ВШИТИМ IDEMPOTENCY KEY ТА SESSION
  IF p_history_data IS NOT NULL THEN
    v_final_card_info := COALESCE(p_history_data->>'card_info', '');
    IF p_idempotency_key IS NOT NULL AND v_final_card_info NOT LIKE '%[IDEMPOTENCY_KEY:%' THEN
      v_final_card_info := TRIM(v_final_card_info || ' [IDEMPOTENCY_KEY:' || p_idempotency_key || ']');
    END IF;
    IF v_effective_session IS NOT NULL AND v_final_card_info NOT LIKE '%[SESSION:%' THEN
      v_final_card_info := TRIM(v_final_card_info || ' [SESSION:' || v_effective_session || ']');
    END IF;

    INSERT INTO work_card_history (
      card_id,
      task_id,
      nomenclature_id,
      stage_name,
      operator_name,
      card_info,
      qty_at_start,
      qty_completed,
      scrap_qty,
      cutters_used,
      started_at,
      completed_at,
      is_archived_scrap,
      shift_name,
      manager_name,
      machine_name
    ) VALUES (
      p_card_id,
      COALESCE((p_history_data->>'task_id')::UUID, v_current_card.task_id),
      COALESCE((p_history_data->>'nomenclature_id')::UUID, v_current_card.nomenclature_id),
      COALESCE(p_history_data->>'stage_name', v_target_op, v_current_card.operation),
      COALESCE(p_history_data->>'operator_name', 'Не вказано'),
      v_final_card_info,
      COALESCE((p_history_data->>'qty_at_start')::NUMERIC, v_current_card.quantity, 0),
      COALESCE((p_history_data->>'qty_completed')::NUMERIC, 0),
      COALESCE((p_history_data->>'scrap_qty')::NUMERIC, 0),
      COALESCE((p_history_data->>'cutters_used')::NUMERIC, 0),
      (p_history_data->>'started_at')::TIMESTAMPTZ,
      COALESCE((p_history_data->>'completed_at')::TIMESTAMPTZ, NOW()),
      COALESCE((p_history_data->>'is_archived_scrap')::BOOLEAN, false),
      p_history_data->>'shift_name',
      p_history_data->>'manager_name',
      p_history_data->>'machine_name'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'status', COALESCE(v_target_status, v_current_card.status),
    'operation', COALESCE(v_target_op, v_current_card.operation),
    'rpc_version', v_rpc_version
  );
END;
$$;
