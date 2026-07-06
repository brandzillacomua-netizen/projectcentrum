create index if not exists idx_work_card_history_completed_at
  on public.work_card_history (completed_at desc);

create index if not exists idx_work_card_history_card_id
  on public.work_card_history (card_id);

create index if not exists idx_work_cards_active_created_at
  on public.work_cards (status, created_at desc);

create or replace function public.mes_production_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'totalProduced', coalesce(sum(coalesce(h.qty_completed, 0)) filter (
      where lower(trim(coalesce(h.stage_name, ''))) in (
        'пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'
      )
    ), 0),
    'totalScrap', coalesce(sum(coalesce(h.scrap_qty, 0)), 0),
    'historyCount', count(*)
  )
  from public.work_card_history h
  where (p_from is null or coalesce(h.completed_at, h.created_at) >= p_from)
    and (p_to is null or coalesce(h.completed_at, h.created_at) <= p_to);
$$;

grant execute on function public.mes_production_summary(timestamptz, timestamptz) to anon, authenticated;