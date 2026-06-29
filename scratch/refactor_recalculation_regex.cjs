const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/modules/ForemanWorkplace.jsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Замінимо в обох функціях статус нових запитів на 'pending'
// Шукаємо shouldAutoReserve та замінюємо на фіксований 'pending'
content = content.replace(/const newStatus = shouldAutoReserve \? 'issued' : 'pending'/g, "const newStatus = 'pending'");

// 2. Видалимо виклики Promise.all(newInventoryReservations)
content = content.replace(/if \(newInventoryReservations\.length > 0\) \{\s*await Promise\.all\(newInventoryReservations\)\s*\}/g, "");

// 3. Замінимо alert(...) на setCustomAlert(...)
content = content.replace(/alert\(\`✅ Верстат успішно змінено на \${newMachine}\. Запити на фрези перераховано та перебронювано!\`\)/g, 
  "setCustomAlert({ title: 'Верстат наряду змінено', message: '✅ Верстат наряду успішно змінено. Бронь зі старих фрез знято. Надіслано новий запит на СО для видачі нових фрез!' })");

content = content.replace(/alert\(\`Помилка при зміні верстата: \${e\.message}\`\)/g,
  "setCustomAlert({ title: 'Помилка', message: `Помилка при зміні верстата: ${e.message}` })");

content = content.replace(/alert\(\`✅ Верстат\/розподіл для деталі успішно змінено\. Запити на фрези перераховано та зарезервовано на складі!\`\)/g,
  "setCustomAlert({ title: 'Верстат деталі змінено', message: '✅ Верстат/розподіл для деталі успішно змінено. Бронь зі старих фрез знято. Надіслано новий запит на СО для видачі нових фрез!' })");

content = content.replace(/alert\(\`Помилка при перерахунку фрез: \${e\.message}\`\)/g,
  "setCustomAlert({ title: 'Помилка', message: `Помилка при перерахунку фрез: ${e.message}` })");

fs.writeFileSync(filePath, content.replace(/\n/g, '\r\n'), 'utf8');
console.log("REGEX_REFACTOR_SUCCESS");
