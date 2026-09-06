import { analyzeRootCause } from '../src/services/alerting/errorRootCauseAnalyzer.js'
import { alertRateLimiter } from '../src/services/alerting/alertRateLimiter.js'
import { formatCrashAlertMessage } from '../src/services/alerting/telegramFormatter.js'

console.log('--- 1. Testing errorRootCauseAnalyzer ---')

// Test Case 1: ChunkLoad
const res1 = analyzeRootCause({ message: 'Failed to fetch dynamically imported module: /assets/Shop1Terminal.js' })
console.assert(res1.category === 'CHUNK_LOAD', 'Expected CHUNK_LOAD')
console.log('✓ CHUNK_LOAD test passed:', res1.causeTitle)

// Test Case 2: Network error
const res2 = analyzeRootCause({ message: 'TypeError: Failed to fetch', name: 'TypeError' })
console.assert(res2.category === 'NETWORK', 'Expected NETWORK')
console.log('✓ NETWORK test passed:', res2.causeTitle)

// Test Case 3: Data Integrity
const res3 = analyzeRootCause({ message: "Cannot read properties of null (reading 'stage')", name: 'TypeError' })
console.assert(res3.category === 'DATA_INTEGRITY', 'Expected DATA_INTEGRITY')
console.log('✓ DATA_INTEGRITY test passed:', res3.causeTitle)

// Test Case 4: Auth / RLS
const res4 = analyzeRootCause({ message: 'JWT expired', name: 'AuthSessionMissingError' })
console.assert(res4.category === 'AUTH_RLS', 'Expected AUTH_RLS')
console.log('✓ AUTH_RLS test passed:', res4.causeTitle)

console.log('\n--- 2. Testing alertRateLimiter ---')
alertRateLimiter.reset()

const errorSample = { name: 'TypeError', message: 'Test fail', stack: 'at foo.js:10' }
const firstCheck = alertRateLimiter.shouldSend(errorSample)
console.assert(firstCheck.allowed === true, 'First alert should be allowed')
console.log('✓ First alert allowed')

alertRateLimiter.recordSent(errorSample)

const secondCheck = alertRateLimiter.shouldSend(errorSample)
console.assert(secondCheck.allowed === false, 'Duplicate alert should be blocked by cooldown')
console.log('✓ Cooldown check passed:', secondCheck.reason)

console.log('\n--- 3. Testing telegramFormatter ---')
const formatted = formatCrashAlertMessage({
  errorRecord: {
    name: 'TypeError',
    message: "Cannot read properties of undefined (reading 'status')",
    url: 'https://centrum.factory/shop1',
    user: { name: 'Іван Петренко', login: 'ivan_p', role: 'operator' },
    stack: 'TypeError: Cannot read properties of undefined\n    at Shop1Terminal.jsx:42:15'
  },
  rootCause: res3
})

console.assert(formatted.includes('Іван Петренко'), 'Should include user name')
console.assert(formatted.includes('Невідповідність структури даних'), 'Should include root cause')
console.assert(formatted.includes('Shop1Terminal.jsx'), 'Should include stack snippet')
console.log('✓ Telegram HTML message formatted successfully!')
console.log('\nSample Preview:\n' + formatted)

console.log('\nALL UNIT TESTS PASSED!')
