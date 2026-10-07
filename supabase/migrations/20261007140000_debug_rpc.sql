CREATE OR REPLACE FUNCTION rpc_get_cards_debug(p_task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res JSONB;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'status', status,
    'quantity', quantity,
    'card_info', card_info
  )) INTO v_res
  FROM work_cards
  WHERE task_id = p_task_id;
  RETURN v_res;
END;
$$;
