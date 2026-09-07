import { matchPlateToWorkingSheet } from '../src/modules/Nomenclature/utils/nomenclatureHelpers.js';

const testCases = [
  {
    input: 'Карбонова пластина Т300 1000*600 3мм',
    expectedRatio: 2,
    expectedSheet: 'Лист Т300 (3мм)'
  },
  {
    input: 'Карбонова пластина Т300 500*600 11мм',
    expectedRatio: 1,
    expectedSheet: 'Лист Т300 (11мм)'
  },
  {
    input: 'Карбонова пластина Т700 500*600 2,5мм',
    expectedRatio: 1,
    expectedSheet: 'Лист Т700 (2.5мм)'
  },
  {
    input: 'Карбонова пластина Т700 1000*600 4мм',
    expectedRatio: 2,
    expectedSheet: 'Лист Т700 (4мм)'
  },
  {
    input: 'Лист Т300 (3мм) [Непідготовлений]',
    expectedRatio: 1,
    expectedSheet: 'Лист Т300 (3мм)'
  }
];

let allPassed = true;
for (const tc of testCases) {
  const res = matchPlateToWorkingSheet(tc.input);
  const ratioOk = res?.yieldRatio === tc.expectedRatio;
  const sheetOk = res?.workingSheetName === tc.expectedSheet;

  console.log(`Input: "${tc.input}"`);
  console.log(`  -> Sheet: "${res?.workingSheetName}" (expected: "${tc.expectedSheet}") [${sheetOk ? 'PASS' : 'FAIL'}]`);
  console.log(`  -> Ratio: ${res?.yieldRatio} (expected: ${tc.expectedRatio}) [${ratioOk ? 'PASS' : 'FAIL'}]`);

  if (!ratioOk || !sheetOk) allPassed = false;
}

if (!allPassed) {
  console.error('Some tests failed!');
  process.exit(1);
} else {
  console.log('\nAll plate conversion test cases PASSED!');
}
