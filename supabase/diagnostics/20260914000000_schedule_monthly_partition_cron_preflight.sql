-- Preflight check for monthly partition cron migration
SELECT count(*) FROM public.work_card_history;
