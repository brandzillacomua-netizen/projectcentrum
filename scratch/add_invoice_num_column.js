import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function applyMigration() {
  const sql = `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_num TEXT; CREATE INDEX IF NOT EXISTS idx_orders_invoice_num ON public.orders (invoice_num);`
  
  const attempts = [
    ['sql', { sql }],
    ['query', { query: sql }],
    ['sql_query', { sql_query: sql }]
  ]

  for (const [label, args] of attempts) {
    const res = await supabase.rpc('exec_sql', args)
    if (!res.error) {
      console.log(`Migration applied via exec_sql(${label}).`, res.data)
      return
    }
    console.log(`exec_sql(${label}) failed:`, res.error.message)
  }
}

applyMigration()
