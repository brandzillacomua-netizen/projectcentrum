import { createClient } from '@supabase/supabase-js';

const stagingUrl = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const stagingServiceKey = process.env.STAGING_SERVICE_ROLE_KEY || '';
const client = createClient(stagingUrl, stagingServiceKey);

async function run() {
  const { data, error } = await client.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS public.inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        category TEXT,
        quantity NUMERIC DEFAULT 0,
        reserved NUMERIC DEFAULT 0,
        unit TEXT DEFAULT 'шт',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      GRANT ALL ON public.inventory TO anon, authenticated, service_role;
      ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
    `
  });
  console.log('Result:', data, error);
}

run().catch(console.error);
