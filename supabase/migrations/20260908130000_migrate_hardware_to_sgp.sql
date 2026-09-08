-- Migration: 20260908130000_migrate_hardware_to_sgp.sql
-- Перенесення всіх метизів, гвинтів, гайок, стійок та комплектуючих пакування з СО на СГП

-- 1. Перевести склад для всіх метизів та комплектуючих на 'sgp'
UPDATE public.inventory
SET warehouse = 'sgp',
    updated_at = NOW()
WHERE (
  type IN ('hardware', 'fastener', 'mount')
  OR LOWER(name) ~* '(гвинт|гайка|болт|шайба|стійка|накладка|тримач|метиз|кріплення|саморіз|втулка|фіксатор)'
)
AND (warehouse IS NULL OR warehouse = 'operational' OR warehouse = 'raw');

-- 2. Безпечна атомарна RPC-функція для видачі запиту пакування зі Складу Готової Продукції (СГП)
CREATE OR REPLACE FUNCTION public.issue_packaging_request_from_sgp(
  p_request_id BIGINT,
  p_issuer_name TEXT DEFAULT 'Комірник СГП'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req public.material_requests%ROWTYPE;
  v_inv public.inventory%ROWTYPE;
  v_qty NUMERIC;
BEGIN
  SELECT * INTO v_req FROM public.material_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Запит не знайдено');
  END IF;

  IF v_req.status = 'completed' OR v_req.status = 'issued' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Запит вже підтверджено та видано');
  END IF;

  v_qty := COALESCE(v_req.quantity, 0);

  -- Знайти відповідний запис залишку на СГП
  IF v_req.inventory_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.inventory WHERE id = v_req.inventory_id FOR UPDATE;
  ELSIF v_req.nomenclature_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.inventory 
    WHERE nomenclature_id = v_req.nomenclature_id AND warehouse = 'sgp'
    ORDER BY total_qty DESC LIMIT 1 FOR UPDATE;
  END IF;

  -- Якщо інвентар знайдено на СГП, списуємо фактичну кількість
  IF v_inv.id IS NOT NULL THEN
    UPDATE public.inventory
    SET total_qty = GREATEST(0, COALESCE(total_qty, 0) - v_qty),
        updated_at = NOW()
    WHERE id = v_inv.id;
  END IF;

  -- Оновлюємо статус запиту на completed (видано складом)
  UPDATE public.material_requests
  SET status = 'completed',
      inventory_id = COALESCE(v_inv.id, inventory_id),
      details = details || ' [ВИДАНО СГП: ' || p_issuer_name || ' ' || to_char(NOW(), 'DD.MM.YYYY HH24:MI') || ']'
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Позицію успішно видано з СГП');
END;
$$;
