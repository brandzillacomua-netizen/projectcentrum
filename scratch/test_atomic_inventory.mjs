import { deductInventoryAtomic } from '../src/services/atomicInventoryService.js';

async function runTests() {
  console.log('--- Testing atomicInventoryService ---');

  // Test 1: Successful RPC call
  const mockRpcSupabase = {
    rpc: async (funcName, params) => {
      if (funcName === 'rpc_deduct_inventory_atomic') {
        return {
          data: {
            success: true,
            id: params.p_inventory_id,
            prev_total: 100,
            new_total: 80,
            prev_reserved: 30,
            new_reserved: 10
          },
          error: null
        };
      }
      return { data: null, error: new Error('Unknown RPC') };
    }
  };

  const res1 = await deductInventoryAtomic(mockRpcSupabase, {
    inventoryId: 'test-uuid-1',
    deductTotal: 20,
    releaseReserved: 20
  });

  if (!res1.success || res1.data.new_total !== 80 || res1.data.new_reserved !== 10) {
    throw new Error(`Test 1 Failed: ${JSON.stringify(res1)}`);
  }
  console.log('✓ Test 1 Passed: RPC path executes and parses atomic return correctly');

  // Test 2: RPC throws error -> Graceful Fallback kicks in
  let fallbackUpdatedPayload = null;
  const mockFallbackSupabase = {
    rpc: async () => {
      return { data: null, error: { message: 'function rpc_deduct_inventory_atomic does not exist' } };
    },
    from: (tableName) => {
      if (tableName === 'inventory') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'test-uuid-2', total_qty: 50, reserved_qty: 15 },
                error: null
              })
            })
          }),
          update: (payload) => ({
            eq: (col, val) => {
              fallbackUpdatedPayload = payload;
              return Promise.resolve({ error: null });
            }
          })
        };
      }
    }
  };

  const res2 = await deductInventoryAtomic(mockFallbackSupabase, {
    inventoryId: 'test-uuid-2',
    deductTotal: 10,
    releaseReserved: 5
  });

  if (!res2.success || !res2.data.is_fallback) {
    throw new Error(`Test 2 Failed: Fallback was not engaged: ${JSON.stringify(res2)}`);
  }
  if (fallbackUpdatedPayload.total_qty !== 40 || fallbackUpdatedPayload.reserved_qty !== 10) {
    throw new Error(`Test 2 Failed: Fallback math incorrect: ${JSON.stringify(fallbackUpdatedPayload)}`);
  }
  console.log('✓ Test 2 Passed: 100% Graceful Fallback engages when RPC is missing in DB');

  // Test 3: Math bounds protection (cannot go negative)
  const res3 = await deductInventoryAtomic(mockFallbackSupabase, {
    inventoryId: 'test-uuid-2',
    deductTotal: 9999, // Exceeds current total
    releaseReserved: 9999
  });

  if (!res3.success || fallbackUpdatedPayload.total_qty !== 0 || fallbackUpdatedPayload.reserved_qty !== 0) {
    throw new Error(`Test 3 Failed: Negative quantity protection failed: ${JSON.stringify(fallbackUpdatedPayload)}`);
  }
  console.log('✓ Test 3 Passed: GREATEST(0, ...) protects stock from negative quantities');

  console.log('\n========================================');
  console.log('✅ ALL 3 ATOMIC INVENTORY TESTS PASSED!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
