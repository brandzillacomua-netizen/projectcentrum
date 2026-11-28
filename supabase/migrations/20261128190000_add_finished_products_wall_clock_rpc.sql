-- Wall-clock (merged overlapping intervals) report RPC for ProductionAutopilot
SET lock_timeout = '5s';
SET statement_timeout = '30s';

DROP FUNCTION IF EXISTS public.rpc_get_finished_products_wall_clock_report(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.rpc_get_finished_products_wall_clock_report(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE (
  scope TEXT,
  order_id UUID,
  nomenclature_id UUID,
  stage_group TEXT,
  wall_minutes NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH valid_logs AS (
    SELECT
      wc.order_id,
      COALESCE(h.nomenclature_id, wc.nomenclature_id) AS nom_id,
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
      h.started_at AS s_at,
      LEAST(h.completed_at, h.started_at + INTERVAL '48 hours') AS e_at
    FROM public.work_card_history h
    LEFT JOIN public.work_cards wc ON wc.id = h.card_id
    WHERE h.completed_at >= p_start
      AND h.completed_at <= p_end
      AND h.started_at IS NOT NULL
      AND h.completed_at IS NOT NULL
      AND h.completed_at > h.started_at
  ),
  scoped_intervals AS (
    SELECT 'part_stage'::TEXT AS scope, order_id, nom_id, stage_group, s_at, e_at FROM valid_logs
    UNION ALL
    SELECT 'part_total'::TEXT AS scope, order_id, nom_id, NULL::TEXT AS stage_group, s_at, e_at FROM valid_logs
    UNION ALL
    SELECT 'order_stage'::TEXT AS scope, order_id, NULL::UUID AS nom_id, stage_group, s_at, e_at FROM valid_logs
    UNION ALL
    SELECT 'order_total'::TEXT AS scope, order_id, NULL::UUID AS nom_id, NULL::TEXT AS stage_group, s_at, e_at FROM valid_logs
  ),
  ordered AS (
    SELECT
      scope,
      order_id,
      nom_id,
      stage_group,
      s_at,
      e_at,
      MAX(e_at) OVER (
        PARTITION BY scope, order_id, nom_id, stage_group
        ORDER BY s_at, e_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ) AS prev_max_end
    FROM scoped_intervals
  ),
  islands AS (
    SELECT
      scope,
      order_id,
      nom_id,
      stage_group,
      s_at,
      e_at,
      SUM(CASE WHEN prev_max_end IS NULL OR s_at > prev_max_end THEN 1 ELSE 0 END) OVER (
        PARTITION BY scope, order_id, nom_id, stage_group
        ORDER BY s_at, e_at
      ) AS island_id
    FROM ordered
  ),
  merged AS (
    SELECT
      scope,
      order_id,
      nom_id,
      stage_group,
      MIN(s_at) AS m_start,
      MAX(e_at) AS m_end
    FROM islands
    GROUP BY scope, order_id, nom_id, stage_group, island_id
  )
  SELECT
    scope,
    order_id,
    nom_id AS nomenclature_id,
    stage_group,
    ROUND(SUM(EXTRACT(EPOCH FROM (m_end - m_start)) / 60.0), 2) AS wall_minutes
  FROM merged
  GROUP BY scope, order_id, nom_id, stage_group
  ORDER BY scope, order_id NULLS LAST, nom_id NULLS LAST, stage_group NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.rpc_get_finished_products_wall_clock_report(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_finished_products_wall_clock_report(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
