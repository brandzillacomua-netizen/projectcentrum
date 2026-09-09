-- ═══════════════════════════════════════════════════════════════════════════
-- 📦 CENTRUM MES: Full Inventory Schema for Staging Warehouses (СО, СВ, СГП)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS nomenclature_id uuid REFERENCES public.nomenclatures_v2(id) ON DELETE SET NULL;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS warehouse text DEFAULT 'production';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS total_qty numeric DEFAULT 0;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS reserved_qty numeric DEFAULT 0;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS type text DEFAULT 'raw';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS pocket_owner text;

CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON public.inventory(warehouse);
CREATE INDEX IF NOT EXISTS idx_inventory_nomenclature_id ON public.inventory(nomenclature_id);

GRANT ALL ON public.inventory TO anon, authenticated, service_role;
