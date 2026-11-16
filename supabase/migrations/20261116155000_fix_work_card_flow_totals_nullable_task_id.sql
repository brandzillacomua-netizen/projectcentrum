-- Allow manual/buffer work_cards without task_id (e.g. Shop 2 cards)
-- to complete and transfer to SGP without violating NOT NULL on work_card_flow_totals.task_id.

ALTER TABLE public.work_card_flow_totals
  ALTER COLUMN task_id DROP NOT NULL;

