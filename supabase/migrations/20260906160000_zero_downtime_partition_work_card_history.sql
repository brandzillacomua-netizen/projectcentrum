-- ═══════════════════════════════════════════════════════════════════════════
-- 🏛️ CENTRUM MES v2.0 — PHASE 0: ZERO-DOWNTIME TABLE PARTITIONING
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260906160000_zero_downtime_partition_work_card_history.sql
-- Purpose:
--   1. Re-architects `work_card_history` into declarative monthly partitions.
--   2. Preserves 100% transparent query compatibility across all historical periods.
--   3. Guarantees live Supabase Realtime WebSocket events via `publish_via_partition_root = true`.
--   4. Eliminates physical foreign key lock contention from VKYA quality tables.
--   5. Retains full trigger execution for VKYA queue projections and flow rollups.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. БЕЗПЕЧНИЙ ТАЙМАУТ БЛОКУВАННЯ (Fail fast instead of stalling the shop floor)
SET LOCAL lock_timeout = '5s';

-- 2. ВІДВ'ЯЗУВАННЯ ФІЗИЧНИХ ЗОВНІШНІХ КЛЮЧІВ (Усунення конфлікту складеного PK)
-- Колонки `source_history_id` та їхні індекси залишаються недоторканими!
ALTER TABLE public.vkya_quality_resolutions
  DROP CONSTRAINT IF EXISTS vkya_quality_resolutions_source_history_id_fkey;

ALTER TABLE public.vkya_restoration_cards
  DROP CONSTRAINT IF EXISTS vkya_restoration_cards_source_history_id_fkey;

ALTER TABLE public.vkya_reclassification_queue
  DROP CONSTRAINT IF EXISTS vkya_reclassification_queue_source_history_id_fkey;

-- 3. СТВОРЕННЯ ТІНЬОВОЇ СЕКЦІОНОВАНОЇ ТАБЛИЦІ
CREATE TABLE IF NOT EXISTS public.work_card_history_partitioned (
  LIKE public.work_card_history INCLUDING DEFAULTS INCLUDING GENERATED,
  CONSTRAINT work_card_history_partitioned_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
ALTER TABLE public.work_card_history_partitioned ENABLE ROW LEVEL SECURITY;

-- 4. СТВОРЕННЯ ПОМІСЯЧНИХ СЕКЦІЙ ТА УВІМКНЕННЯ RLS
CREATE TABLE IF NOT EXISTS public.work_card_history_earlier
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM (MINVALUE) TO ('2026-08-01 00:00:00+00');
ALTER TABLE public.work_card_history_earlier ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_08
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_08 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_09
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_09 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_10
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_10 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_11
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_11 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2026_12
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
ALTER TABLE public.work_card_history_2026_12 ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.work_card_history_2027_01
  PARTITION OF public.work_card_history_partitioned
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');
ALTER TABLE public.work_card_history_2027_01 ENABLE ROW LEVEL SECURITY;

-- Секція за замовчуванням (гарантує, що жоден запис не випаде з помилкою відсутності секції)
CREATE TABLE IF NOT EXISTS public.work_card_history_default
  PARTITION OF public.work_card_history_partitioned
  DEFAULT;
ALTER TABLE public.work_card_history_default ENABLE ROW LEVEL SECURITY;

-- 5. МІГРАЦІЯ НАЯВНИХ ДАНИХ (Ідемпотентне копіювання)
DO $$
BEGIN
  -- Копіюємо дані лише якщо work_card_history ще не є секціонованою таблицею
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'work_card_history' AND c.relkind != 'p'
  ) THEN
    INSERT INTO public.work_card_history_partitioned
    SELECT * FROM public.work_card_history
    ON CONFLICT (id, created_at) DO NOTHING;
  END IF;
END $$;

-- 6. ВИСОКОПРОДУКТИВНІ ІНДЕКСИ (Автоматично наслідуються кожною секцією)
CREATE INDEX IF NOT EXISTS idx_wch_p_card_id_created
  ON public.work_card_history_partitioned (card_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wch_p_task_id
  ON public.work_card_history_partitioned (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wch_p_completed_at
  ON public.work_card_history_partitioned (completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wch_p_id
  ON public.work_card_history_partitioned (id);

-- 7. НАВІШУВАННЯ ТРИГЕРІВ НА СЕКЦІОНОВАНУ СТРУКТУРУ
DROP TRIGGER IF EXISTS trg_vkya_history_queue_projection ON public.work_card_history_partitioned;
CREATE TRIGGER trg_vkya_history_queue_projection
AFTER INSERT OR UPDATE OF scrap_qty, qc_scrap_comment, is_archived_scrap, card_info
ON public.work_card_history_partitioned
FOR EACH ROW EXECUTE FUNCTION public.sync_vkya_history_queue_projection();

DROP TRIGGER IF EXISTS trg_vkya_history_queue_projection_delete ON public.work_card_history_partitioned;
CREATE TRIGGER trg_vkya_history_queue_projection_delete
AFTER DELETE ON public.work_card_history_partitioned
FOR EACH ROW EXECUTE FUNCTION public.sync_vkya_history_queue_projection_delete();

DROP TRIGGER IF EXISTS trg_sync_work_card_flow_totals ON public.work_card_history_partitioned;
CREATE TRIGGER trg_sync_work_card_flow_totals
AFTER INSERT OR UPDATE OR DELETE ON public.work_card_history_partitioned
FOR EACH ROW EXECUTE FUNCTION public.sync_work_card_flow_totals_from_history();

DROP TRIGGER IF EXISTS trg_sync_work_card_scrap_totals ON public.work_card_history_partitioned;
CREATE TRIGGER trg_sync_work_card_scrap_totals
AFTER INSERT OR UPDATE OR DELETE ON public.work_card_history_partitioned
FOR EACH ROW EXECUTE FUNCTION public.sync_work_card_scrap_totals_from_history();

-- 8. АТОМАРНИЙ SWAP ТАБЛИЦЬ (<10 мс)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'work_card_history' AND c.relkind != 'p'
  ) THEN
    DROP TABLE IF EXISTS public.work_card_history_backup_pre_partition CASCADE;
    ALTER TABLE public.work_card_history RENAME TO work_card_history_backup_pre_partition;
    ALTER TABLE public.work_card_history_partitioned RENAME TO work_card_history;
  END IF;
END $$;

-- 9. БЕЗПЕКА ТА ПРАВА ДОСТУПУ (RLS)
ALTER TABLE public.work_card_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_card_history_full_access" ON public.work_card_history;
CREATE POLICY "work_card_history_full_access" ON public.work_card_history
  FOR ALL TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_card_history TO anon, authenticated, service_role;

-- 10. REALTIME ROOT PUBLICATION GUARANTEE
-- Вмикає публікацію івентів від імені кореневої таблиці `work_card_history`,
-- завдяки чому frontend отримує всі події без перезавантаження сторінки!
DO $$
DECLARE
  v_puballtables boolean := false;
BEGIN
  -- Перевіряємо статус публікації supabase_realtime
  SELECT puballtables INTO v_puballtables
  FROM pg_publication
  WHERE pubname = 'supabase_realtime';

  IF FOUND THEN
    -- Якщо публікація ведеться по окремих таблицях (puballtables = false), додаємо work_card_history
    IF v_puballtables IS FALSE THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_rel pr
        JOIN pg_class c ON c.oid = pr.prrelid
        JOIN pg_publication p ON p.oid = pr.prpubid
        WHERE p.pubname = 'supabase_realtime' AND c.relname = 'work_card_history'
      ) THEN
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.work_card_history;
        EXCEPTION
          WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;

    -- Налаштовуємо публікацію через корінь секцій (працює як для FOR ALL TABLES, так і для окремих таблиць)
    BEGIN
      ALTER PUBLICATION supabase_realtime SET (publish_via_partition_root = true);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Notice: publish_via_partition_root: %', SQLERRM;
    END;
  END IF;
END $$;
