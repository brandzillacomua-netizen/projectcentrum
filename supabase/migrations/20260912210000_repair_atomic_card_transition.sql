-- Repair the production atomic work-card transition contract.
-- This migration replaces only the RPC body; it does not alter tables or data.

BEGIN;

DO $$
DECLARE
  v_missing TEXT;
BEGIN
  IF to_regclass('public.work_cards') IS NULL
    OR to_regclass('public.work_card_history') IS NULL THEN
    RAISE EXCEPTION 'Atomic transition precondition failed: required tables are missing';
  END IF;

  SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
  INTO v_missing
  FROM unnest(ARRAY[
    'id', 'task_id', 'nomenclature_id', 'status', 'operation', 'operator_name',
    'machine', 'estimated_time', 'started_at', 'completed_at', 'card_info',
    'quantity', 'is_rework', 'machine_id', 'manager_name', 'shift_name',
    'cutters_used', 'used_in_shop2_qty', 'galt_priority', 'box_number',
    'is_box_prepared'
  ]) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'work_cards'
      AND columns.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Atomic transition precondition failed: work_cards is missing columns: %', v_missing;
  END IF;

  SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
  INTO v_missing
  FROM unnest(ARRAY[
    'id', 'card_id', 'task_id', 'nomenclature_id', 'stage_name',
    'operator_name', 'card_info', 'qty_at_start', 'qty_completed',
    'scrap_qty', 'cutters_used', 'started_at', 'completed_at',
    'is_archived_scrap', 'shift_name', 'manager_name', 'machine_name'
  ]) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name = 'work_card_history'
      AND columns.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Atomic transition precondition failed: work_card_history is missing columns: %', v_missing;
  END IF;

  IF to_regprocedure('public.mes_current_system_user_id()') IS NULL THEN
    RAISE EXCEPTION 'Atomic transition precondition failed: identity binding function is missing';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.rpc_transition_work_card_atomic(
  p_card_id UUID,
  p_card_update JSONB,
  p_history_data JSONB,
  p_idempotency_key TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-12.atomic_contract_v4';
  v_current_card public.work_cards%ROWTYPE;
  v_updated_card public.work_cards%ROWTYPE;
  v_target_status TEXT;
  v_target_op TEXT;
  v_existing_history_id UUID;
  v_final_card_info TEXT;
  v_effective_session TEXT;
  v_is_legal BOOLEAN := FALSE;
  v_same_op BOOLEAN := TRUE;
  v_current_clean_op TEXT;
  v_target_clean_op TEXT;
  v_is_shift_change BOOLEAN := FALSE;
  v_incoming_operator TEXT;
  v_current_operator TEXT;
  v_unknown_field TEXT;
  v_caller_id BIGINT;
BEGIN
  v_caller_id := public.mes_current_system_user_id();
  IF auth.uid() IS NULL OR v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked'
      USING ERRCODE = '42501';
  END IF;

  IF p_card_id IS NULL THEN
    RAISE EXCEPTION 'p_card_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_card_update IS NULL OR jsonb_typeof(p_card_update) <> 'object' THEN
    RAISE EXCEPTION 'p_card_update must be a JSON object' USING ERRCODE = '22023';
  END IF;

  IF octet_length(p_card_update::TEXT) > 65536 THEN
    RAISE EXCEPTION 'p_card_update exceeds 64 KiB' USING ERRCODE = '22023';
  END IF;

  IF p_history_data IS NOT NULL AND jsonb_typeof(p_history_data) <> 'object' THEN
    RAISE EXCEPTION 'p_history_data must be a JSON object or null' USING ERRCODE = '22023';
  END IF;

  IF p_history_data IS NOT NULL AND octet_length(p_history_data::TEXT) > 65536 THEN
    RAISE EXCEPTION 'p_history_data exceeds 64 KiB' USING ERRCODE = '22023';
  END IF;

  SELECT key
  INTO v_unknown_field
  FROM jsonb_object_keys(p_card_update) AS fields(key)
  WHERE key <> ALL (ARRAY[
    'status', 'operation', 'machine', 'estimated_time', 'started_at',
    'completed_at', 'card_info', 'operator_name', 'operator', 'quantity',
    'is_rework', 'machine_id', 'manager_name', 'shift_name', 'cutters_used',
    'used_in_shop2_qty', 'galt_priority', 'box_number', 'is_box_prepared'
  ]::TEXT[])
  LIMIT 1;

  IF v_unknown_field IS NOT NULL THEN
    RAISE EXCEPTION 'Unsupported work-card update field: %', v_unknown_field
      USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL
    AND (p_idempotency_key !~ '^[A-Za-z0-9._:-]{1,200}$') THEN
    RAISE EXCEPTION 'Invalid idempotency key' USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NOT NULL
    AND (length(p_session_id) > 200 OR position(']' IN p_session_id) > 0) THEN
    RAISE EXCEPTION 'Invalid session identifier' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_current_card
  FROM public.work_cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'conflict', TRUE,
      'card_not_found', TRUE,
      'message', 'Робочу картку не знайдено в базі даних',
      'error', 'Робочу картку не знайдено в базі даних',
      'rpc_version', v_rpc_version
    );
  END IF;

  v_target_status := p_card_update->>'status';
  v_target_op := p_card_update->>'operation';
  v_effective_session := COALESCE(p_session_id, p_history_data->>'session_id');
  v_incoming_operator := lower(trim(COALESCE(
    p_card_update->>'operator_name',
    p_card_update->>'operator',
    p_history_data->>'operator_name',
    ''
  )));
  v_current_operator := lower(trim(COALESCE(v_current_card.operator_name, '')));
  v_is_shift_change := v_incoming_operator <> ''
    AND v_current_operator <> ''
    AND v_incoming_operator <> v_current_operator;

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT history.id
    INTO v_existing_history_id
    FROM public.work_card_history AS history
    WHERE history.card_id = p_card_id
      AND position('[IDEMPOTENCY_KEY:' || p_idempotency_key || ']' IN COALESCE(history.card_info, '')) > 0
    LIMIT 1;

    IF v_existing_history_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', TRUE,
        'already_processed', TRUE,
        'idempotent_replay', TRUE,
        'reason', 'idempotent_replay',
        'card_id', p_card_id,
        'status', v_current_card.status,
        'operation', v_current_card.operation,
        'rpc_version', v_rpc_version
      );
    END IF;
  END IF;

  v_current_clean_op := lower(trim(COALESCE(v_current_card.operation, '')));
  v_target_clean_op := lower(trim(COALESCE(v_target_op, v_current_clean_op)));
  v_same_op := v_current_clean_op = v_target_clean_op;

  IF v_target_status IS NOT NULL THEN
    CASE v_target_status
      WHEN 'in-progress' THEN
        IF v_current_card.status = 'in-progress' THEN
          IF v_is_shift_change OR NOT v_same_op THEN
            v_is_legal := TRUE;
          ELSE
            RETURN jsonb_build_object(
              'success', FALSE,
              'conflict', TRUE,
              'already_claimed', TRUE,
              'claimed_by', v_current_card.operator_name,
              'claimed_machine', v_current_card.machine,
              'claimed_at', v_current_card.started_at,
              'current_status', v_current_card.status,
              'current_operation', v_current_card.operation,
              'message', 'Картка вже взята в роботу оператором: ' || COALESCE(v_current_card.operator_name, 'іншим робітником'),
              'error', 'Картка вже взята в роботу оператором: ' || COALESCE(v_current_card.operator_name, 'іншим робітником'),
              'rpc_version', v_rpc_version
            );
          END IF;
        ELSIF v_current_card.status IN (
          'new', 'paused', 'waiting-materials', 'waiting-cutters',
          'at-buffer', 'at-shop2-buffer'
        ) THEN
          v_is_legal := TRUE;
        END IF;

      WHEN 'paused' THEN
        IF v_current_card.status = 'paused' THEN
          RETURN jsonb_build_object(
            'success', FALSE, 'conflict', TRUE, 'already_claimed', TRUE,
            'current_status', v_current_card.status,
            'message', 'Картка вже знаходиться на паузі',
            'error', 'Картка вже знаходиться на паузі',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status = 'in-progress' THEN
          v_is_legal := TRUE;
        END IF;

      WHEN 'at-buffer' THEN
        IF v_current_card.status = 'at-buffer' THEN
          IF NOT v_same_op THEN
            v_is_legal := TRUE;
          ELSE
            RETURN jsonb_build_object(
              'success', FALSE, 'conflict', TRUE, 'already_claimed', TRUE,
              'current_status', v_current_card.status,
              'message', 'Картка вже передана в буферну зону',
              'error', 'Картка вже передана в буферну зону',
              'rpc_version', v_rpc_version
            );
          END IF;
        ELSIF v_current_card.status = 'in-progress' THEN
          v_is_legal := TRUE;
        END IF;

      WHEN 'at-shop2-buffer' THEN
        IF v_current_card.status = 'at-shop2-buffer' THEN
          RETURN jsonb_build_object(
            'success', FALSE, 'conflict', TRUE, 'already_claimed', TRUE,
            'current_status', v_current_card.status,
            'message', 'Картка вже передана в буфер Цеху №2',
            'error', 'Картка вже передана в буфер Цеху №2',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status IN ('in-progress', 'at-buffer') THEN
          v_is_legal := TRUE;
        END IF;

      WHEN 'completed' THEN
        IF v_current_card.status = 'completed' THEN
          RETURN jsonb_build_object(
            'success', FALSE, 'conflict', TRUE, 'already_claimed', TRUE,
            'current_status', v_current_card.status,
            'message', 'Картка вже була повністю завершена раніше',
            'error', 'Картка вже була повністю завершена раніше',
            'rpc_version', v_rpc_version
          );
        ELSIF v_current_card.status IN ('in-progress', 'at-buffer', 'at-shop2-buffer') THEN
          v_is_legal := TRUE;
        END IF;

      WHEN 'new' THEN
        IF v_current_card.status = 'new' THEN
          RETURN jsonb_build_object(
            'success', FALSE, 'conflict', TRUE, 'already_claimed', TRUE,
            'current_status', v_current_card.status,
            'message', 'Картка вже знаходиться у статусі нової',
            'error', 'Картка вже знаходиться у статусі нової',
            'rpc_version', v_rpc_version
          );
        ELSE
          v_is_legal := TRUE;
        END IF;

      ELSE
        v_is_legal := TRUE;
    END CASE;

    IF NOT v_is_legal THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'conflict', TRUE,
        'illegal_transition', TRUE,
        'current_status', v_current_card.status,
        'target_status', v_target_status,
        'message', 'Неприпустимий перехід стану картки: з ' || COALESCE(v_current_card.status, 'null') || ' у ' || v_target_status,
        'error', 'Неприпустимий перехід стану картки: з ' || COALESCE(v_current_card.status, 'null') || ' у ' || v_target_status,
        'rpc_version', v_rpc_version
      );
    END IF;
  END IF;

  UPDATE public.work_cards
  SET
    status = CASE WHEN p_card_update ? 'status' THEN p_card_update->>'status' ELSE status END,
    operation = CASE WHEN p_card_update ? 'operation' THEN p_card_update->>'operation' ELSE operation END,
    machine = CASE WHEN p_card_update ? 'machine' THEN p_card_update->>'machine' ELSE machine END,
    estimated_time = CASE WHEN p_card_update ? 'estimated_time' THEN (p_card_update->>'estimated_time')::INTEGER ELSE estimated_time END,
    started_at = CASE WHEN p_card_update ? 'started_at' THEN (p_card_update->>'started_at')::TIMESTAMPTZ ELSE started_at END,
    completed_at = CASE WHEN p_card_update ? 'completed_at' THEN (p_card_update->>'completed_at')::TIMESTAMPTZ ELSE completed_at END,
    card_info = CASE WHEN p_card_update ? 'card_info' THEN p_card_update->>'card_info' ELSE card_info END,
    operator_name = CASE
      WHEN p_card_update ? 'operator_name' THEN p_card_update->>'operator_name'
      WHEN p_card_update ? 'operator' THEN p_card_update->>'operator'
      ELSE operator_name
    END,
    quantity = CASE WHEN p_card_update ? 'quantity' THEN (p_card_update->>'quantity')::INTEGER ELSE quantity END,
    is_rework = CASE WHEN p_card_update ? 'is_rework' THEN (p_card_update->>'is_rework')::BOOLEAN ELSE is_rework END,
    machine_id = CASE WHEN p_card_update ? 'machine_id' THEN (p_card_update->>'machine_id')::UUID ELSE machine_id END,
    manager_name = CASE WHEN p_card_update ? 'manager_name' THEN p_card_update->>'manager_name' ELSE manager_name END,
    shift_name = CASE WHEN p_card_update ? 'shift_name' THEN p_card_update->>'shift_name' ELSE shift_name END,
    cutters_used = CASE WHEN p_card_update ? 'cutters_used' THEN (p_card_update->>'cutters_used')::INTEGER ELSE cutters_used END,
    used_in_shop2_qty = CASE WHEN p_card_update ? 'used_in_shop2_qty' THEN (p_card_update->>'used_in_shop2_qty')::INTEGER ELSE used_in_shop2_qty END,
    galt_priority = CASE WHEN p_card_update ? 'galt_priority' THEN (p_card_update->>'galt_priority')::INTEGER ELSE galt_priority END,
    box_number = CASE WHEN p_card_update ? 'box_number' THEN p_card_update->>'box_number' ELSE box_number END,
    is_box_prepared = CASE WHEN p_card_update ? 'is_box_prepared' THEN (p_card_update->>'is_box_prepared')::BOOLEAN ELSE is_box_prepared END
  WHERE id = p_card_id
  RETURNING * INTO v_updated_card;

  IF p_history_data IS NOT NULL THEN
    v_final_card_info := COALESCE(p_history_data->>'card_info', '');
    IF p_idempotency_key IS NOT NULL
      AND position('[IDEMPOTENCY_KEY:' IN v_final_card_info) = 0 THEN
      v_final_card_info := trim(v_final_card_info || ' [IDEMPOTENCY_KEY:' || p_idempotency_key || ']');
    END IF;
    IF v_effective_session IS NOT NULL
      AND position('[SESSION:' IN v_final_card_info) = 0 THEN
      v_final_card_info := trim(v_final_card_info || ' [SESSION:' || v_effective_session || ']');
    END IF;

    INSERT INTO public.work_card_history (
      card_id, task_id, nomenclature_id, stage_name, operator_name, card_info,
      qty_at_start, qty_completed, scrap_qty, cutters_used, started_at,
      completed_at, is_archived_scrap, shift_name, manager_name, machine_name
    ) VALUES (
      p_card_id,
      COALESCE((p_history_data->>'task_id')::UUID, v_updated_card.task_id),
      COALESCE((p_history_data->>'nomenclature_id')::UUID, v_updated_card.nomenclature_id),
      COALESCE(p_history_data->>'stage_name', v_updated_card.operation),
      COALESCE(p_history_data->>'operator_name', v_updated_card.operator_name, 'Не вказано'),
      v_final_card_info,
      COALESCE((p_history_data->>'qty_at_start')::INTEGER, v_current_card.quantity, 0),
      COALESCE((p_history_data->>'qty_completed')::INTEGER, 0),
      COALESCE((p_history_data->>'scrap_qty')::INTEGER, 0),
      COALESCE((p_history_data->>'cutters_used')::INTEGER, 0),
      COALESCE((p_history_data->>'started_at')::TIMESTAMPTZ, v_updated_card.started_at),
      COALESCE((p_history_data->>'completed_at')::TIMESTAMPTZ, now()),
      COALESCE((p_history_data->>'is_archived_scrap')::BOOLEAN, FALSE),
      COALESCE(p_history_data->>'shift_name', v_updated_card.shift_name),
      COALESCE(p_history_data->>'manager_name', v_updated_card.manager_name),
      COALESCE(p_history_data->>'machine_name', v_updated_card.machine)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'card_id', p_card_id,
    'status', v_updated_card.status,
    'operation', v_updated_card.operation,
    'rpc_version', v_rpc_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_transition_work_card_atomic(UUID, JSONB, JSONB, TEXT, TEXT)
  TO authenticated, service_role;

DO $$
DECLARE
  v_definition TEXT;
  v_config TEXT[];
  v_routine_oid OID;
  v_public_execute BOOLEAN;
BEGIN
  SELECT routine.oid, pg_get_functiondef(routine.oid), routine.proconfig
  INTO v_routine_oid, v_definition, v_config
  FROM pg_proc AS routine
  JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
  WHERE namespace.nspname = 'public'
    AND routine.proname = 'rpc_transition_work_card_atomic'
    AND pg_get_function_identity_arguments(routine.oid) =
      'p_card_id uuid, p_card_update jsonb, p_history_data jsonb, p_idempotency_key text, p_session_id text';

  IF v_definition IS NULL
    OR position('v_current_card.operator_name' IN v_definition) = 0
    OR position('v_current_card.operator,' IN v_definition) > 0
    OR position('updated_at = now()' IN lower(v_definition)) > 0 THEN
    RAISE EXCEPTION 'Atomic transition postcondition failed: invalid function body';
  END IF;

  IF NOT COALESCE(v_config @> ARRAY['search_path=pg_catalog, public, auth'], FALSE) THEN
    RAISE EXCEPTION 'Atomic transition postcondition failed: search_path is not fixed';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc AS routine
    CROSS JOIN LATERAL aclexplode(COALESCE(routine.proacl, acldefault('f', routine.proowner))) AS privilege
    WHERE routine.oid = v_routine_oid
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ) INTO v_public_execute;

  IF NOT has_function_privilege(
      'authenticated',
      'public.rpc_transition_work_card_atomic(uuid,jsonb,jsonb,text,text)',
      'EXECUTE'
    )
    OR has_function_privilege(
      'anon',
      'public.rpc_transition_work_card_atomic(uuid,jsonb,jsonb,text,text)',
      'EXECUTE'
    )
    OR v_public_execute THEN
    RAISE EXCEPTION 'Atomic transition postcondition failed: unsafe execute grants';
  END IF;
END
$$;

COMMIT;
