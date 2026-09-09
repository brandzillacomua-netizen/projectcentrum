import { createClient } from '@supabase/supabase-js';

const stagingUrl = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const stagingServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg5NzEzNSwiZXhwIjoyMTA0NDczMTM1fQ.VrtSmhZNBpPjOolQk9wML9ImpfD4mB4yyEJxF_AvAKE';
const client = createClient(stagingUrl, stagingServiceKey);

async function run() {
  const sql = `
    -- 1. work_card_scrap_totals
    create table if not exists public.work_card_scrap_totals (
      id uuid primary key default gen_random_uuid(),
      card_id uuid not null references public.work_cards(id) on delete cascade,
      task_id uuid not null,
      order_id uuid,
      nomenclature_id uuid not null,
      total_scrap integer not null default 0 check (total_scrap >= 0),
      first_scrap_at timestamptz,
      last_scrap_at timestamptz,
      updated_at timestamptz not null default now(),
      unique (card_id, nomenclature_id)
    );
    alter table public.work_card_scrap_totals enable row level security;
    drop policy if exists "work_card_scrap_totals_read" on public.work_card_scrap_totals;
    create policy "work_card_scrap_totals_read" on public.work_card_scrap_totals
      for select to anon, authenticated using (true);
    grant select on public.work_card_scrap_totals to anon, authenticated;

    -- 2. vkya_quality_resolutions
    create table if not exists public.vkya_quality_resolutions (
      id uuid primary key default gen_random_uuid(),
      source_history_id uuid,
      source_card_id uuid references public.work_cards(id) on delete set null,
      task_id uuid,
      order_id uuid,
      nomenclature_id uuid not null,
      quantity integer not null check (quantity > 0),
      disposition text not null check (disposition in ('returned_to_route', 'restoration_assigned')),
      route_card_id uuid references public.work_cards(id) on delete set null,
      restoration_card_id uuid,
      resolved_by_user_id bigint,
      resolved_by_name text,
      resolved_at timestamptz not null default now(),
      notes text,
      created_at timestamptz not null default now()
    );
    alter table public.vkya_quality_resolutions enable row level security;
    drop policy if exists "vkya_quality_resolutions_read" on public.vkya_quality_resolutions;
    create policy "vkya_quality_resolutions_read" on public.vkya_quality_resolutions
      for select to anon, authenticated using (true);
    grant select on public.vkya_quality_resolutions to anon, authenticated;

    -- 3. check if scrap_classifications exists before creating vkya_final_scrap_totals view
    create table if not exists public.scrap_classifications (
      id uuid primary key default gen_random_uuid(),
      task_id uuid,
      order_id uuid,
      card_id uuid references public.work_cards(id) on delete set null,
      nomenclature_id uuid not null,
      classified_at timestamptz not null default now()
    );
    alter table public.scrap_classifications enable row level security;
    grant select on public.scrap_classifications to anon, authenticated;

    create table if not exists public.scrap_classification_categories (
      id uuid primary key default gen_random_uuid(),
      classification_id uuid not null references public.scrap_classifications(id) on delete cascade,
      category integer not null,
      quantity numeric not null default 0
    );
    alter table public.scrap_classification_categories enable row level security;
    grant select on public.scrap_classification_categories to anon, authenticated;

    create or replace view public.vkya_final_scrap_totals as
    select
      c.task_id,
      c.order_id,
      c.card_id,
      c.nomenclature_id,
      sum(cc.quantity)::bigint as total_scrap,
      min(c.classified_at) as first_scrap_at,
      max(c.classified_at) as last_scrap_at,
      max(c.classified_at) as updated_at
    from public.scrap_classifications c
    join public.scrap_classification_categories cc on cc.classification_id = c.id
    where cc.category = 4 and c.task_id is not null
    group by c.task_id, c.order_id, c.card_id, c.nomenclature_id;

    grant select on public.vkya_final_scrap_totals to anon, authenticated;
  `;

  console.log('Applying SQL to staging...');
  const { data, error } = await client.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('exec_sql error:', error);
  } else {
    console.log('exec_sql success:', data);
  }

  // Verify by querying all 3 via standard REST
  console.log('Testing REST queries...');
  const r1 = await client.from('work_card_scrap_totals').select('*').limit(1);
  console.log('work_card_scrap_totals status:', r1.status, r1.error?.message || 'OK');

  const r2 = await client.from('vkya_quality_resolutions').select('*').limit(1);
  console.log('vkya_quality_resolutions status:', r2.status, r2.error?.message || 'OK');

  const r3 = await client.from('vkya_final_scrap_totals').select('*').limit(1);
  console.log('vkya_final_scrap_totals status:', r3.status, r3.error?.message || 'OK');
}

run().catch(console.error);
