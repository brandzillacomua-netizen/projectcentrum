select
  to_regclass('public.work_cards') is not null as work_cards_exists,
  to_regclass('public.material_requests') is not null as material_requests_exists,
  to_regclass('public.system_users') is not null as system_users_exists;
