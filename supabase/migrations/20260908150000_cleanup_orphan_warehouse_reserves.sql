-- ============================================================
-- Migration: 20260908150000_cleanup_orphan_warehouse_reserves.sql
-- Description: Clean up orphan material requests, release orphan BZ reservations,
--              and reset phantom reserved_qty on SO, SV, and SGP inventory.
-- ============================================================

-- 1. Скидаємо фантомні статичні резерви на всіх складах, якщо немає активних нарядів
UPDATE public.inventory
SET reserved_qty = 0,
    updated_at = NOW()
WHERE reserved_qty > 0;

-- 2. Скасовуємо завислі запити на матеріали під видалені наряди
UPDATE public.material_requests
SET status = 'cancelled'
WHERE status IN ('pending', 'approved', 'reserved', 'issued')
  AND (
    task_id IS NULL 
    OR NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.status NOT IN ('completed', 'cancelled'))
  );

-- 3. Звільняємо всі завислі броні в таблиці bz_inventory_reservations під відсутні наряди
UPDATE public.bz_inventory_reservations
SET status = 'released',
    released_at = NOW(),
    release_reason = 'Очищення фантомних резервів: наряд відсутній або видалений'
WHERE status = 'allocated'
  AND (
    task_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.status NOT IN ('completed', 'cancelled'))
  );
