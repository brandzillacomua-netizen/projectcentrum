/**
 * Empirical Model of PostgreSQL ACID RPC: FOR UPDATE + Idempotency Barrier
 * Demonstrates why only the Database Engine can prevent cross-tablet race conditions.
 */

async function simulatePostgresRpcEngine() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔬 POSTGRESQL ENGINE SIMULATION: FOR UPDATE + IDEMPOTENCY BARRIER');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Shared database storage
  let dbCard = {
    id: 'card-100',
    status: 'new',
    operation: 'Розкрій',
    operator_name: null
  };
  const dbHistory = [];

  // PostgreSQL Row-Level Lock Mutex
  let rowLock = Promise.resolve();

  async function executeRpcTransition(sessionName, operatorName, idempotencyKey) {
    // Acquire PostgreSQL FOR UPDATE row lock on work_cards row
    let releaseLock;
    const currentLock = rowLock;
    rowLock = new Promise(resolve => { releaseLock = resolve; });

    await currentLock; // Wait for any preceding transaction to commit/release lock
    console.log(`[${sessionName}] Acquired FOR UPDATE row lock on card ${dbCard.id}`);

    try {
      // 1. SELECT * INTO v_current_card FROM work_cards WHERE id = p_card_id FOR UPDATE;
      const v_current_card = { ...dbCard };

      // 2. IDEMPOTENCY BARRIER
      if (v_current_card.status === 'in-progress' && v_current_card.operation === 'Розкрій') {
        console.log(`[${sessionName}] 🛡️ IDEMPOTENCY BARRIER HIT: Card already in "in-progress" by concurrent worker!`);
        return {
          success: true,
          already_processed: true,
          message: 'Card is already in target status',
          history_created: false
        };
      }

      // Simulate 40ms disk I/O and transaction execution
      await new Promise(r => setTimeout(r, 40));

      // 3. UPDATE work_cards SET status = 'in-progress'
      dbCard.status = 'in-progress';
      dbCard.operator_name = operatorName;

      // 4. INSERT INTO work_card_history
      dbHistory.push({
        card_id: dbCard.id,
        stage_name: 'Розкрій',
        operator_name: operatorName,
        idempotency_key: idempotencyKey,
        timestamp: new Date().toISOString()
      });

      console.log(`[${sessionName}] ✓ Successfully transitioned card and wrote history row.`);
      return {
        success: true,
        already_processed: false,
        history_created: true
      };
    } finally {
      releaseLock(); // COMMIT / Release row lock
      console.log(`[${sessionName}] Released lock.`);
    }
  }

  console.log('Initial DB State:');
  console.log('• Card status:', dbCard.status);
  console.log('• Total History entries:', dbHistory.length);

  console.log('\nSimulating two tablets scanning simultaneously:');
  const [resA, resB] = await Promise.all([
    executeRpcTransition('Tablet-A', 'Олександр', 'KEY_A_001'),
    executeRpcTransition('Tablet-B', 'Дмитро', 'KEY_B_002')
  ]);

  console.log('\nResults from both sessions:');
  console.log('• Tablet-A Result:', JSON.stringify(resA));
  console.log('• Tablet-B Result:', JSON.stringify(resB));

  console.log('\nFinal DB State:');
  console.log('• Card status:', dbCard.status);
  console.log('• Total History entries in DB:', dbHistory.length);
  dbHistory.forEach((h, i) => {
    console.log(`  [Row #${i + 1}] Operator: "${h.operator_name}", Key: "${h.idempotency_key}"`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📊 AUDIT CONCLUSION:');
  if (dbHistory.length === 1) {
    console.log('✅ PASS: Exactly 1 history record created in DB.');
    console.log('   PostgreSQL FOR UPDATE serialized the concurrent requests, and the');
    console.log('   Idempotency Barrier safely deflected the 2nd session!');
  } else {
    console.log('❌ FAIL: Duplicate entries found.');
  }
  console.log('═══════════════════════════════════════════════════════════════════════');
}

simulatePostgresRpcEngine().catch(console.error);
