begin;

create or replace function public.issue_packaging_request_from_sgp(
  p_request_id uuid,
  p_issuer_name text default 'Комірник СГП'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_req public.material_requests%rowtype;
  v_inv public.inventory%rowtype;
  v_qty numeric;
begin
  select * into v_req from public.material_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Запит не знайдено');
  end if;

  if v_req.status = 'completed' or v_req.status = 'issued' then
    return jsonb_build_object('success', true, 'message', 'Запит вже підтверджено та видано');
  end if;

  v_qty := coalesce(v_req.quantity, 0);

  if v_req.inventory_id is not null then
    select * into v_inv from public.inventory where id = v_req.inventory_id for update;
  elsif v_req.nomenclature_id is not null then
    select * into v_inv from public.inventory
    where nomenclature_id = v_req.nomenclature_id and warehouse = 'sgp'
    order by total_qty desc limit 1 for update;
  end if;

  if v_inv.id is not null then
    update public.inventory
    set total_qty = greatest(0, coalesce(total_qty, 0) - v_qty),
        updated_at = now()
    where id = v_inv.id;
  end if;

  update public.material_requests
  set status = 'completed',
      inventory_id = coalesce(v_inv.id, inventory_id),
      details = details || ' [ВИДАНО СГП: ' || p_issuer_name || ' ' || to_char(now(), 'DD.MM.YYYY HH24:MI') || ']'
  where id = p_request_id;

  return jsonb_build_object('success', true, 'message', 'Позицію успішно видано з СГП');
end;
$$;

commit;
