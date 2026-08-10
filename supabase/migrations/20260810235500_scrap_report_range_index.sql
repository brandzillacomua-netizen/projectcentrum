-- Speeds up the Reports > Scrap date-range query. The partial index contains
-- only actual scrap rows, so PostgreSQL does not scan the full operation history.
create index if not exists idx_work_card_history_scrap_report_range
  on public.work_card_history (completed_at desc, id desc)
  include (nomenclature_id, operator_name, shift_name, stage_name, scrap_qty, qc_scrap_comment)
  where completed_at is not null and scrap_qty > 0;
