-- Migration: Add cutting_operation_timings table
-- Stores planned timings (in minutes) for each CNC cutting operation per machine type and sheet count loading.

CREATE TABLE IF NOT EXISTS public.cutting_operation_timings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomenclature_id UUID NOT NULL REFERENCES public.nomenclatures(id) ON DELETE CASCADE,
  machine_type TEXT NOT NULL,
  operation_name TEXT NOT NULL,
  side TEXT DEFAULT 'side1', -- 'side1', 'side2', 'side2_cut'
  timings JSONB DEFAULT '{}'::jsonb, -- e.g. {"1": 15, "2": 28, "3": 40, "4": 55, "8": 100}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_cutting_op_timing UNIQUE (nomenclature_id, machine_type, operation_name)
);

CREATE INDEX IF NOT EXISTS idx_cutting_op_timings_nom ON public.cutting_operation_timings(nomenclature_id);
CREATE INDEX IF NOT EXISTS idx_cutting_op_timings_machine ON public.cutting_operation_timings(machine_type);

-- Enable RLS and grant permissions
ALTER TABLE public.cutting_operation_timings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cutting_operation_timings' AND policyname = 'cutting_op_timings_select_all'
  ) THEN
    CREATE POLICY cutting_op_timings_select_all ON public.cutting_operation_timings
      FOR SELECT TO authenticated, anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cutting_operation_timings' AND policyname = 'cutting_op_timings_insert_all'
  ) THEN
    CREATE POLICY cutting_op_timings_insert_all ON public.cutting_operation_timings
      FOR INSERT TO authenticated, anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cutting_operation_timings' AND policyname = 'cutting_op_timings_update_all'
  ) THEN
    CREATE POLICY cutting_op_timings_update_all ON public.cutting_operation_timings
      FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cutting_operation_timings' AND policyname = 'cutting_op_timings_delete_all'
  ) THEN
    CREATE POLICY cutting_op_timings_delete_all ON public.cutting_operation_timings
      FOR DELETE TO authenticated, anon USING (true);
  END IF;
END $$;

GRANT ALL ON public.cutting_operation_timings TO authenticated, service_role, anon;

