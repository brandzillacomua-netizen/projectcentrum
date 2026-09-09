-- Migration: Add barcode and qr_code to nomenclatures_v2
-- Generated: 2026-09-09

ALTER TABLE public.nomenclatures_v2
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS qr_code text;

CREATE INDEX IF NOT EXISTS idx_nomenclatures_v2_barcode ON public.nomenclatures_v2(barcode);
CREATE INDEX IF NOT EXISTS idx_nomenclatures_v2_qr_code ON public.nomenclatures_v2(qr_code);

-- Backfill barcodes and qr_codes for all existing items where barcode is empty
UPDATE public.nomenclatures_v2
SET 
  barcode = COALESCE(NULLIF(barcode, ''), NULLIF(code, ''), 'V2-' || SUBSTRING(id::text, 1, 8)),
  qr_code = COALESCE(NULLIF(qr_code, ''), NULLIF(code, ''), 'V2-' || SUBSTRING(id::text, 1, 8))
WHERE barcode IS NULL OR barcode = '' OR qr_code IS NULL OR qr_code = '';

NOTIFY pgrst, 'reload schema';
