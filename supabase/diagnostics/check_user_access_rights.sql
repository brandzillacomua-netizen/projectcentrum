-- ДІАГНОСТИКА: чому CRM-модулі не з'являються у користувача
-- Запустити в Supabase → SQL Editor (PROD: hurzutjytlcvtbvihnry)

-- 1) Усі акаунти, схожі на Руслана + до якого auth-акаунта вони прив'язані
SELECT
  su.id,
  su.login,
  su.first_name,
  su.last_name,
  su.position,
  su.auth_user_id,
  au.email                         AS auth_email,
  au.last_sign_in_at,
  su.access_rights->>'crm'         AS crm,
  su.access_rights->>'crm_clients' AS crm_clients,
  su.access_rights->>'manager'     AS manager,
  su.access_rights->>'kanban'      AS kanban,
  su.access_rights->>'chat'        AS chat,
  su.access_rights->>'shipping'    AS shipping,
  su.access_rights
FROM public.system_users su
LEFT JOIN auth.users au ON au.id = su.auth_user_id
WHERE su.first_name ILIKE '%руслан%'
   OR su.last_name  ILIKE '%слав%'
   OR su.login      ILIKE '%slav%'
   OR su.login      ILIKE '%rusl%'
ORDER BY su.id;

-- 2) Останні спроби зберегти користувачів (чи доходить збереження і чи нема відмов)
SELECT created_at, event_type, severity, payload
FROM public.security_audit_events
WHERE table_name = 'system_users'
ORDER BY created_at DESC
LIMIT 20;

-- 3) Чи справді на PROD стоїть нова версія функції (має містити 'settings')
SELECT p.oid::regprocedure AS signature,
       position('''settings''' IN pg_get_functiondef(p.oid)) > 0 AS has_settings_fix
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'rpc_admin_upsert_user';
