-- ═══════════════════════════════════════════════════════════════
--  Видалення запитів наряду 260825-1 з СО (Склад Оперативний)
--  Залишаємо тільки кіттинг-запити на СГП (ЗАПИТ НА КОМПЛЕКТУВАННЯ)
-- ═══════════════════════════════════════════════════════════════

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  КРОК 1 — ПЕРЕГЛЯД: що буде ВИДАЛЕНО (запити на СО)         ║
-- ╚══════════════════════════════════════════════════════════════╝
SELECT
  mr.id,
  mr.status,
  mr.category,
  mr.target_warehouse,
  LEFT(mr.details, 150) AS details_preview
FROM material_requests mr
JOIN orders o ON o.id = mr.order_id
WHERE o.order_num = '260825-1'
  AND mr.status NOT IN ('cancelled', 'completed')
  AND mr.details NOT LIKE '%ЗАПИТ НА КОМПЛЕКТУВАННЯ%'
ORDER BY mr.created_at;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  КРОК 2 — ПЕРЕГЛЯД: що буде ЗАЛИШЕНО (запити на СГП)        ║
-- ╚══════════════════════════════════════════════════════════════╝
SELECT
  mr.id,
  mr.status,
  LEFT(mr.details, 150) AS details_preview
FROM material_requests mr
JOIN orders o ON o.id = mr.order_id
WHERE o.order_num = '260825-1'
  AND mr.details LIKE '%ЗАПИТ НА КОМПЛЕКТУВАННЯ%'
ORDER BY mr.created_at;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  КРОК 3 — ВИДАЛЕННЯ (запустити після перевірки вище!)       ║
-- ╚══════════════════════════════════════════════════════════════╝
DELETE FROM material_requests
WHERE order_id = (
    SELECT id FROM orders WHERE order_num = '260825-1' LIMIT 1
  )
  AND status NOT IN ('cancelled', 'completed')
  AND details NOT LIKE '%ЗАПИТ НА КОМПЛЕКТУВАННЯ%';

-- Перевірка після видалення — повинні залишитись тільки SGP-запити
SELECT
  mr.id,
  mr.status,
  LEFT(mr.details, 150) AS details_preview
FROM material_requests mr
JOIN orders o ON o.id = mr.order_id
WHERE o.order_num = '260825-1'
ORDER BY mr.created_at;
