const fs = require('fs');
const path = 'a:/centrum/src/contexts/useProduction.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add getRequestQty helper
const insertAfter = "import { supabase } from '../supabase'";
const helper = `
const getRequestQty = (r) => {
  if (r.quantity !== null && r.quantity !== undefined) return Number(r.quantity);
  const match = (r.details || '').match(/—\\s*(\\d+)/);
  return match ? Number(match[1]) : 0;
};
`;
content = content.replace(insertAfter, insertAfter + helper);

// 2. Replace target line in superDeleteOrder:
// "const qty = Number(req.quantity) || 0" -> "const qty = getRequestQty(req)"
content = content.replace("const qty = Number(req.quantity) || 0", "const qty = getRequestQty(req)");

// 3. Replace in createWorkCardsBatch:
// "let originalCutterQty = Number(req.quantity)" -> "let originalCutterQty = getRequestQty(req)"
content = content.replace("let originalCutterQty = Number(req.quantity)", "let originalCutterQty = getRequestQty(req)");
content = content.replace("originalCutterQty = Number(foundCons.total) || Number(req.quantity)", "originalCutterQty = Number(foundCons.total) || getRequestQty(req)");
content = content.replace("const nextReqQty = Math.max(0, (Number(req.quantity) || 0) - totalDeduction)", "const nextReqQty = Math.max(0, getRequestQty(req) - totalDeduction)");

fs.writeFileSync(path, content, 'utf8');
console.log('useProduction.js successfully patched for null quantity fixes!');
