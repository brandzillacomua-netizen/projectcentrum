-- Міграція: зміна warehouse_conf з BOOLEAN на TEXT
-- Щоб підтримувати значення: null, 'false', 'partial', 'true'

ALTER TABLE tasks 
ALTER COLUMN warehouse_conf TYPE TEXT 
USING CASE 
  WHEN warehouse_conf = true THEN 'true'
  WHEN warehouse_conf = false THEN 'false'
  ELSE null
END;
