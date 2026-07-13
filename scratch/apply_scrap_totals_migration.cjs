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

const sql = fs.readFileSync('A:/centrum/supabase/migrations/20260713143000_work_card_scrap_totals.sql', 'utf8')

const withTimeout = (promise, ms, label) => {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function run() {
  const attempts = [
    ['sql', { sql }],
    ['query', { query: sql }],
    ['sql_query', { sql_query: sql }]
  ]

  for (const [label, args] of attempts) {
    const res = await withTimeout(supabase.rpc('exec_sql', args), 20000, `exec_sql(${label})`)
    if (!res.error) {
      console.log(`Migration applied via exec_sql(${label}).`)
      console.log(res.data ?? 'ok')
      return
    }
    console.log(`exec_sql(${label}) failed: ${res.error.message}`)
  }

  throw new Error('All exec_sql parameter variants failed.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
