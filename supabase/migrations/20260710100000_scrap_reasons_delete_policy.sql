grant delete on public.scrap_reasons to anon, authenticated;

drop policy if exists "scrap_reasons_delete" on public.scrap_reasons;
create policy "scrap_reasons_delete" on public.scrap_reasons
  for delete to anon, authenticated using (true);
