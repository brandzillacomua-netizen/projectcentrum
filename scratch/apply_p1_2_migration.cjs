const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

const sqlPath = 'B:/kylutsya/supabase/migrations/20260829190000_auto_release_bz_on_task_delete.sql'
const sql = fs.readFileSync(sqlPath, 'utf8')

const withTimeout = (promise, ms, label) => {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function run() {
  console.log('Applying P1-2 migration...')
  const attempts = [
    ['sql', { sql }],
    ['query', { query: sql }],
    ['sql_query', { sql_query: sql }]
  ]

  for (const [label, args] of attempts) {
    try {
      const res = await withTimeout(supabase.rpc('exec_sql', args), 20000, `exec_sql(${label})`)
      if (!res.error) {
        console.log(`✅ P1-2 Migration applied successfully via exec_sql(${label}).`)
        console.log('Data:', res.data ?? 'ok')
        return
      }
      console.log(`exec_sql(${label}) error: ${res.error.message}`)
    } catch (e) {
      console.log(`exec_sql(${label}) exception: ${e.message}`)
    }
  }

  throw new Error('All exec_sql attempts failed.')
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
