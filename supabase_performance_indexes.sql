-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 PERFORMANCE INDEXES — CRM КУЛИЦЯ MES v2.4
-- Запустити в Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── system_users: вхід завжди по login ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_system_users_login
  ON system_users(login);

-- ── tasks: часті фільтри по order_id, status, completed_at ─────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_order_id
  ON tasks(order_id);

CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
  ON tasks(completed_at DESC NULLS LAST);

-- ── work_cards: основний фільтр при завантаженні в цех ─────────────────────
CREATE INDEX IF NOT EXISTS idx_work_cards_task_id
  ON work_cards(task_id);

CREATE INDEX IF NOT EXISTS idx_work_cards_status
  ON work_cards(status);

CREATE INDEX IF NOT EXISTS idx_work_cards_status_created
  ON work_cards(status, created_at ASC);

-- ── material_requests: фільтр по task_id, status ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_material_requests_task_id
  ON material_requests(task_id);

CREATE INDEX IF NOT EXISTS idx_material_requests_status
  ON material_requests(status);

CREATE INDEX IF NOT EXISTS idx_material_requests_order_id
  ON material_requests(order_id);

-- ── inventory: найчастіший JOIN — по nomenclature_id, warehouse, type ──────
CREATE INDEX IF NOT EXISTS idx_inventory_nomenclature_id
  ON inventory(nomenclature_id);

CREATE INDEX IF NOT EXISTS idx_inventory_warehouse
  ON inventory(warehouse);

CREATE INDEX IF NOT EXISTS idx_inventory_type
  ON inventory(type);

-- Composite для lookups типу: WHERE nomenclature_id = ? AND type = ?
CREATE INDEX IF NOT EXISTS idx_inventory_nom_type
  ON inventory(nomenclature_id, type);

-- ── orders: сортування по created_at, фільтр status ────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

-- ── reception_docs: фільтр status, task_id, order_id ───────────────────────
CREATE INDEX IF NOT EXISTS idx_reception_docs_status
  ON reception_docs(status);

CREATE INDEX IF NOT EXISTS idx_reception_docs_task_id
  ON reception_docs(task_id);

-- ── purchase_requests: фільтр task_id, status, destination_warehouse ────────
CREATE INDEX IF NOT EXISTS idx_purchase_requests_task_id
  ON purchase_requests(task_id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_status
  ON purchase_requests(status);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_dest_warehouse
  ON purchase_requests(destination_warehouse);

-- ── work_card_history: сортування по completed_at ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_work_card_history_completed_at
  ON work_card_history(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_card_history_card_id
  ON work_card_history(card_id);

-- ── management_tasks: фільтр status, created_at ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_management_tasks_status
  ON management_tasks(status);

-- ════════════════════════════════════════════════════════════════════════════
-- Перевірити результат:
-- SELECT schemaname, tablename, indexname FROM pg_indexes
-- WHERE schemaname = 'public' ORDER BY tablename, indexname;
-- ════════════════════════════════════════════════════════════════════════════
