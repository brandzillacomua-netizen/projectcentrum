-- rollout-contract: v1
-- risk: medium
-- transaction: transactional
-- preflight: supabase/diagnostics/20261016140000_atomic_warehouse_box_issue_preflight.sql
-- postcondition: supabase/diagnostics/20261016140000_atomic_warehouse_box_issue_postcondition.sql
-- rollback: supabase/rollbacks/20261016140000_atomic_warehouse_box_issue_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

ALTER TABLE public.work_cards
  ADD COLUMN IF NOT EXISTS is_box_issued boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS box_issued_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_work_cards_box_issued
  ON public.work_cards (is_box_issued)
  WHERE is_box_issued = true;

CREATE OR REPLACE FUNCTION public.issue_warehouse_box(
  p_card_id uuid,
  p_requests jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_card public.work_cards%ROWTYPE;
  v_request jsonb;
  v_request_id uuid;
  v_existing_request public.material_requests%ROWTYPE;
  v_nomenclature_id uuid;
  v_inventory_id uuid;
  v_quantity numeric;
  v_card_info text;
  v_processed integer := 0;
  v_issued_at timestamptz := clock_timestamp();
BEGIN
  IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.system_users su
    WHERE su.auth_user_id = auth.uid()
      AND (
        coalesce((su.access_rights->>'warehouse_boxes')::boolean, false)
        OR coalesce((su.access_rights->>'warehouse')::boolean, false)
        OR coalesce((su.access_rights->>'admin')::boolean, false)
        OR coalesce((su.access_rights->>'director')::boolean, false)
      )
  )) THEN
    RAISE EXCEPTION 'Warehouse boxes permission required' USING ERRCODE = '42501';
  END IF;

  IF p_card_id IS NULL THEN
    RAISE EXCEPTION 'card_id is required' USING ERRCODE = '22004';
  END IF;

  IF jsonb_typeof(coalesce(p_requests, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'requests must be a JSON array' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_card
  FROM public.work_cards wc
  WHERE wc.id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work card not found: %', p_card_id USING ERRCODE = 'P0002';
  END IF;

  IF coalesce(v_card.is_box_issued, false) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_issued', true,
      'card_id', v_card.id,
      'box_number', v_card.box_number,
      'issued_at', v_card.box_issued_at
    );
  END IF;

  IF NOT coalesce(v_card.is_box_prepared, false)
     AND position('[BOX_PREPARED:true]' IN coalesce(v_card.card_info, '')) = 0 THEN
    RAISE EXCEPTION 'Box is not prepared for work card %', p_card_id USING ERRCODE = 'P0001';
  END IF;

  IF nullif(btrim(coalesce(v_card.box_number, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Box number is missing for work card %', p_card_id USING ERRCODE = 'P0001';
  END IF;

  FOR v_request IN
    SELECT value FROM jsonb_array_elements(coalesce(p_requests, '[]'::jsonb))
  LOOP
    IF coalesce((v_request->>'is_synthetic')::boolean, false) THEN
      v_nomenclature_id := nullif(v_request->>'nomenclature_id', '')::uuid;
      v_inventory_id := nullif(v_request->>'inventory_id', '')::uuid;
      v_quantity := coalesce(nullif(v_request->>'quantity', '')::numeric, 0);

      IF v_nomenclature_id IS NULL OR v_quantity <= 0 THEN
        RAISE EXCEPTION 'Synthetic request requires nomenclature_id and positive quantity'
          USING ERRCODE = '22023';
      END IF;

      v_request_id := NULL;
      SELECT mr.id
      INTO v_request_id
      FROM public.material_requests mr
      WHERE mr.card_id = v_card.id
        AND mr.nomenclature_id = v_nomenclature_id
        AND mr.status IS DISTINCT FROM 'completed'
      ORDER BY mr.created_at DESC NULLS LAST, mr.id
      LIMIT 1
      FOR UPDATE;

      IF v_request_id IS NULL THEN
        INSERT INTO public.material_requests (
          order_id,
          task_id,
          card_id,
          nomenclature_id,
          inventory_id,
          quantity,
          status,
          details
        ) VALUES (
          v_card.order_id,
          v_card.task_id,
          v_card.id,
          v_nomenclature_id,
          v_inventory_id,
          v_quantity,
          'issued',
          nullif(v_request->>'details', '')
        )
        RETURNING id INTO v_request_id;
      ELSE
        UPDATE public.material_requests
        SET quantity = v_quantity,
            inventory_id = coalesce(v_inventory_id, inventory_id),
            status = 'issued',
            details = coalesce(nullif(v_request->>'details', ''), details)
        WHERE id = v_request_id;
      END IF;
    ELSE
      v_request_id := nullif(v_request->>'id', '')::uuid;
      IF v_request_id IS NULL THEN
        RAISE EXCEPTION 'Existing request id is required' USING ERRCODE = '22023';
      END IF;

      SELECT *
      INTO v_existing_request
      FROM public.material_requests mr
      WHERE mr.id = v_request_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Material request not found: %', v_request_id USING ERRCODE = 'P0002';
      END IF;

      IF NOT (
        v_existing_request.card_id = v_card.id
        OR (
          v_existing_request.card_id IS NULL
          AND v_existing_request.task_id = v_card.task_id
        )
      ) THEN
        RAISE EXCEPTION 'Material request % does not belong to work card %', v_request_id, v_card.id
          USING ERRCODE = '42501';
      END IF;

      IF v_existing_request.status IS DISTINCT FROM 'completed' THEN
        UPDATE public.material_requests
        SET status = 'issued'
        WHERE id = v_request_id;
      END IF;
    END IF;

    v_processed := v_processed + 1;
  END LOOP;

  v_card_info := btrim(coalesce(v_card.card_info, ''));
  IF position('[MATERIALS_ISSUED:true]' IN v_card_info) = 0 THEN
    v_card_info := btrim(v_card_info || ' [MATERIALS_ISSUED:true]');
  END IF;
  IF position('[BOX_ISSUED:true]' IN v_card_info) = 0 THEN
    v_card_info := btrim(v_card_info || ' [BOX_ISSUED:true]');
  END IF;

  UPDATE public.work_cards
  SET is_box_issued = true,
      box_issued_at = v_issued_at,
      card_info = v_card_info,
      status = CASE
        WHEN status IN ('waiting-cutters', 'waiting-materials') THEN 'new'
        ELSE status
      END
  WHERE id = v_card.id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_issued', false,
    'card_id', v_card.id,
    'box_number', v_card.box_number,
    'processed_requests', v_processed,
    'issued_at', v_issued_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_warehouse_box(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_warehouse_box(uuid, jsonb) TO authenticated, service_role;

COMMIT;
