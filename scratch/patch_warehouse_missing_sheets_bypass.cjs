const fs = require('fs');

const filePath = 'a:/centrum/src/modules/WarehouseModuleV2.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Шукаємо блок визначення hasMissingSheets та пріоритетності статусів
const searchStr = `                const hasMissingSheets = missingItems.some(req => {
                  const nameLower = parseMaterialName(req.details).toLowerCase()
                  return nameLower.includes('лист') && nameLower.includes('підготовлений')
                })

                // Пріоритетність статусів
                let btnLabel = ''
                let isAwaiting = false

                if (hasMissingSheets) {
                  btnLabel = 'ОЧІКУЄМ ЛИСТИ'
                  isAwaiting = true
                } else if (missingItems.length === 0) {`;

const replacement = `                // Пріоритетність статусів
                let btnLabel = ''
                let isAwaiting = false

                if (missingItems.length === 0) {`;

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ WarehouseModuleV2.jsx updated successfully: removed missing sheets blocking!');
} else {
  // LF fallback
  const searchStrLF = searchStr.replace(/\r\n/g, '\n');
  if (content.includes(searchStrLF)) {
    content = content.replace(searchStrLF, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ WarehouseModuleV2.jsx updated successfully via LF fallback!');
  } else {
    console.log('❌ Could not find target blocking code in WarehouseModuleV2.jsx!');
  }
}
