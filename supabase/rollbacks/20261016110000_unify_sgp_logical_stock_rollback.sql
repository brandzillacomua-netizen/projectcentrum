-- Rollback restores the previous single-row issuer from migration
-- 20261016090000_fix_packaging_sgp_id_reservations.sql.
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
begin
  select * into v_req from public.material_requests where id = p_request_id for update;
  if not found then return jsonb_build_object('success', false, 'message', 'Запит не знайдено'); end if;
  if v_req.status in ('issued', 'completed') then return jsonb_build_object('success', true, 'message', 'Запит вже видано'); end if;

  select * into v_inv
  from public.inventory i
  where i.nomenclature_id = v_req.nomenclature_id
    and (i.pocket_owner is null or i.pocket_owner = 'Не вказано')
    and lower(coalesce(i.type, '')) in ('finished', 'part', 'product', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2')
    and coalesce(i.total_qty, 0) - coalesce(i.reserved_qty, 0) >= coalesce(v_req.quantity, 0)
  order by (coalesce(i.total_qty, 0) - coalesce(i.reserved_qty, 0)) desc, i.id
  limit 1
  for update;

  if v_inv.id is null then return jsonb_build_object('success', false, 'message', 'Недостатньо вільного залишку СГП за ID номенклатури'); end if;

  update public.material_requests
  set status = 'issued', inventory_id = v_inv.id,
      details = coalesce(details, '') || ' [ВИДАНО СГП: ' || coalesce(nullif(trim(p_issuer_name), ''), 'Комірник СГП') || ' ' || to_char(now(), 'DD.MM.YYYY HH24:MI') || ']'
  where id = p_request_id;

  return jsonb_build_object('success', true, 'message', 'Позицію видано та зарезервовано для пакування');
end;
$$;

grant execute on function public.issue_packaging_request_from_sgp(uuid, text) to authenticated;
grant execute on function public.issue_packaging_request_from_sgp(uuid, text) to service_role;

drop function if exists public.normalize_sgp_identity(text);
