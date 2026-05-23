-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 MIGRATION: CREATE machine_calls TABLE
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Додаємо статус до таблиці верстатів, якщо ще не додано
ALTER TABLE machines ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'idle';

-- 2. Створюємо таблицю викликів machine_calls
CREATE TABLE IF NOT EXISTS machine_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
  called_role TEXT NOT NULL,          -- 'master', 'engineer', 'qc'
  operator_name TEXT,                 -- ім'я оператора, який здійснив виклик
  status TEXT DEFAULT 'pending',      -- 'pending', 'resolved'
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

-- 3. Увімкнення Row Level Security (RLS)
ALTER TABLE machine_calls ENABLE ROW LEVEL SECURITY;

-- 4. Видалення старих політик безпеки, якщо вони є
DROP POLICY IF EXISTS "Allow public read and write" ON machine_calls;
DROP POLICY IF EXISTS "Allow anon read and write" ON machine_calls;

-- 5. Створення публічної політики для повного доступу (читання/запис без авторизації)
CREATE POLICY "Allow public read and write" ON machine_calls
  FOR ALL TO public USING (true) WITH CHECK (true);
