-- Delete all inventory items from the Production Warehouse (СВ) that belong to legacy nomenclatures
DELETE FROM public.inventory
WHERE warehouse = 'production'
  AND nomenclature_id IN (
    SELECT id
    FROM public.nomenclatures_v2
    WHERE code LIKE 'LEGACY-%'
  );
