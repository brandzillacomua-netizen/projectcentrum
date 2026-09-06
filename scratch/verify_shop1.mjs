import { useShop1TerminalState } from '../src/modules/Shop1/hooks/useShop1TerminalState.js';
import { useShop1ShiftTimers } from '../src/modules/Shop1/hooks/subhooks/useShop1ShiftTimers.js';
import { useShop1Modals } from '../src/modules/Shop1/hooks/subhooks/useShop1Modals.js';
import { useShop1Scanner } from '../src/modules/Shop1/hooks/subhooks/useShop1Scanner.js';
import { useShop1CardWorkflow } from '../src/modules/Shop1/hooks/subhooks/useShop1CardWorkflow.js';

console.log('--- Verifying Shop1 subhooks imports ---');
console.log('useShop1TerminalState is function:', typeof useShop1TerminalState === 'function');
console.log('useShop1ShiftTimers is function:', typeof useShop1ShiftTimers === 'function');
console.log('useShop1Modals is function:', typeof useShop1Modals === 'function');
console.log('useShop1Scanner is function:', typeof useShop1Scanner === 'function');
console.log('useShop1CardWorkflow is function:', typeof useShop1CardWorkflow === 'function');
console.log('✅ ALL SHOP1 SUBHOOKS IMPORTED CLEANLY WITHOUT SYNTAX OR RUNTIME ERRORS!');
