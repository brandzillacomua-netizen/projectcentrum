-- =============================================================================
-- Migration: Clean DB-level reserve reconciliation & auto-release on order/task closure
-- Matches reservationLedger.js terminal statuses without client workarounds.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_inventory_reserve_for_id(p_inventory_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_inventory_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.inventory i
  SET
    reserved_qty = COALESCE((
      SELECT SUM(mr.quantity)
      FROM public.material_requests mr
      LEFT JOIN public.orders o ON o.id = mr.order_id
      LEFT JOIN public.tasks t ON t.id = mr.task_id
      WHERE mr.inventory_id = p_inventory_id
        AND mr.status = 'issued'
        AND COALESCE(mr.quantity, 0) > 0
        AND (
          o.id IS NULL
          OR lower(btrim(COALESCE(o.status, ''))) <> ALL (ARRAY['shipped', 'completed', 'delivered', 'cancelled', 'archived', 'deleted'])
        )
        AND (
          t.id IS NULL
          OR lower(btrim(COALESCE(t.status, ''))) <> ALL (ARRAY['completed', 'cancelled', 'archived'])
        )
    ), 0),
    updated_at = now()
  WHERE i.id = p_inventory_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_inventory_reserve()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') AND OLD.inventory_id IS NOT NULL THEN
    IF TG_OP = 'DELETE' OR OLD.inventory_id IS DISTINCT FROM NEW.inventory_id THEN
      PERFORM public.reconcile_inventory_reserve_for_id(OLD.inventory_id);
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.inventory_id IS NOT NULL THEN
    PERFORM public.reconcile_inventory_reserve_for_id(NEW.inventory_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_inventory_reserve ON public.material_requests;
CREATE TRIGGER trg_reconcile_inventory_reserve
AFTER INSERT OR UPDATE OR DELETE ON public.material_requests
FOR EACH ROW EXECUTE FUNCTION public.reconcile_inventory_reserve();

-- Close leftover 'issued' requests when an order reaches a terminal status
CREATE OR REPLACE FUNCTION public.trg_release_reserves_on_order_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new_status TEXT := lower(btrim(COALESCE(NEW.status, '')));
  v_old_status TEXT := lower(btrim(COALESCE(OLD.status, '')));
BEGIN
  IF v_new_status = ANY (ARRAY['shipped', 'completed', 'delivered', 'cancelled', 'archived', 'deleted'])
     AND v_old_status IS DISTINCT FROM v_new_status THEN
    UPDATE public.material_requests
    SET status = 'completed'
    WHERE order_id = NEW.id
      AND status = 'issued';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_release_reserves ON public.orders;
CREATE TRIGGER trg_orders_release_reserves
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_release_reserves_on_order_close();

-- Close leftover 'issued' requests when a task reaches a terminal status
CREATE OR REPLACE FUNCTION public.trg_release_reserves_on_task_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new_status TEXT := lower(btrim(COALESCE(NEW.status, '')));
  v_old_status TEXT := lower(btrim(COALESCE(OLD.status, '')));
BEGIN
  IF v_new_status = ANY (ARRAY['completed', 'cancelled', 'archived'])
     AND v_old_status IS DISTINCT FROM v_new_status THEN
    UPDATE public.material_requests
    SET status = 'completed'
    WHERE task_id = NEW.id
      AND status = 'issued';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_release_reserves ON public.tasks;
CREATE TRIGGER trg_tasks_release_reserves
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_release_reserves_on_task_close();

-- One-time cleanup of existing 'issued' requests on already-closed orders/tasks
UPDATE public.material_requests mr
SET status = 'completed'
WHERE mr.status = 'issued'
  AND (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = mr.order_id
        AND lower(btrim(COALESCE(o.status, ''))) = ANY (ARRAY['shipped', 'completed', 'delivered', 'cancelled', 'archived', 'deleted'])
    )
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = mr.task_id
        AND lower(btrim(COALESCE(t.status, ''))) = ANY (ARRAY['completed', 'cancelled', 'archived'])
    )
  );
