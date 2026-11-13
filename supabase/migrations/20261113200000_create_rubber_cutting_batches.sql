-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 MIGRATION: Table for Shop 2 Rubber Cutting Batches & Operations
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rubber_cutting_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'in_progress', 'completed', 'cancelled'
  part_id UUID,
  part_code TEXT,
  part_name TEXT NOT NULL,
  part_size TEXT,
  raw_material_id UUID,
  raw_material_code TEXT,
  raw_material_name TEXT,
  sheets_count INTEGER NOT NULL DEFAULT 1,
  sheet_yield INTEGER NOT NULL DEFAULT 1,
  planned_quantity INTEGER NOT NULL DEFAULT 0,
  actual_quantity INTEGER NOT NULL DEFAULT 0,
  scrap_quantity INTEGER NOT NULL DEFAULT 0,
  scrap_reason TEXT,
  planned_duration_sec INTEGER NOT NULL DEFAULT 0,
  actual_duration_sec INTEGER NOT NULL DEFAULT 0,
  shift TEXT,
  operators TEXT[],
  operator_name TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_rubber_cutting_batches_status ON public.rubber_cutting_batches(status);
CREATE INDEX IF NOT EXISTS idx_rubber_cutting_batches_created_at ON public.rubber_cutting_batches(created_at DESC);

-- Enable RLS
ALTER TABLE public.rubber_cutting_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rubber_cutting_batches_mes_access ON public.rubber_cutting_batches;
CREATE POLICY rubber_cutting_batches_mes_access ON public.rubber_cutting_batches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubber_cutting_batches TO anon, authenticated;

