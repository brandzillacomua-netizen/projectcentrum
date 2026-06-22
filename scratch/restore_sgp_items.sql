-- SQL-скрипт для відновлення кількості деталей на СГП (склад готової продукції)
-- Номенклатури та їх кількості:
-- 1. Київ К-ІП9/10/31/36/37-9-10-11-В-3-30 -> 8240 шт
-- 2. Київ К-ІП9-10-П-7-46 -> 20030 шт

-- Відновлення для 'Київ К-ІП9/10/31/36/37-9-10-11-В-3-30'
INSERT INTO inventory (id, nomenclature_id, name, unit, total_qty, warehouse, type, updated_at)
VALUES (
    gen_random_uuid(), 
    '5ecf63e5-802d-4f98-8291-aad9a52bfaa4', 
    'Київ К-ІП9/10/31/36/37-9-10-11-В-3-30', 
    'шт', 
    8240, 
    'sgp', 
    'part', 
    NOW()
)
ON CONFLICT (name, type, warehouse) DO UPDATE 
SET total_qty = EXCLUDED.total_qty, 
    nomenclature_id = EXCLUDED.nomenclature_id, 
    updated_at = NOW();

-- Відновлення для 'Київ К-ІП9-10-П-7-46'
INSERT INTO inventory (id, nomenclature_id, name, unit, total_qty, warehouse, type, updated_at)
VALUES (
    gen_random_uuid(), 
    'b77e0883-0af2-40a4-a834-a1e47b6570da', 
    'Київ К-ІП9-10-П-7-46', 
    'шт', 
    20030, 
    'sgp', 
    'part', 
    NOW()
)
ON CONFLICT (name, type, warehouse) DO UPDATE 
SET total_qty = EXCLUDED.total_qty, 
    nomenclature_id = EXCLUDED.nomenclature_id, 
    updated_at = NOW();

