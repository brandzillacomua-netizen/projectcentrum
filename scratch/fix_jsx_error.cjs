const fs = require('fs');
const path = require('path');

const filepath = path.resolve(__dirname, '../src/modules/NomenclatureModule.jsx');
let content = fs.readFileSync(filepath, 'utf8');

// The problematic block in mobile view is:
//                      {(n.type === 'part' || n.type === 'consumable') && (
//                        <div style={{ color: '#555', fontSize: '0.8rem', marginTop: '5px', borderTop: '1px solid #222', paddingTop: '5px' }}>
//                          ...
//                        </div>
//                       <div style={{ color: '#555', fontSize: '0.8rem', marginTop: '5px', borderTop: '1px solid #222', paddingTop: '5px' }}>
//                          ...
//                       </div>
//                     )}

// We want to replace it with a clean single div block.
// Let's use a regex to replace this specific duplicate pattern.
const targetPattern = /\{\(n\.type === 'part' \|\| n\.type === 'consumable'\) && \([\s\S]*?<\/div>\s*<div style=\{\{\s*color:\s*['"]#555['"][\s\S]*?<\/div>\s*<\/div>\s*\)\}/;

const cleanBlock = `{(n.type === 'part' || n.type === 'consumable') && (
                        <div style={{ color: '#555', fontSize: '0.8rem', marginTop: '5px', borderTop: '1px solid #222', paddingTop: '5px' }}>
                          {n.type === 'part' && (
                            <>
                              <div>Мат: {n.material_type}</div>
                              <div>Шт/Лист: {n.units_per_sheet} | Час: {n.time_per_unit} хв</div>
                            </>
                          )}
                          {n.type === 'consumable' && (
                            <>
                              <div>Витрата: {n.consumption_per_sheet} шт/л</div>
                              <div>Ресурс: {n.time_per_unit}</div>
                            </>
                          )}
                        </div>
                      )}`;

if (targetPattern.test(content)) {
  content = content.replace(targetPattern, cleanBlock);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log("SUCCESS: Replaced the duplicate JSX block!");
} else {
  console.log("ERROR: Target pattern not found in file. Let's do a substring replace.");
  // Let's search by direct string search of a smaller part
  const badPart = `                       <div style={{ color: '#555', fontSize: '0.8rem', marginTop: '5px', borderTop: '1px solid #222', paddingTop: '5px' }}>
                         {n.type === 'part' && (
                           <>
                             <div>Мат: {n.material_type}</div>
                             <div>Шт/Лист: {n.units_per_sheet} | Час: {n.time_per_unit} хв</div>
                           </>
                         )}
                         {n.type === 'consumable' && (
                           <>
                             <div>Витрата: {n.consumption_per_sheet} шт/л</div>
                             <div>Ресурс: {n.time_per_unit}</div>
                           </>
                         )}
                       </div>`;
  // Let's replace the first occurrence of this badPart (which is the duplicate one) with empty string or handle it
  // Wait, let's normalize line endings to unix for replacement
  const normalized = content.replace(/\r\n/g, '\n');
  const badPartNormalized = badPart.replace(/\r\n/g, '\n');
  if (normalized.includes(badPartNormalized)) {
    // Replace bad part only if it appears twice or under specific lines
    const replaced = normalized.replace(badPartNormalized, ''); // This will replace the first occurrence
    // Let's write it back with windows newlines
    fs.writeFileSync(filepath, replaced.replace(/\n/g, '\r\n'), 'utf8');
    console.log("SUCCESS: Replaced via substring search!");
  } else {
    console.log("ERROR: Substring not found either.");
  }
}
