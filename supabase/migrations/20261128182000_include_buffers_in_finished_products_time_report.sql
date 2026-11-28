-- Include per-stage buffer durations in Finished Products Actual Time Report (ProductionAutopilot)
SET lock_timeout = '5s';
SET statement_timeout = '30s';

DROP FUNCTION IF EXISTS public.rpc_get_finished_products_time_report(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.rpc_get_finished_products_time_report(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE (
  order_id UUID,
  nomenclature_id UUID,
  stage_group TEXT,
  total_minutes NUMERIC,
  qty_completed NUMERIC,
  scrap_qty NUMERIC,
  cards_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_logs AS (
    SELECT
      h.card_id,
      COALESCE(h.nomenclature_id, wc.nomenclature_id) AS nom_id,
      wc.order_id,
      COALESCE(wc.quantity, 0)::NUMERIC AS card_qty,
      CASE
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(буфер|buffer|очікув)' THEN
          CASE
            WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(розкрій|порізк|чпу|фрез)' THEN 'Буфер Розкрій'
            WHEN LOWER(COALESCE(h.stage_name, '')) ~ 'галтов' THEN 'Буфер Галтовка'
            WHEN LOWER(COALESCE(h.stage_name, '')) ~ 'прийом' THEN 'Буфер Прийомка'
            WHEN LOWER(COALESCE(h.stage_name, '')) ~ 'сортув' THEN 'Буфер Сортування'
            WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(пресув|прес)' THEN 'Буфер Пресування'
            WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(фарбув|маляр)' THEN 'Буфер Фарбування'
            WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(доопрац|реставр)' THEN 'Буфер Доопрацювання'
            ELSE 'Буфер Інше'
          END
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(розкрій|порізк|чпу|фрез)' THEN 'Розкрій'
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ 'галтов' THEN 'Галтовка'
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ 'прийом' THEN 'Прийомка'
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ 'сортув' THEN 'Сортування'
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(пресув|прес)' THEN 'Пресування'
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(фарбув|маляр)' THEN 'Фарбування'
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(доопрац|реставр)' THEN 'Доопрацювання'
        WHEN LOWER(COALESCE(h.stage_name, '')) ~ '(пакув|сгп)' THEN 'Пакування'
        ELSE 'Інше'
      END AS stage_group,
      CASE
        WHEN h.started_at IS NOT NULL AND h.completed_at IS NOT NULL AND h.completed_at > h.started_at THEN
          LEAST(48 * 60, GREATEST(0, EXTRACT(EPOCH FROM (h.completed_at - h.started_at)) / 60.0))
        ELSE 0
      END::NUMERIC AS mins,
      COALESCE(h.qty_completed, 0)::NUMERIC AS log_qty,
      COALESCE(h.scrap_qty, 0)::NUMERIC AS log_scrap
    FROM public.work_card_history h
    LEFT JOIN public.work_cards wc ON wc.id = h.card_id
    WHERE h.completed_at >= p_start
      AND h.completed_at <= p_end
  ),
  per_card_stage AS (
    SELECT
      order_id,
      nom_id,
      stage_group,
      card_id,
      SUM(mins) AS mins_sum,
      CASE
        WHEN MAX(card_qty) > 0 THEN LEAST(MAX(card_qty), SUM(log_qty))
        ELSE SUM(log_qty)
      END AS qty_capped,
      SUM(log_scrap) AS scrap_sum
    FROM filtered_logs
    GROUP BY order_id, nom_id, stage_group, card_id
  )
  SELECT
    order_id,
    nom_id AS nomenclature_id,
    stage_group,
    ROUND(SUM(mins_sum), 2) AS total_minutes,
    ROUND(SUM(qty_capped), 2) AS qty_completed,
    ROUND(SUM(scrap_sum), 2) AS scrap_qty,
    COUNT(DISTINCT card_id)::BIGINT AS cards_count
  FROM per_card_stage
  GROUP BY order_id, nom_id, stage_group;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_finished_products_time_report(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_finished_products_time_report(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
