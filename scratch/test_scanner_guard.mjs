import scannerDebounceGuard from '../src/services/scannerDebounceGuard.js';

async function runTests() {
  console.log('--- Testing scannerDebounceGuard ---');
  scannerDebounceGuard.reset();

  // Test 1: First scan should pass
  const code1 = 'CENTRUM_CARD_abc-123';
  const pass1 = scannerDebounceGuard.shouldProcessScan(code1);
  if (!pass1) throw new Error('Test 1 Failed: First scan must pass');
  console.log('✓ Test 1 Passed: First scan accepted');

  // Test 2: Rapid second scan of same barcode within 700ms should be dropped
  const pass2 = scannerDebounceGuard.shouldProcessScan(code1);
  if (pass2) throw new Error('Test 2 Failed: Rapid duplicate scan was NOT dropped');
  console.log('✓ Test 2 Passed: Rapid duplicate scan dropped');

  // Test 3: Different barcode should be accepted immediately
  const code2 = 'CENTRUM_CARD_xyz-999';
  const pass3 = scannerDebounceGuard.shouldProcessScan(code2);
  if (!pass3) throw new Error('Test 3 Failed: Different barcode should be accepted immediately');
  console.log('✓ Test 3 Passed: Different barcode accepted immediately');

  // Test 4: Same barcode with `#` prefix should be recognized as the same card and dropped
  const code1WithHash = '#abc-123';
  const pass4 = scannerDebounceGuard.shouldProcessScan(code1WithHash);
  if (pass4) throw new Error('Test 4 Failed: Normalized barcode variant was NOT identified as duplicate');
  console.log('✓ Test 4 Passed: Barcode normalization (CENTRUM_CARD_ vs #) works');

  // Test 5: In-flight lock blocks parallel execution
  let inFlightExecutedCount = 0;
  scannerDebounceGuard.reset();

  const promise1 = scannerDebounceGuard.withLock('card-lock-test', async () => {
    inFlightExecutedCount++;
    await new Promise((r) => setTimeout(r, 100));
    return 'DONE';
  });

  const promise2 = scannerDebounceGuard.withLock('card-lock-test', async () => {
    inFlightExecutedCount++;
    return 'SHOULD NOT RUN';
  });

  const [res1, res2] = await Promise.all([promise1, promise2]);
  if (res1 !== 'DONE' || res2 !== null || inFlightExecutedCount !== 1) {
    throw new Error(`Test 5 Failed: res1=${res1}, res2=${res2}, count=${inFlightExecutedCount}`);
  }
  console.log('✓ Test 5 Passed: In-flight async locking correctly blocks parallel race condition');

  // Test 6: After cooldown and lock release, barcode can be scanned again
  await new Promise((r) => setTimeout(r, 800));
  const pass6 = scannerDebounceGuard.shouldProcessScan('card-lock-test');
  if (!pass6) throw new Error('Test 6 Failed: Barcode should be accepted after cooldown');
  console.log('✓ Test 6 Passed: Barcode accepted after cooldown expires');

  console.log('\n🎉 ALL SCANNER GUARD TESTS PASSED SUCCESSFULLY (6/6)');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
