const path = require('path');

// Test resolveCanonicalNomId logic in isolation
const nomenclaturesMock = [
  {
    id: 'f87a3210-9999-4b88-8888-123456789abc',
    v2_id: 'f87a3210-9999-4b88-8888-123456789abc',
    name: 'Тестова деталь V2',
    legacy_ids: ['legacy-uuid-1111', 'legacy-uuid-2222']
  }
];

const resolveCanonicalNomId = (input, nomenclatures = []) => {
  if (!input) return null;
  const rawId = typeof input === 'object' 
    ? String(input.id || input.nomenclature_id || input.v2_id || '') 
    : String(input || '');
  if (!rawId) return null;

  if (!Array.isArray(nomenclatures) || nomenclatures.length === 0) {
    return rawId;
  }

  const directMatch = nomenclatures.find(n => n && (String(n.id) === rawId || String(n.v2_id) === rawId));
  if (directMatch) {
    return String(directMatch.id || directMatch.v2_id);
  }

  const legacyMatch = nomenclatures.find(n => {
    if (!n) return false;
    const legacyIds = Array.isArray(n.legacy_ids) 
      ? n.legacy_ids.map(String) 
      : (n.legacy_id ? [String(n.legacy_id)] : []);
    return legacyIds.includes(rawId);
  });

  if (legacyMatch) {
    return String(legacyMatch.id || legacyMatch.v2_id);
  }

  return rawId;
};

console.log('Testing V2 ID resolution:');
console.log('1. Direct V2 UUID:', resolveCanonicalNomId('f87a3210-9999-4b88-8888-123456789abc', nomenclaturesMock));
console.log('2. Legacy V1 UUID 1:', resolveCanonicalNomId('legacy-uuid-1111', nomenclaturesMock));
console.log('3. Legacy V1 UUID 2:', resolveCanonicalNomId('legacy-uuid-2222', nomenclaturesMock));
console.log('4. Unknown UUID:', resolveCanonicalNomId('unknown-uuid-9999', nomenclaturesMock));

if (
  resolveCanonicalNomId('legacy-uuid-1111', nomenclaturesMock) === 'f87a3210-9999-4b88-8888-123456789abc' &&
  resolveCanonicalNomId('legacy-uuid-2222', nomenclaturesMock) === 'f87a3210-9999-4b88-8888-123456789abc'
) {
  console.log('\n✅ ALL V2 RESOLUTION TESTS PASSED!');
} else {
  console.error('\n❌ RESOLUTION TEST FAILED!');
  process.exit(1);
}
