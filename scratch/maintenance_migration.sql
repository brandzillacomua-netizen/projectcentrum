-- 1. Додавання нових колонок у таблицю станків (machines)
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS completed_cards_count_since_maintenance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS maintenance_pending_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS maintenance_started_at TIMESTAMP WITH TIME ZONE;

-- 2. Створення таблиці логів обслуговування (machine_maintenance_logs)
CREATE TABLE IF NOT EXISTS public.machine_maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    performed_by TEXT, -- Логін або ім'я працівника, що виконав обслуговування
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    response_duration_seconds INTEGER, -- Час від блокування до початку ремонту
    maintenance_duration_seconds INTEGER, -- Час самого ремонту
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Додаємо індекси для швидкої вибірки історії по станку
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_machine_id ON public.machine_maintenance_logs(machine_id);

-- 4. Переконаємось, що RLS дозволяє читання/запис (якщо увімкнено RLS на таблицях)
ALTER TABLE public.machine_maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON public.machine_maintenance_logs;
CREATE POLICY "Allow all actions for authenticated users" 
ON public.machine_maintenance_logs 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read access" ON public.machine_maintenance_logs;
CREATE POLICY "Allow anon read access" 
ON public.machine_maintenance_logs 
FOR SELECT 
TO anon 
USING (true);

DROP POLICY IF EXISTS "Allow anon write/update" ON public.machine_maintenance_logs;
CREATE POLICY "Allow anon write/update" 
ON public.machine_maintenance_logs 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- 5. Створення таблиці конфігурацій системи (system_configs) та додавання тумблера для технологічного ремонту
CREATE TABLE IF NOT EXISTS public.system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions for authenticated users" ON public.system_configs;
CREATE POLICY "Allow all actions for authenticated users" 
ON public.system_configs 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read access" ON public.system_configs;
CREATE POLICY "Allow anon read access" 
ON public.system_configs 
FOR SELECT 
TO anon 
USING (true);

DROP POLICY IF EXISTS "Allow anon write/update" ON public.system_configs;
CREATE POLICY "Allow anon write/update" 
ON public.system_configs 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

INSERT INTO public.system_configs (key, value) 
VALUES ('maintenance_check_enabled', '{"enabled": false}'::jsonb) 
ON CONFLICT (key) DO NOTHING;
