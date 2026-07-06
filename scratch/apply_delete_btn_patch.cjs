const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

const target = `                                              {/* Кнопка видалення для кастомних позицій */}
                                              {item.isCustom && (
                                                <button
                                                  onClick={e => { e.stopPropagation(); handleRemoveCustomItem(item.uid) }}`;

const replacement = `                                              {/* Кнопка видалення для кастомних позицій */}
                                              {item.isCustom && !isPicked && !activeBatchData.isPackaged && (
                                                <button
                                                  onClick={e => { e.stopPropagation(); handleRemoveCustomItem(item.nom.id) }}`;

// Let's do a more robust substring replace using split
const lines = content.split('\n');
let replaced = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Кнопка видалення для кастомних позицій')) {
    // lines[i+1] is item.isCustom
    // lines[i+3] has handleRemoveCustomItem
    if (lines[i+1].includes('item.isCustom') && lines[i+3].includes('handleRemoveCustomItem')) {
      lines[i+1] = '                                              {item.isCustom && !isPicked && !activeBatchData.isPackaged && (';
      lines[i+3] = '                                                  onClick={e => { e.stopPropagation(); handleRemoveCustomItem(item.nom.id) }}';
      replaced = true;
      console.log(`Replaced lines at index ${i}`);
      break;
    }
  }
}

if (replaced) {
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('SUCCESS: Delete button updated successfully!');
} else {
  console.error('ERROR: Could not match the delete button block');
}
