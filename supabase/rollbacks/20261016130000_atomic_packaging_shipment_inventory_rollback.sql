-- This migration changes no accounting rows by itself; remove only the RPC.
drop function if exists public.complete_packaging_shipment(uuid, uuid[], jsonb);
