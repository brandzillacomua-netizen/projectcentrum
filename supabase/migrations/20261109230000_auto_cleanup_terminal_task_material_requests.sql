-- Migration: Auto-cleanup material requests for completed/cancelled tasks and orders
-- Description: Ensures no orphaned reservations linger in public.material_requests when tasks or orders finish.

-- 1. One-time backfill: mark orphaned material requests as 'completed'
UPDATE public.material_requests mr
SET status = 'completed',
    updated_at = now()
FROM public.tasks t
WHERE mr.task_id = t.id
  AND mr.status = 'issued'
  AND lower(coalesce(t.status, '')) IN ('completed', 'cancelled', 'archived');

UPDATE public.material_requests mr
SET status = 'completed',
    updated_at = now()
FROM public.orders o
WHERE mr.order_id = o.id
  AND mr.status = 'issued'
  AND lower(coalesce(o.status, '')) IN ('completed', 'delivered', 'shipped', 'cancelled', 'archived');

-- 2. Trigger function to auto-complete material requests when a task is completed/cancelled
CREATE OR REPLACE FUNCTION public.cleanup_terminal_task_material_requests()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled', 'archived') THEN
    UPDATE public.material_requests
    SET status = 'completed',
        updated_at = now()
    WHERE task_id = NEW.id
      AND status IN ('issued', 'pending', 'reserved', 'approved');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_terminal_task_material_requests ON public.tasks;
CREATE TRIGGER trg_cleanup_terminal_task_material_requests
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
WHEN (NEW.status IN ('completed', 'cancelled', 'archived'))
EXECUTE FUNCTION public.cleanup_terminal_task_material_requests();

-- 3. Trigger function to auto-complete material requests when an order is completed/shipped/cancelled
CREATE OR REPLACE FUNCTION public.cleanup_terminal_order_material_requests()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('completed', 'delivered', 'shipped', 'cancelled', 'archived') THEN
    UPDATE public.material_requests
    SET status = 'completed',
        updated_at = now()
    WHERE order_id = NEW.id
      AND status IN ('issued', 'pending', 'reserved', 'approved');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_terminal_order_material_requests ON public.orders;
CREATE TRIGGER trg_cleanup_terminal_order_material_requests
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status IN ('completed', 'delivered', 'shipped', 'cancelled', 'archived'))
EXECUTE FUNCTION public.cleanup_terminal_order_material_requests();

-- 4. Reconcile all inventory reserved_qty against current active issued requests
UPDATE public.inventory i
SET reserved_qty = COALESCE((
  SELECT sum(mr.quantity)
  FROM public.material_requests mr
  WHERE mr.inventory_id = i.id
    AND mr.status = 'issued'
), 0),
updated_at = now()
WHERE i.reserved_qty IS DISTINCT FROM COALESCE((
  SELECT sum(mr.quantity)
  FROM public.material_requests mr
  WHERE mr.inventory_id = i.id
    AND mr.status = 'issued'
), 0);

