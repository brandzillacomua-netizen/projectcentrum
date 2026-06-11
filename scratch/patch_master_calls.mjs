import { readFileSync, writeFileSync } from 'fs'

const filePath = 'a:/centrum/src/modules/MasterModule_v3.jsx'
let src = readFileSync(filePath, 'utf8')
const hasCRLF = src.includes('\r\n')
if (hasCRLF) src = src.replace(/\r\n/g, '\n')

// ── PATCH 1: Pass selectedCutters to createNaryad in handlePrint ──────────────
const call1Old = `          await apiService.submitCreateTask(activeNaryadOrder.id, taskMachineName, (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline, rowMachines, materialSplits));`
const call1New = `          await apiService.submitCreateTask(activeNaryadOrder.id, taskMachineName, (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline, rowMachines, materialSplits, selectedCutters));`

const call2Old = `        await apiService.submitCreateTask(activeNaryadOrder.id, taskMachineName, (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline, rowMachines, materialSplits))`
const call2New = `        await apiService.submitCreateTask(activeNaryadOrder.id, taskMachineName, (oid, m) => createNaryad(oid, m, naryadQtys, naryadDeadline, rowMachines, materialSplits, selectedCutters))`

if (!src.includes(call1Old)) { console.error('Call 1 anchor not found'); process.exit(1) }
src = src.replace(call1Old, call1New)

if (!src.includes(call2Old)) { console.error('Call 2 anchor not found'); process.exit(1) }
src = src.replace(call2Old, call2New)
console.log('✓ createNaryad calls in MasterModule_v3 updated with selectedCutters')

if (hasCRLF) src = src.replace(/\n/g, '\r\n')
writeFileSync(filePath, src, 'utf8')
console.log('✓ MasterModule_v3.jsx updated successfully')
