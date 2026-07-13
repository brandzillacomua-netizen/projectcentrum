const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

const batchSize = Number(process.env.SCRAP_BACKFILL_BATCH_SIZE || 50)
const maxBatches = Number(process.env.SCRAP_BACKFILL_MAX_BATCHES || 20)
const delayMs = Number(process.env.SCRAP_BACKFILL_DELAY_MS || 750)
const timeoutMs = Number(process.env.SCRAP_BACKFILL_TIMEOUT_MS || 20000)

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const withTimeout = (promise, ms, label) => {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function run() {
  let totalProcessed = 0
  let totalGroups = 0
  let totalScrap = 0

  console.log(`Starting scrap totals backfill: batchSize=${batchSize}, maxBatches=${maxBatches}, delayMs=${delayMs}`)

  for (let i = 1; i <= maxBatches; i += 1) {
    const { data, error } = await withTimeout(
      supabase.rpc('backfill_work_card_scrap_totals_batch', { p_limit: batchSize }),
      timeoutMs,
      `backfill batch ${i}`
    )

    if (error) throw error

    const result = data || {}
    const processed = Number(result.processed || 0)
    const groups = Number(result.groups || 0)
    const scrap = Number(result.scrap || 0)

    totalProcessed += processed
    totalGroups += groups
    totalScrap += scrap

    console.log(`Batch ${i}: processed=${processed}, groups=${groups}, scrap=${scrap}`)

    if (processed === 0) {
      console.log('Backfill complete: no more unprocessed scrap history rows.')
      break
    }

    if (i < maxBatches) await sleep(delayMs)
  }

  console.log(`Done for this run: processed=${totalProcessed}, groups=${totalGroups}, scrap=${totalScrap}`)
}

run().catch(err => {
  console.error('Backfill failed:', err.message || err)
  process.exit(1)
})
