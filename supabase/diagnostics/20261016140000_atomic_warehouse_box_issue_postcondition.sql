do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_cards' and column_name = 'is_box_issued'
  ) then
    raise exception 'Postcondition failed: work_cards.is_box_issued is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'work_cards' and column_name = 'box_issued_at'
  ) then
    raise exception 'Postcondition failed: work_cards.box_issued_at is missing';
  end if;

  if to_regprocedure('public.issue_warehouse_box(uuid,jsonb)') is null then
    raise exception 'Postcondition failed: issue_warehouse_box(uuid,jsonb) is missing';
  end if;
end;
$$;
