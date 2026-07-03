const fs = require('fs');

const filePath = 'a:/centrum/src/modules/Shop2Module.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Знаходимо і оновлюємо блок розрахунку очікування (waitingItems)
// Щоб очікуваним вважалось тільки те, де actualArrived < plannedNeed.
const targetRegex = /const\s+waitingQty\s*=\s*displayTotal\s*-\s*actualArrived[\r\n\s]+return\s*\{[\r\n\s]+nom:\s*item\.nom,[\r\n\s]+code:\s*item\.code,[\r\n\s]+waitingQty,[\r\n\s]+actualArrived,[\r\n\s]+displayTotal[\r\n\s]+\}/;

const replacement = `const waitingQty = plannedNeed - actualArrived
                        return {
                          nom: item.nom,
                          code: item.code,
                          waitingQty,
                          actualArrived,
                          displayTotal: plannedNeed // Змінюємо на plannedNeed, щоб показувало "з {потреба}"
                        }`;

if (targetRegex.test(content)) {
  content = content.replace(targetRegex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Shop2Module waiting list rule updated successfully!');
} else {
  console.log('❌ Pattern not found. Showing code surrounding waitingQty:');
  const idx = content.indexOf('const waitingQty =');
  if (idx !== -1) {
    console.log(content.substring(idx - 100, idx + 300));
  } else {
    console.log('waitingQty variable not found!');
  }
}
