-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 КОНСОЛІДАЦІЯ ГОТОВОЇ ПРОДУКЦІЇ В ОДИН РЯДОК НА СГП (ДЛЯ ВСІХ ДЕТАЛЕЙ)
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Знайти ВСІ номенклатури на підприємстві, які мають дублюючі записи
--    готової продукції (finished, bz) на різних складах (sgp, operational).
-- 2. Схлопнути їх в ОДИН єдиний запис на кожну деталь на складі СГП (warehouse = 'sgp')
--    з повною сумарною кількістю.
-- 3. Встановити UNIQUE індекс, який фізично унеможливить появу дублів у майбутньому.
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Створюємо тимчасову таблицю зі злитими сумами по ВСІХ деталях бази
CREATE TEMP TABLE tmp_pure_finished AS
SELECT 
  nomenclature_id,
  MIN(name) AS name,
  MIN(unit) AS unit,
  SUM(COALESCE(total_qty, 0)) AS total_qty,
  SUM(COALESCE(reserved_qty, 0)) AS reserved_qty,
  MIN(id::text)::uuid AS master_id
FROM public.inventory
WHERE type IN ('finished', 'bz')
  AND (pocket_owner IS NULL OR pocket_owner = 'Не вказано')
  AND nomenclature_id IS NOT NULL
GROUP BY nomenclature_id;

-- КРОК 2: Видаляємо всі дублюючі рядки, залишаючи строго один master_id на деталь
DELETE FROM public.inventory
WHERE type IN ('finished', 'bz')
  AND (pocket_owner IS NULL OR pocket_owner = 'Не вказано')
  AND nomenclature_id IS NOT NULL
  AND id NOT IN (SELECT master_id FROM tmp_pure_finished);

-- КРОК 3: Оновлюємо master-запис повною сумарною кількістю та фіксуємо склад СГП
UPDATE public.inventory i
SET total_qty = t.total_qty,
    reserved_qty = t.reserved_qty,
    type = 'finished',
    warehouse = 'sgp',
    pocket_owner = NULL,
    updated_at = NOW()
FROM tmp_pure_finished t
WHERE i.id = t.master_id;

DROP TABLE IF EXISTS tmp_pure_finished;

-- КРОК 4: Захисний UNIQUE індекс на СГП — захищає всю базу від дублів назавжди
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_sgp_nomenclature
ON public.inventory (nomenclature_id)
WHERE type = 'finished' AND warehouse = 'sgp';

-- КРОК 5: Перевірка результатів (показує об'єднані позиції)
SELECT
  i.id,
  i.name,
  i.nomenclature_id,
  v2.code AS v2_code,
  i.total_qty,
  i.reserved_qty,
  i.type,
  i.warehouse
FROM public.inventory i
LEFT JOIN public.nomenclatures_v2 v2 ON v2.id = i.nomenclature_id
WHERE i.name ILIKE '%Київ К-ІП9/10/31/36/37%'
ORDER BY i.name, i.type;
