-- Add invoice_num column to public.orders table for manager tracking
alter table public.orders add column if not exists invoice_num text;
create index if not exists idx_orders_invoice_num on public.orders (invoice_num);
