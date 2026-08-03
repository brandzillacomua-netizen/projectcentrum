-- Internal VB rework orders are operational movements, not customer production
-- naryads. Exclude them at the source so they affect neither KPIs nor materials.
--
-- This follow-up is intentionally safe for databases where the monthly report
-- migration has already been deployed. The original migration is amended too,
-- so a clean installation gets the same definition directly.

do $exclude_vb_monthly_report$
declare
  v_definition text;
  v_search constant text := 'join public.orders o on o.id = t.order_id';
  v_replacement constant text := E'join public.orders o on o.id = t.order_id\n       and upper(btrim(o.order_num::text)) !~ ''^ВБ''';
begin
  select pg_get_functiondef('public.mes_monthly_report(date)'::regprocedure)
    into v_definition;

  -- Idempotent guard for environments where the amended base migration was
  -- used before this follow-up migration was registered.
  if position('upper(btrim(o.order_num::text)) !~ ''^ВБ''' in v_definition) > 0 then
    return;
  end if;

  if position(v_search in v_definition) = 0 then
    raise exception 'mes_monthly_report definition changed; VB exclusion was not applied';
  end if;

  v_definition := replace(v_definition, v_search, v_replacement);
  execute v_definition;
end;
$exclude_vb_monthly_report$;

comment on function public.mes_monthly_report(date) is
  'Bounded calendar-month MES report. Internal order numbers beginning with ВБ are excluded.';
