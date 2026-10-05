-- Read-only. Existing in-progress documents must be reconciled before using the new workflow.
SELECT status,count(*) FROM public.reception_docs GROUP BY status;
SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'
AND table_name IN ('reception_docs','inventory','nomenclatures_v2','purchase_requests');
