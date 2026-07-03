const fs = require('fs');

const filePath = 'a:/centrum/src/modules/Shop2Module.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Замінюємо розрахунок у таблиці
const tableTargetRegex = /const\s+displayNeed\s*=\s*plannedNeed[\r\n\s\/\wа-яА-Я()0-9.,-]*const\s+s1ScrapQty\s*=\s*\(workCardHistory\s*\|\|\s*\[\]\)[\r\n\s\w.?:=|&()\[\]'"]+reduce\([\r\n\s\w+=|&()\[\]'",]+\)[\r\n\s]+const\s+plannedBz\s*=\s*arrival\s*\?\s*\(Number\(arrival\.bz\)\s*\|\|\s*0\)\s*:\s*0[\r\n\s]+const\s+displayTotal\s*=\s*Math\.max\(actualArrived,\s*plannedNeed\s*\+\s*plannedBz\s*-\s*s1ScrapQty\)[\r\n\s]+const\s+displayBz\s*=\s*Math\.max\(0,\s*displayTotal\s*-\s*displayNeed\)/;

const tableReplacement = `const displayNeed = plannedNeed
                           const plannedBz = arrival ? (Number(arrival.bz) || 0) : 0
                           const snapEntry = snap[String(item.nom?.id)] || {}
                           const unitsPerSheet = Number(snapEntry.units_per_sheet) || 1
                           
                           let displayTotal = plannedNeed + plannedBz
                           let displayBz = plannedBz
                           
                           if (actualArrived < plannedNeed) {
                             const shortage = plannedNeed - actualArrived
                             const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
                             const reissueQty = sheetsNeeded * unitsPerSheet
                             displayTotal = actualArrived + reissueQty
                             displayBz = displayTotal - plannedNeed
                           } else {
                             displayTotal = actualArrived
                             displayBz = actualArrived - plannedNeed
                           }`;

// 2. Замінюємо розрахунок у блоці очікування (waitingItems)
const waitingTargetRegex = /const\s+plannedNeed\s*=\s*Number\(item\.need\)\s*\|\|\s*0[\r\n\s\/\wа-яА-Я()0-9.,-]*const\s+s1ScrapQty\s*=\s*\(workCardHistory\s*\|\|\s*\[\]\)[\r\n\s\w.?:=|&()\[\]'"]+reduce\([\r\n\s\w+=|&()\[\]'",]+\)[\r\n\s]+const\s+plannedBz\s*=\s*arrival\s*\?\s*\(Number\(arrival\.bz\)\s*\|\|\s*0\)\s*:\s*0[\r\n\s]+const\s+displayTotal\s*=\s*Math\.max\(actualArrived,\s*plannedNeed\s*\+\s*plannedBz\s*-\s*s1ScrapQty\)[\r\n\s]+const\s+waitingQty\s*=\s*displayTotal\s*-\s*actualArrived/;

const waitingReplacement = `const plannedNeed = Number(item.need) || 0
                         const plannedBz = arrival ? (Number(arrival.bz) || 0) : 0
                         const snapEntry = snap[String(item.nom?.id)] || {}
                         const unitsPerSheet = Number(snapEntry.units_per_sheet) || 1
                         
                         let displayTotal = plannedNeed + plannedBz
                         if (actualArrived < plannedNeed) {
                           const shortage = plannedNeed - actualArrived
                           const sheetsNeeded = Math.ceil(shortage / unitsPerSheet)
                           const reissueQty = sheetsNeeded * unitsPerSheet
                           displayTotal = actualArrived + reissueQty
                         } else {
                           displayTotal = actualArrived
                         }
                         
                         const waitingQty = actualArrived < plannedNeed ? (displayTotal - actualArrived) : 0`;

let updated = false;

if (tableTargetRegex.test(content)) {
  content = content.replace(tableTargetRegex, tableReplacement);
  updated = true;
} else {
  console.log('❌ tableTargetRegex did not match');
}

if (waitingTargetRegex.test(content)) {
  content = content.replace(waitingTargetRegex, waitingReplacement);
  updated = true;
} else {
  console.log('❌ waitingTargetRegex did not match');
}

if (updated) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Shop2Module.jsx reissue logic updated perfectly!');
}
