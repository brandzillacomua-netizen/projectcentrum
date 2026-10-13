-- Загальна кількість записів реєстру випуску СГП (для лічильника без завантаження всіх рядків).
-- Логіка відповідає buildSgpReceiptRegistry: записи історії пакування/СГП
-- + завершені картки без такого запису (крім броні БЗ).
create or replace function public.count_sgp_receipts()
returns bigint
language sql
stable
security invoker
as $$
  with receipts as (
    select h.card_id
    from public.work_card_history h
    where (h.stage_name ilike '%пакування%' or h.stage_name ilike '%сгп%')
      and coalesce(h.qty_completed, 0) > 0
  )
  select
    (select count(*) from receipts)
    + (
      select count(*)
      from public.work_cards c
      where c.status = 'completed'
        and coalesce(c.operation, '') not ilike '%склад бз%'
        and coalesce(c.card_info, '') not like '%[ЗІ СКЛАДУ БЗ]%'
        and not exists (select 1 from receipts r where r.card_id = c.id)
    );
$$;

grant execute on function public.count_sgp_receipts() to authenticated;
