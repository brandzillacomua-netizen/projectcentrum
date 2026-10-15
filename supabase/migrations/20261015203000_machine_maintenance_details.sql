-- Structured maintenance details for the machine dossier.
-- Existing automatic cleaning logs remain valid and are displayed with a
-- backward-compatible default label.

ALTER TABLE IF EXISTS public.machine_maintenance_logs
  ADD COLUMN IF NOT EXISTS maintenance_type text,
  ADD COLUMN IF NOT EXISTS machine_head text,
  ADD COLUMN IF NOT EXISTS spare_part text,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE IF EXISTS public.machine_maintenance_logs
  DROP CONSTRAINT IF EXISTS machine_maintenance_logs_machine_head_check;

ALTER TABLE IF EXISTS public.machine_maintenance_logs
  ADD CONSTRAINT machine_maintenance_logs_machine_head_check
  CHECK (machine_head IS NULL OR machine_head IN ('1 Голова', '2 Голова', '3 Голова', '4 Голова'));
