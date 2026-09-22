/**
 * restore_cardmodal.cjs
 * 
 * The NomenclatureCardModal index.jsx files were corrupted.
 * The .old.jsx file has intact template literals, we copy it to both destinations.
 * Then we also ensure all tab files are clean copies from Refactor.
 */
const fs = require('fs');

const base = 'A:\\centrum\\src\\modules\\Nomenclature\\components';
const OLD_FILE  = base + '\\NomenclatureCardModal.old.jsx';
const DEST1     = base + '\\NomenclatureCardModal\\index.jsx';
const DEST2     = base + '\\NomenclatureCardModalRefactor\\index.jsx';

// Helper: detect garbled Win1251-as-UTF8 text
function isGarbled(s) {
  return /[Р][А-ЯёЁа-яЎ°\u0080-\u009f]/.test(s) || /С[‚ЂЃ„…†‡ˆ‰Š‹ŒŽ]/.test(s);
}

// Win-1251 decode table for bytes 0x80-0xFF
const CP1251 = [
  0x0402,0x0403,0x201A,0x0453,0x201E,0x2026,0x2020,0x2021,
  0x20AC,0x2030,0x0409,0x2039,0x040A,0x040C,0x040B,0x040F,
  0x0452,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
  0xFFFD,0x2122,0x0459,0x203A,0x045A,0x045C,0x045B,0x045F,
  0x00A0,0x040E,0x045E,0x0408,0x00A4,0x0490,0x00A6,0x00A7,
  0x0401,0x00A9,0x0404,0x00AB,0x00AC,0x00AD,0x00AE,0x0407,
  0x00B0,0x00B1,0x0406,0x0456,0x0491,0x00B5,0x00B6,0x00B7,
  0x0451,0x2116,0x0454,0x00BB,0x0458,0x0405,0x0455,0x0457,
  0x0410,0x0411,0x0412,0x0413,0x0414,0x0415,0x0416,0x0417,
  0x0418,0x0419,0x041A,0x041B,0x041C,0x041D,0x041E,0x041F,
  0x0420,0x0421,0x0422,0x0423,0x0424,0x0425,0x0426,0x0427,
  0x0428,0x0429,0x042A,0x042B,0x042C,0x042D,0x042E,0x042F,
  0x0430,0x0431,0x0432,0x0433,0x0434,0x0435,0x0436,0x0437,
  0x0438,0x0439,0x043A,0x043B,0x043C,0x043D,0x043E,0x043F,
  0x0440,0x0441,0x0442,0x0443,0x0444,0x0445,0x0446,0x0447,
  0x0448,0x0449,0x044A,0x044B,0x044C,0x044D,0x044E,0x044F,
];

function fixGarbling(str) {
  const bytes = Buffer.from(str, 'latin1');
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) result += String.fromCharCode(b);
    else result += String.fromCharCode(CP1251[b - 0x80] || b);
  }
  return result;
}

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) { console.log('NOT FOUND:', filePath); return; }
  let content = fs.readFileSync(filePath, 'utf8');
  // Remove BOM
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  if (isGarbled(content)) {
    content = fixGarbling(content);
    // Remove BOM again after decode
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('DONE:', filePath.split('\\').pop());
}

// Step 1: Copy clean .old.jsx to both index destinations
console.log('\n=== Restoring index.jsx from .old.jsx ===');
const oldContent = fs.readFileSync(OLD_FILE, 'utf8');
fs.writeFileSync(DEST1, oldContent, 'utf8');
fs.writeFileSync(DEST2, oldContent, 'utf8');
console.log('Restored index.jsx in both CardModal folders');

// The .old.jsx might have different import paths, just verify it compiles.
// The imports inside it should be the same tab files.

// Step 2: Fix all tab files (they need garbling fixed, no template literal issue)
console.log('\n=== Fixing garbling in tab files ===');
const tabFolders = [
  base + '\\NomenclatureCardModal\\tabs',
  base + '\\NomenclatureCardModalRefactor\\tabs',
];
const TAB_FILES = ['BomTab.jsx','CncTab.jsx','IdentificationTab.jsx','InventoryTab.jsx','ParamsTab.jsx'];

tabFolders.forEach(folder => {
  TAB_FILES.forEach(f => {
    const fullPath = folder + '\\' + f;
    fixFile(fullPath);
  });
});

// Step 3: Fix hooks
console.log('\n=== Fixing hook files ===');
[
  base + '\\NomenclatureCardModal\\hooks\\useNomenclatureCardData.js',
  base + '\\NomenclatureCardModalRefactor\\hooks\\useNomenclatureCardData.js',
].forEach(fixFile);

console.log('\nAll done!');
