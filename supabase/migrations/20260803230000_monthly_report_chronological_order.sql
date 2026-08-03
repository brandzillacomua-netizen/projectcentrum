-- Keep monthly naryads in deterministic creation order (oldest first).
-- This patches databases where the preceding report function is already live;
-- clean installations receive the same ordering from the amended base migration.

do $monthly_report_chronological_order$
declare
  v_definition text;
  v_old constant text := '''naryads'', coalesce((select jsonb_agg(to_jsonb(n) order by n.last_activity desc nulls last, n.order_num) from naryad_rows n), ''[]''::jsonb)';
  v_new constant text := '''naryads'', coalesce((select jsonb_agg(to_jsonb(n) order by
      (select min(t.created_at) from public.tasks t where t.order_id = n.order_id
        and t.batch_index is not distinct from n.batch_index) asc,
      n.order_num, n.batch_index
    ) from naryad_rows n), ''[]''::jsonb)';
begin
  select pg_get_functiondef('public.mes_monthly_report(date)'::regprocedure)
    into v_definition;

  if position('select min(t.created_at) from public.tasks t where t.order_id = n.order_id' in v_definition) > 0 then
    return;
  end if;

  if position(v_old in v_definition) = 0 then
    raise exception 'mes_monthly_report definition changed; chronological ordering was not applied';
  end if;

  execute replace(v_definition, v_old, v_new);
end;
$monthly_report_chronological_order$;

comment on function public.mes_monthly_report(date) is
  'Monthly MES report assigned and ordered by first naryad task creation time.';
