const fs = require('fs');

// 1. Update TumblingDashboard.jsx
let dashContent = fs.readFileSync('a:/centrum/src/modules/TumblingDashboard.jsx', 'utf8');

dashContent = dashContent.replace(
  `c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)')`,
  `(c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)')) ||
        (c.status === 'new' && (c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)' || c.operation === 'Галтовка (Сушка)'))`
);

dashContent = dashContent.replace(
  `c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)')`,
  `(c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)')) ||
        (c.status === 'new' && (c.operation === 'Галтовка (Вібростіл)' || c.operation === 'Галтовка (Мийка)' || c.operation === 'Галтовка (Галтовка)' || c.operation === 'Галтовка (Сушка)'))`
);

fs.writeFileSync('a:/centrum/src/modules/TumblingDashboard.jsx', dashContent, 'utf8');
console.log('Successfully updated TumblingDashboard.jsx!');
