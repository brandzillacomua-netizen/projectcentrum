-- The unified issuer and identity normalizer must both exist.
select
  to_regprocedure('public.normalize_sgp_identity(text)') is not null as has_identity_normalizer,
  to_regprocedure('public.issue_packaging_request_from_sgp(uuid,text)') is not null as has_unified_issuer;
