const fs = require('fs');

// 1. Patch ForemanWorkplace.jsx
const fwPath = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
let fwContent = fs.readFileSync(fwPath, 'utf8');

// Insert getRequestQty function
const insertAfter = "import { supabase } from '../supabase'";
const helperFunc = `
const getRequestQty = (r) => {
  if (r.quantity !== null && r.quantity !== undefined) return Number(r.quantity);
  const match = (r.details || '').match(/—\\s*(\\d+)/);
  return match ? Number(match[1]) : 0;
};
`;
fwContent = fwContent.replace(insertAfter, insertAfter + helperFunc);

// Replace (Number(r.quantity) || 0) with getRequestQty(r)
fwContent = fwContent.replaceAll("(Number(r.quantity) || 0)", "getRequestQty(r)");

fs.writeFileSync(fwPath, fwContent, 'utf8');
console.log('ForemanWorkplace.jsx patched successfully');

// 2. Patch useWarehouse.js
const uwPath = 'a:/centrum/src/contexts/useWarehouse.js';
let uwContent = fs.readFileSync(uwPath, 'utf8');

const targetUpsert = `      if (requestUpdateList.length > 0) {
        reqPromises.push(supabase.from('material_requests').upsert(requestUpdateList.map(upd => {
          const res = {
            id: upd.id,
            status: upd.status,
            inventory_id: upd.inventory_id
          }
          if (upd.quantity !== undefined) res.quantity = upd.quantity
          return res
        })))
      }`;

const replacementUpsert = `      if (requestUpdateList.length > 0) {
        reqPromises.push(supabase.from('material_requests').upsert(requestUpdateList.map(upd => {
          const originalReq = relevantRequests.find(r => r.id === upd.id)
          const res = {
            id: upd.id,
            status: upd.status,
            inventory_id: upd.inventory_id,
            quantity: upd.quantity !== undefined ? upd.quantity : (originalReq ? originalReq.quantity : null)
          }
          return res
        })))
      }`;

if (uwContent.includes(targetUpsert)) {
  uwContent = uwContent.replace(targetUpsert, replacementUpsert);
  fs.writeFileSync(uwPath, uwContent, 'utf8');
  console.log('useWarehouse.js patched successfully');
} else {
  console.log('WARNING: Could not find target upsert in useWarehouse.js');
}
