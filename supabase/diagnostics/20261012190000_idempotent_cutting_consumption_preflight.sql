select
  to_regclass('public.work_cards') is not null as has_work_cards,
  to_regclass('public.inventory') is not null as has_inventory,
  to_regclass('public.material_requests') is not null as has_material_requests,
  to_regnamespace('mes_private') is not null as has_private_schema,
  to_regprocedure('public.mes_current_system_user_id()') is not null as has_mes_identity;
