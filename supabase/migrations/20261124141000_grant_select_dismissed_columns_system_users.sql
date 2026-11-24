-- Grant column-level SELECT on soft-dismissal columns of system_users
SET lock_timeout = '5s';
SET statement_timeout = '30s';

GRANT SELECT (is_dismissed) ON public.system_users TO anon;
GRANT SELECT (is_dismissed, dismissed_at, dismissed_reason) ON public.system_users TO authenticated;
