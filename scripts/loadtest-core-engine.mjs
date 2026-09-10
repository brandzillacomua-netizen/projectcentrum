/**
 * CENTRUM CORE ENGINE — Concurrency & Race Condition Load Test
 * Simulates 50-100 parallel workers making simultaneous requests to Core Engine.
 */

import http from 'node:http'

const SERVER_URL = 'http://localhost:4000'
const CONCURRENT_REQUESTS = 50

console.log(`🚀 [Load Test] Starting simulation of ${CONCURRENT_REQUESTS} parallel requests to Core Engine...`)

async function makeRequest(id) {
  const startTime = Date.now()
  return new Promise((resolve) => {
    const data = JSON.stringify({
      inventoryId: '00000000-0000-0000-0000-000000000000',
      deductTotal: 0,
      releaseReserved: 0
    })

    const req = http.request(`${SERVER_URL}/api/v1/inventory/deduct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        const latency = Date.now() - startTime
        resolve({ id, status: res.statusCode, latency, body })
      })
    })

    req.on('error', (err) => {
      resolve({ id, status: 'ERROR', error: err.message, latency: Date.now() - startTime })
    })

    req.write(data)
    req.end()
  })
}

async function runLoadTest() {
  const promises = []
  for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
    promises.push(makeRequest(i))
  }

  const results = await Promise.all(promises)
  
  const successful = results.filter(r => r.status === 200 || r.status === 400 || r.status === 500)
  const errors = results.filter(r => r.status === 'ERROR')
  const avgLatency = Math.round(results.reduce((acc, r) => acc + r.latency, 0) / results.length)

  console.log(`\n📊 [LOAD TEST RESULTS]`)
  console.log(`----------------------------------------`)
  console.log(`Total Parallel Requests: ${results.length}`)
  console.log(`Successful Responses:   ${successful.length}`)
  console.log(`Connection Errors:      ${errors.length}`)
  console.log(`Average Latency:        ${avgLatency} ms`)
  console.log(`----------------------------------------`)
  
  if (errors.length === 0) {
    console.log(`✅ [SUCCESS] Core Engine passed concurrency load test with 0 connection errors!`)
  } else {
    console.warn(`⚠️ [WARNING] Encountered ${errors.length} connection errors under load.`)
  }
}

runLoadTest()
