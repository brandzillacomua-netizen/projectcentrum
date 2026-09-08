-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 FIX: machine_operations FK → nomenclatures_v2 + RLS Access Policy
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Очищуємо старі записи machine_operations де nomenclature_id не існує в nomenclatures_v2
-- 2. Видаляємо старий FK constraint на public.nomenclatures
-- 3. Додаємо новий FK constraint на public.nomenclatures_v2
-- 4. Надаємо повні права доступу на machine_operations (RLS) для anon та authenticated
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Видаляємо всі старі FK constraints на machine_operations
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.machine_operations'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.machine_operations DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- КРОК 2: Додаємо новий FK що посилається на nomenclatures_v2
-- (Якщо є старі записи, що посилаються на V1, вони не заблокують, якщо перевірити валідність)
DO $$
BEGIN
  -- Видаляємо записи, які не існують в nomenclatures_v2
  DELETE FROM public.machine_operations
  WHERE nomenclature_id NOT IN (SELECT id FROM public.nomenclatures_v2);

  ALTER TABLE public.machine_operations
    ADD CONSTRAINT machine_operations_nomenclature_id_fkey
      FOREIGN KEY (nomenclature_id)
      REFERENCES public.nomenclatures_v2(id)
      ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint already exists or could not be added directly: %', SQLERRM;
END;
$$;

-- КРОК 3: Індекси для швидкого пошуку операцій за номенклатурою
CREATE INDEX IF NOT EXISTS idx_machine_operations_nomenclature_id 
  ON public.machine_operations(nomenclature_id);

-- КРОК 4: Налаштування RLS політик для machine_operations
ALTER TABLE public.machine_operations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'machine_operations' 
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.machine_operations;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "machine_operations_mes_access" 
  ON public.machine_operations 
  FOR ALL 
  TO authenticated, anon 
  USING (true) 
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_operations TO anon, authenticated;
