-- Read-only enterprise identity preflight.
-- Safe to run in Supabase SQL Editor: no INSERT/UPDATE/DELETE/DDL statements.

WITH binding_health AS (
  SELECT
    COUNT(*) AS mes_users,
    COUNT(su.auth_user_id) AS linked_mes_users,
    COUNT(*) FILTER (WHERE su.auth_user_id IS NULL) AS unlinked_mes_users,
    COUNT(*) FILTER (WHERE su.auth_user_id IS NOT NULL AND au.id IS NULL) AS orphaned_bindings,
    COUNT(*) FILTER (
      WHERE au.id IS NOT NULL
        AND CASE
          WHEN COALESCE(au.raw_user_meta_data->>'system_user_id', '') ~ '^[0-9]+$'
          THEN (au.raw_user_meta_data->>'system_user_id')::BIGINT <> su.id
          ELSE FALSE
        END
    ) AS mismatched_metadata
  FROM public.system_users AS su
  LEFT JOIN auth.users AS au ON au.id = su.auth_user_id
), duplicate_auth_bindings AS (
  SELECT COUNT(*) AS duplicate_groups
  FROM (
    SELECT auth_user_id
    FROM public.system_users
    WHERE auth_user_id IS NOT NULL
    GROUP BY auth_user_id
    HAVING COUNT(*) > 1
  ) AS duplicates
), duplicate_logins AS (
  SELECT COUNT(*) AS duplicate_groups
  FROM (
    SELECT LOWER(TRIM(login))
    FROM public.system_users
    WHERE NULLIF(TRIM(login), '') IS NOT NULL
    GROUP BY LOWER(TRIM(login))
    HAVING COUNT(*) > 1
  ) AS duplicates
)
SELECT
  binding_health.*,
  duplicate_auth_bindings.duplicate_groups AS duplicate_auth_bindings,
  duplicate_logins.duplicate_groups AS duplicate_logins,
  CASE
    WHEN unlinked_mes_users = 0
      AND orphaned_bindings = 0
      AND mismatched_metadata = 0
      AND duplicate_auth_bindings.duplicate_groups = 0
      AND duplicate_logins.duplicate_groups = 0
    THEN 'PASS'
    ELSE 'FAIL'
  END AS preflight_status
FROM binding_health
CROSS JOIN duplicate_auth_bindings
CROSS JOIN duplicate_logins;

-- Returns zero rows when every MES profile has a valid Auth identity.
SELECT
  su.id AS system_user_id,
  su.login,
  su.auth_user_id,
  CASE
    WHEN su.auth_user_id IS NULL THEN 'MISSING_BINDING'
    WHEN au.id IS NULL THEN 'AUTH_USER_NOT_FOUND'
    WHEN CASE
      WHEN COALESCE(au.raw_user_meta_data->>'system_user_id', '') ~ '^[0-9]+$'
      THEN (au.raw_user_meta_data->>'system_user_id')::BIGINT <> su.id
      ELSE FALSE
    END
      THEN 'METADATA_POINTS_TO_ANOTHER_PROFILE'
    ELSE 'UNKNOWN'
  END AS issue
FROM public.system_users AS su
LEFT JOIN auth.users AS au ON au.id = su.auth_user_id
WHERE su.auth_user_id IS NULL
   OR au.id IS NULL
   OR CASE
     WHEN COALESCE(au.raw_user_meta_data->>'system_user_id', '') ~ '^[0-9]+$'
     THEN (au.raw_user_meta_data->>'system_user_id')::BIGINT <> su.id
     ELSE FALSE
   END
ORDER BY su.id;
