do $postcondition$
declare
  v_definition text;
begin
  select pg_get_functiondef(to_regprocedure('public.issue_packaging_request_from_sgp(uuid,text)'))
  into v_definition;

  if v_definition is null then
    raise exception 'Missing issue_packaging_request_from_sgp(uuid,text)';
  end if;
  if v_definition not ilike '%i.nomenclature_id = v_req.nomenclature_id%' then
    raise exception 'SGP issue function does not resolve stock by nomenclature_id';
  end if;
  if v_definition ilike '%lower(%name%' or v_definition ilike '%ilike%name%' then
    raise exception 'SGP issue function still contains name-based inventory matching';
  end if;
end;
$postcondition$;
