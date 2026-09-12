-- Expand phase: add a narrow public API for QR machine calls.
-- Apply before deploying the RPC client. Old anon grants are removed only by
-- 20260912133000_public_machine_call_contract.sql after deployment verification.

ALTER TABLE public.machine_calls
  ADD COLUMN IF NOT EXISTS called_employee_id BIGINT REFERENCES public.system_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS called_employee_name TEXT;

CREATE INDEX IF NOT EXISTS machine_calls_pending_machine_role_idx
  ON public.machine_calls(machine_id, called_role, created_at DESC)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.rpc_public_machine_call_context(p_machine_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_machine JSONB;
  v_users JSONB := '[]'::JSONB;
  v_calls JSONB := '[]'::JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'inventory_no', m.inventory_no,
    'floor', m.floor,
    'sequence_number', m.sequence_number,
    'status', m.status
  )
  INTO v_machine
  FROM public.machines AS m
  WHERE m.id = p_machine_id;

  IF v_machine IS NULL THEN
    RETURN jsonb_build_object('machine', NULL, 'users', v_users, 'calls', v_calls);
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'first_name', u.first_name,
      'last_name', u.last_name,
      'position', u.position,
      'call_roles', u.call_roles
    ) ORDER BY u.first_name NULLS LAST, u.last_name NULLS LAST, u.id
  ), '[]'::JSONB)
  INTO v_users
  FROM (
    SELECT
      su.id,
      su.first_name,
      su.last_name,
      su.position,
      array_remove(ARRAY[
        CASE WHEN su.access_rights @> '{"master": true}'::JSONB
          OR su.access_rights @> '{"foreman": true}'::JSONB
          OR COALESCE(su.position, '') ILIKE '%майстер%' THEN 'master' END,
        CASE WHEN su.access_rights @> '{"engineer": true}'::JSONB
          OR COALESCE(su.position, '') ILIKE '%інженер%' THEN 'engineer' END,
        CASE WHEN su.access_rights @> '{"brak": true}'::JSONB
          OR COALESCE(su.position, '') ILIKE '%вкя%'
          OR COALESCE(su.position, '') ILIKE '%якост%' THEN 'quality' END
      ], NULL)::TEXT[] AS call_roles
    FROM public.system_users AS su
    WHERE su.auth_user_id IS NOT NULL
      AND (
        su.access_rights @> ANY (ARRAY[
          '{"master": true}'::JSONB,
          '{"foreman": true}'::JSONB,
          '{"engineer": true}'::JSONB,
          '{"brak": true}'::JSONB
        ])
        OR COALESCE(su.position, '') ILIKE ANY (ARRAY['%майстер%', '%інженер%', '%вкя%', '%якост%'])
      )
  ) AS u;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'called_role', c.called_role,
      'created_at', c.created_at
    ) ORDER BY c.created_at
  ), '[]'::JSONB)
  INTO v_calls
  FROM public.machine_calls AS c
  WHERE c.machine_id = p_machine_id
    AND c.status = 'pending';

  RETURN jsonb_build_object('machine', v_machine, 'users', v_users, 'calls', v_calls);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_public_create_machine_call(
  p_machine_id UUID,
  p_called_role TEXT,
  p_operator_name TEXT DEFAULT NULL,
  p_called_employee_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_call_id UUID;
  v_created_at TIMESTAMPTZ;
  v_employee_name TEXT;
  v_operator_name TEXT;
BEGIN
  IF p_machine_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.machines AS m WHERE m.id = p_machine_id
  ) THEN
    RAISE EXCEPTION 'Machine not found' USING ERRCODE = '22023';
  END IF;

  IF p_called_role IS NULL OR p_called_role NOT IN ('master', 'engineer', 'quality') THEN
    RAISE EXCEPTION 'Unsupported call role' USING ERRCODE = '22023';
  END IF;

  v_operator_name := LEFT(
    COALESCE(
      NULLIF(BTRIM(regexp_replace(COALESCE(p_operator_name, ''), '[[:cntrl:]]', '', 'g')), ''),
      'Оператор верстата'
    ),
    80
  );

  IF p_called_employee_id IS NOT NULL THEN
    SELECT NULLIF(BTRIM(CONCAT_WS(' ', su.first_name, su.last_name)), '')
    INTO v_employee_name
    FROM public.system_users AS su
    WHERE su.id = p_called_employee_id
      AND su.auth_user_id IS NOT NULL
      AND CASE p_called_role
        WHEN 'master' THEN
          su.access_rights @> ANY (ARRAY['{"master": true}'::JSONB, '{"foreman": true}'::JSONB)
          OR COALESCE(su.position, '') ILIKE '%майстер%'
        WHEN 'engineer' THEN
          su.access_rights @> '{"engineer": true}'::JSONB
          OR COALESCE(su.position, '') ILIKE '%інженер%'
        WHEN 'quality' THEN
          su.access_rights @> '{"brak": true}'::JSONB
          OR COALESCE(su.position, '') ILIKE '%вкя%'
          OR COALESCE(su.position, '') ILIKE '%якост%'
        ELSE FALSE
      END;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected employee cannot receive this call' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_machine_id::TEXT || ':' || p_called_role));

  SELECT c.id, c.created_at
  INTO v_call_id, v_created_at
  FROM public.machine_calls AS c
  WHERE c.machine_id = p_machine_id
    AND c.called_role = p_called_role
    AND c.status = 'pending'
  ORDER BY c.created_at
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'created', FALSE,
      'call', jsonb_build_object(
        'id', v_call_id,
        'called_role', p_called_role,
        'created_at', v_created_at
      )
    );
  END IF;

  IF (SELECT COUNT(*) FROM public.machine_calls AS c
      WHERE c.machine_id = p_machine_id
        AND c.created_at >= NOW() - INTERVAL '1 hour') >= 30 THEN
    RAISE EXCEPTION 'Machine call rate limit exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.machine_calls (
    id, machine_id, called_role, operator_name, called_employee_id,
    called_employee_name, status, created_at
  ) VALUES (
    gen_random_uuid(), p_machine_id, p_called_role, v_operator_name,
    p_called_employee_id, v_employee_name, 'pending', NOW()
  )
  RETURNING id, created_at INTO v_call_id, v_created_at;

  RETURN jsonb_build_object(
    'created', TRUE,
    'call', jsonb_build_object(
      'id', v_call_id,
      'called_role', p_called_role,
      'created_at', v_created_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_public_machine_call_context(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_public_create_machine_call(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_public_machine_call_context(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_public_create_machine_call(UUID, TEXT, TEXT, BIGINT) TO anon, authenticated, service_role;

