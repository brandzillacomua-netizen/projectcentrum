BEGIN;

WITH target_part AS (
  SELECT id
  FROM public.nomenclatures
  WHERE trim(name) = 'Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14'
  LIMIT 1
),
target_f6_90 AS (
  SELECT id
  FROM public.nomenclatures
  WHERE lower(name) LIKE '%фреза%'
    AND name ~* 'ф[[:space:]]*6[[:space:]]*\([[:space:]]*90[[:space:]]*\)'
  ORDER BY
    CASE WHEN type = 'cutter_type' THEN 0 ELSE 1 END,
    created_at DESC NULLS LAST
  LIMIT 1
),
old_f6_120 AS (
  SELECT id
  FROM public.nomenclatures
  WHERE lower(name) LIKE '%фреза%'
    AND name ~* 'ф[[:space:]]*6[[:space:]]*\([[:space:]]*120[[:space:]]*\)'
)
UPDATE public.machine_operations AS mo
SET side2_cut_ops = (
  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(
        CASE
          WHEN split_part(operation_text, ':', 2) IN (
            SELECT id::text FROM old_f6_120
          )
          THEN
            split_part(operation_text, ':', 1)
            || ':'
            || (SELECT id::text FROM target_f6_90)
            || ':'
            || split_part(operation_text, ':', 3)
          ELSE operation_text
        END
      )
      ORDER BY operation_number
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements_text(
    COALESCE(mo.side2_cut_ops, '[]'::jsonb)
  ) WITH ORDINALITY AS operations(operation_text, operation_number)
)
WHERE mo.nomenclature_id = (SELECT id FROM target_part)
  AND (
    lower(COALESCE(mo.machine_type, '')) LIKE '%1200x800%'
    OR lower(COALESCE(mo.machine_type, '')) LIKE '%1200х800%'
    OR lower(COALESCE(mo.machine_type, '')) LIKE '%малий%'
  )
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      COALESCE(mo.side2_cut_ops, '[]'::jsonb)
    ) AS current_operations(operation_text)
    WHERE split_part(operation_text, ':', 2) IN (
      SELECT id::text FROM old_f6_120
    )
  );

COMMIT;

SELECT
  part.name AS part_name,
  mo.machine_type,
  cutter.name AS cutter_name,
  split_part(operation.operation_text, ':', 3) AS consumption_per_sheet
FROM public.machine_operations AS mo
JOIN public.nomenclatures AS part
  ON part.id = mo.nomenclature_id
CROSS JOIN LATERAL jsonb_array_elements_text(
  COALESCE(mo.side2_cut_ops, '[]'::jsonb)
) AS operation(operation_text)
LEFT JOIN public.nomenclatures AS cutter
  ON cutter.id::text = split_part(operation.operation_text, ':', 2)
WHERE trim(part.name) = 'Київ К-ІП9/10/31/36/37-9-10-11-Н-3-14'
  AND operation.operation_text LIKE '__CUTTER__:%'
ORDER BY mo.machine_type, cutter.name;
