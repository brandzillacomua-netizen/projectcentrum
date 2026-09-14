create or replace function public.vkya_classification_queue_changes(p_after_seq bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $body$
  with cursor_value as (
    select coalesce(max(change_seq), 0) as value
    from public.vkya_classification_queue_projection
  ),
  selected as (
    select source_type, source_id, payload, is_active, change_seq, changed_at
    from public.vkya_classification_queue_projection
    where case when p_after_seq is null then is_active else change_seq > p_after_seq end
    order by change_seq
  )
  select jsonb_build_object(
    'cursor', (select value from cursor_value),
    'changes', coalesce((select jsonb_agg(to_jsonb(selected)) from selected), '[]'::jsonb)
  );
$body$;

revoke all on function public.vkya_classification_queue_changes(bigint) from public;
grant execute on function public.vkya_classification_queue_changes(bigint) to anon, authenticated;
