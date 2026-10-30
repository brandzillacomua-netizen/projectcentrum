-- Migration: 20261030144000_grant_corporate_hub_access_all_users.sql
-- Description: Grant Corporate Hub access ('corporate': true) to all system users in system_users

UPDATE public.system_users
SET access_rights = jsonb_set(
  COALESCE(access_rights, '{}'::jsonb),
  '{corporate}',
  'true'::jsonb,
  true
)
WHERE access_rights IS NULL 
   OR access_rights->>'corporate' IS DISTINCT FROM 'true';

