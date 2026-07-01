const fs = require('fs');
let code = fs.readFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', 'utf8');

// Fix 1: kb-body-container — add min-height: 0
code = code.replace(
  '          display: flex;\r\n          flex-direction: row;\r\n          flex: 1;\r\n          overflow: hidden;\r\n        }',
  '          display: flex;\r\n          flex-direction: row;\r\n          flex: 1;\r\n          min-height: 0;\r\n          overflow: hidden;\r\n        }'
);

// Fix 2: kb-board — add align-items: stretch and min-height: 0
code = code.replace(
  '          display: flex; gap: 16px; padding: 20px 20px; overflow-x: auto; flex: 1;\r\n          scrollbar-width: thin; scrollbar-color: #1a1a1a transparent;\r\n          min-width: 0; /* CRITICAL: prevents flex child from expanding beyond container width */\r\n        }',
  '          display: flex; gap: 16px; padding: 20px 20px; overflow-x: auto; flex: 1;\r\n          align-items: stretch; min-height: 0;\r\n          scrollbar-width: thin; scrollbar-color: #1a1a1a transparent;\r\n          min-width: 0;\r\n        }'
);

// Fix 3: kb-col — add min-height: 0
code = code.replace(
  '          flex: 0 0 290px; display: flex; flex-direction: column;\r\n          background: #070707; border: 1px solid #111; border-radius: 18px;\r\n          overflow: hidden;\r\n        }',
  '          flex: 0 0 290px; display: flex; flex-direction: column;\r\n          background: #070707; border: 1px solid #111; border-radius: 18px;\r\n          overflow: hidden; min-height: 0;\r\n        }'
);

// Fix 4: col-body — add min-height: 0
code = code.replace(
  '        .col-body { padding: 14px 12px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; scrollbar-width: thin; scrollbar-color: #1a1a1a transparent; }',
  '        .col-body { padding: 14px 12px; flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; scrollbar-width: thin; scrollbar-color: #1a1a1a transparent; }'
);

fs.writeFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', code, 'utf8');
console.log('All 4 CSS fixes applied. File size:', code.length);

// Verify
const verify = fs.readFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', 'utf8');
console.log('kb-body-container min-height:0:', verify.includes('flex-direction: row;\r\n          flex: 1;\r\n          min-height: 0;'));
console.log('kb-board align-items:stretch:', verify.includes('align-items: stretch; min-height: 0;'));
console.log('kb-col min-height:0:', verify.includes('overflow: hidden; min-height: 0;'));
console.log('col-body min-height:0:', verify.includes('flex: 1; min-height: 0; overflow-y: auto;'));
