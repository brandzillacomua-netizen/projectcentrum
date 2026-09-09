-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 ДЕДУБЛІКАЦІЯ СГП-ІНВЕНТАРЮ (v2) — усуває дублі після імпорту
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Перевіряємо і дропаємо старий неповний індекс (якщо є)
DROP INDEX IF EXISTS uq_inventory_sgp_nomenclature;

-- КРОК 1.5: Актуалізуємо nomenclature_id в inventory за активним довідником номенклатур (усуває биті/старі ID)
UPDATE public.inventory i
SET nomenclature_id = n.id
FROM public.nomenclatures n
WHERE lower(trim(i.name)) = lower(trim(n.name))
  AND (i.nomenclature_id IS NULL OR i.nomenclature_id != n.id);

-- КРОК 2: Знаходимо дублі по nomenclature_id і зливаємо в один рядок
-- Зберігаємо той рядок де більший total_qty (або мінімальний id як tie-breaker)
CREATE TEMP TABLE tmp_sgp_keep AS
SELECT DISTINCT ON (nomenclature_id)
  id AS keep_id,
  nomenclature_id,
  SUM(total_qty) OVER (PARTITION BY nomenclature_id) AS merged_total,
  SUM(reserved_qty) OVER (PARTITION BY nomenclature_id) AS merged_reserved
FROM public.inventory
WHERE type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product')
  AND warehouse = 'sgp'
  AND pocket_owner IS NULL
  AND nomenclature_id IS NOT NULL
ORDER BY nomenclature_id, total_qty DESC, id ASC;

-- КРОК 3: Оновлюємо master-рядок злитими значеннями
UPDATE public.inventory i
SET
  total_qty   = t.merged_total,
  reserved_qty = LEAST(t.merged_reserved, t.merged_total),
  updated_at  = NOW()
FROM tmp_sgp_keep t
WHERE i.id = t.keep_id;

-- КРОК 4: Видаляємо всі зайві дублі (не master-рядки) по nomenclature_id
DELETE FROM public.inventory
WHERE type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product')
  AND warehouse = 'sgp'
  AND pocket_owner IS NULL
  AND nomenclature_id IS NOT NULL
  AND id NOT IN (SELECT keep_id FROM tmp_sgp_keep);

DROP TABLE IF EXISTS tmp_sgp_keep;

-- КРОК 5: Те саме для записів без nomenclature_id — дедубл по name
CREATE TEMP TABLE tmp_sgp_nonom_keep AS
SELECT DISTINCT ON (lower(trim(name)))
  id AS keep_id,
  lower(trim(name)) AS norm_name,
  SUM(total_qty) OVER (PARTITION BY lower(trim(name))) AS merged_total,
  SUM(reserved_qty) OVER (PARTITION BY lower(trim(name))) AS merged_reserved
FROM public.inventory
WHERE type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product')
  AND warehouse = 'sgp'
  AND pocket_owner IS NULL
  AND nomenclature_id IS NULL
ORDER BY lower(trim(name)), total_qty DESC, id ASC;

UPDATE public.inventory i
SET
  total_qty    = t.merged_total,
  reserved_qty = LEAST(t.merged_reserved, t.merged_total),
  updated_at   = NOW()
FROM tmp_sgp_nonom_keep t
WHERE i.id = t.keep_id;

DELETE FROM public.inventory
WHERE type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product')
  AND warehouse = 'sgp'
  AND pocket_owner IS NULL
  AND nomenclature_id IS NULL
  AND id NOT IN (SELECT keep_id FROM tmp_sgp_nonom_keep);

DROP TABLE IF EXISTS tmp_sgp_nonom_keep;

-- КРОК 6: Відновлюємо захисний UNIQUE індекс (тільки для рядків з nomenclature_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_sgp_nom_finished
ON public.inventory (nomenclature_id)
WHERE nomenclature_id IS NOT NULL
  AND warehouse = 'sgp'
  AND type IN ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product')
  AND pocket_owner IS NULL;

-- КРОК 7: Перевірка — показати залишки дублів (має бути порожньо)
SELECT
  nomenclature_id,
  COUNT(*) AS cnt,
  SUM(total_qty) AS total
FROM public.inventory
WHERE warehouse = 'sgp'
  AND pocket_owner IS NULL
  AND nomenclature_id IS NOT NULL
GROUP BY nomenclature_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC
LIMIT 20;
