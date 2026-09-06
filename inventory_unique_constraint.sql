-- ============================================================================
-- CENTRUM MES: INVENTORY BULLETPROOF INTEGRITY (2026)
-- Створення унікального індексу на рівні ядра PostgreSQL.
-- Запобігає дублюванню залишків на складі при будь-яких одночасних діях.
-- ============================================================================

-- Унікальний складений індекс:
-- Гарантує, що для кожної номенклатури в межах одного складу (або персональної кишені оператора)
-- існує РІВНО ОДИН рядок залишку.
-- Повторний INSERT фізично блокується базою даних.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_item 
ON inventory (
  nomenclature_id, 
  COALESCE(type, 'standard'), 
  COALESCE(warehouse, 'main'), 
  COALESCE(pocket_owner, 'none')
)
WHERE nomenclature_id IS NOT NULL;

-- Перевірка стану створеного індексу
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'inventory' AND indexname = 'uq_inventory_item';
