-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ENTERPRISE HIGH-LOAD MIGRATION: ATOMIC CARD STATUS TRANSITIONS
-- Процедура: rpc_transition_work_card_atomic (Enterprise FSM + True Idempotency)
-- Версія: 2026-09-06.fsm_matrix_v3
-- База даних: CRM КУЛИЦЯ / MES CENTRUM
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🏛️ АРХІТЕКТУРА ТРЬОХ ШАРІВ:
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
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB);
DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT);
DROP FUNCTION IF EXISTS rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT, TEXT);

CREATE OR REPLACE FUNCTION rpc_transition_work_card_atomic(
  p_card_id UUID,
  p_card_update JSONB,
  p_history_data JSONB,
  p_idempotency_key TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-06.fsm_matrix_v3';
  v_current_card RECORD;
  v_target_status TEXT;
  v_target_op TEXT;
  v_existing_history_id BIGINT;
  v_final_card_info TEXT;
  v_effective_session TEXT;
  v_is_legal BOOLEAN := false;
  v_same_op BOOLEAN := true;
  v_current_clean_op TEXT;
  v_target_clean_op TEXT;
  v_is_shift_change BOOLEAN := false;
  v_incoming_operator TEXT;
  v_current_operator TEXT;
BEGIN
  -- 1. ТРАНЗАКЦІЙНЕ БЛОКУВАННЯ РЯДКА КАРТКИ (SELECT ... FOR UPDATE)
  SELECT * INTO v_current_card
  FROM work_cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'conflict', true,
      'card_not_found', true,
      'error', 'Робочу картку не знайдено в базі даних',
      'rpc_version', v_rpc_version
    );
  END IF;

  v_target_status := p_card_update->>'status';
  v_target_op := p_card_update->>'operation';
  v_effective_session := COALESCE(p_session_id, p_history_data->>'session_id');

  -- 2. ПЕРЕВІРКА ПЕРЕЗМІНКИ (SHARED TABLET / SHIFT CHANGE)
  v_incoming_operator := LOWER(TRIM(COALESCE(p_card_update->>'operator', p_history_data->>'operator_name', '')));
  v_current_operator  := LOWER(TRIM(COALESCE(v_current_card.operator, '')));

  IF v_incoming_operator <> '' AND v_current_operator <> '' AND v_incoming_operator <> v_current_operator THEN
    v_is_shift_change := true;
  END IF;

  -- 3. ПЕРЕВІРКА ІДЕМПОТЕНТНОСТІ (IDEMPOTENCY REPLAY CHECK)
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT id INTO v_existing_history_id
    FROM work_card_history
    WHERE card_id = p_card_id
      AND card_info LIKE '%[IDEMPOTENCY_KEY:' || p_idempotency_key || ']%'
    LIMIT 1;

    IF v_existing_history_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'reason', 'Ця операція вже була успішно зафіксована раніше',
        'card_id', p_card_id,
        'status', v_current_card.status,
        'operation', v_current_card.operation,
        'rpc_version', v_rpc_version
      );
    END IF;
  END IF;

  -- 4. ВАЛІДАЦІЯ МАТРИЦІ ПЕРЕХОДІВ (FSM TRANSITION MATRIX)
  v_current_clean_op := LOWER(TRIM(COALESCE(v_current_card.operation, '')));
  v_target_clean_op  := LOWER(TRIM(COALESCE(v_target_op, v_current_clean_op)));
  v_same_op := (v_current_clean_op = v_target_clean_op);

  IF v_target_status IS NOT NULL THEN
    CASE v_target_status
      WHEN 'in-progress' THEN
        IF v_current_card.status = 'in-progress' THEN
          IF v_is_shift_change THEN
            v_is_legal := true;
          ELSIF NOT v_same_op THEN
            v_is_legal := true;
          ELSE
            RETURN jsonb_build_object(
              'success', false,
              'conflict', true,
              'already_claimed', true,
              'claimed_by', v_current_card.operator,
              'claimed_machine', v_current_card.machine,
              'claimed_at', v_current_card.started_at,
              'current_status', v_current_card.status,
              'current_operation', v_current_card.operation,
              'error', 'Картка вже взята в роботу оператором: ' || COALESCE(v_current_card.operator, 'іншим робітником'),
              'rpc_version', v_rpc_version
            );
          END IF;
        ELSIF v_current_card.status IN (
          'new', 'paused', 'waiting-materials', 'waiting-cutters',
          'at-buffer', 'at-shop2-buffer'
        ) THEN
          v_is_legal := true;
        END IF;

      WHEN 'paused' THEN
        IF v_current_card.status = 'paused' THEN
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'error', 'Картка вже знаходиться на паузі',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status = 'in-progress' THEN
          v_is_legal := true;
        END IF;

      WHEN 'at-buffer' THEN
        IF v_current_card.status = 'at-buffer' THEN
          IF NOT v_same_op THEN
            v_is_legal := true;
          ELSE
            RETURN jsonb_build_object(
              'success', false,
              'conflict', true,
              'already_claimed', true,
              'current_status', v_current_card.status,
              'error', 'Картка вже передана в буферну зону',
              'rpc_version', v_rpc_version
            );
          END IF;
        ELSIF v_current_card.status = 'in-progress' THEN
          v_is_legal := true;
        END IF;

      WHEN 'at-shop2-buffer' THEN
        IF v_current_card.status = 'at-shop2-buffer' THEN
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'error', 'Картка вже передана в буфер Цеху №2',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status IN ('in-progress', 'at-buffer') THEN
          v_is_legal := true;
        END IF;

      WHEN 'completed' THEN
        IF v_current_card.status = 'completed' THEN
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'error', 'Картка вже була повністю завершена раніше',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status IN ('in-progress', 'at-buffer', 'at-shop2-buffer') THEN
          v_is_legal := true;
        END IF;

      WHEN 'new' THEN
        IF v_current_card.status = 'new' THEN
          RETURN jsonb_build_object(
            'success', false,
            'conflict', true,
            'already_claimed', true,
            'current_status', v_current_card.status,
            'error', 'Картка вже знаходиться у статусі нової',
            'rpc_version', v_rpc_version
          );
        ELSE
          v_is_legal := true;
        END IF;

      ELSE
        v_is_legal := true;
    END CASE;

    IF NOT v_is_legal THEN
      RETURN jsonb_build_object(
        'success', false,
        'conflict', true,
        'illegal_transition', true,
        'current_status', v_current_card.status,
        'target_status', v_target_status,
        'error', 'Неприпустимий перехід стану картки: з ' || v_current_card.status || ' у ' || v_target_status,
        'rpc_version', v_rpc_version
      );
    END IF;
  END IF;

  -- 5. АТОМАРНЕ ОНОВЛЕННЯ СТАНУ КАРТКИ
  UPDATE work_cards
  SET
    status = COALESCE(v_target_status, status),
    operation = COALESCE(v_target_op, operation),
    operator = COALESCE(p_card_update->>'operator', operator),
    machine = COALESCE(p_card_update->>'machine', machine),
    started_at = CASE 
      WHEN p_card_update ? 'started_at' THEN (p_card_update->>'started_at')::TIMESTAMPTZ 
      ELSE started_at 
    END,
    card_info = COALESCE(p_card_update->>'card_info', card_info),
    updated_at = NOW()
  WHERE id = p_card_id;

  -- 6. АТОМАРНИЙ ЗАПИС В ІСТОРІЮ З ВШИТИМ IDEMPOTENCY KEY ТА SESSION
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

GRANT EXECUTE ON FUNCTION rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;
