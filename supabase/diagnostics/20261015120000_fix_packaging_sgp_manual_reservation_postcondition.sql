do $postcondition$
declare
  v_definition text;
begin
  if to_regprocedure('public.issue_packaging_request_from_sgp(uuid,text)') is null then
    raise exception 'Missing issue_packaging_request_from_sgp(uuid,text)';
  end if;

  select pg_get_functiondef(to_regprocedure('public.issue_packaging_request_from_sgp(uuid,text)'))
  into v_definition;

  if v_definition not ilike '%set status = ''issued''%' then
    raise exception 'SGP issue function does not reserve requests with issued status';
  end if;
  if v_definition ilike '%set total_qty = greatest%' then
    raise exception 'SGP issue function still deducts physical stock during reservation';
  end if;

  if exists (
    select 1
    from public.material_requests
    where status = 'issued'
      and inventory_id is null
      and (details ilike '%[PACKAGING_SOURCE:SGP]%' or details ilike '%[PACKAGING_SOURCE:BZ]%')
      and details not ilike '%[ВИДАНО СГП:%'
  ) then
    raise exception 'Auto-issued packaging requests without an SGP stock link remain';
  end if;
end;
$postcondition$;
