/**
 * fix_encoding_all.cjs
 * Reads files that were accidentally double-encoded (saved as Win1251 but read as UTF-8),
 * and rewrites them correctly as proper UTF-8.
 */
const fs = require('fs');
const path = require('path');

// All potentially affected files in Nomenclature module
const FILES = [
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\hooks\\useNomenclatureCardData.js',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\BomTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\CncTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\IdentificationTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\InventoryTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\tabs\\ParamsTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\index.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\hooks\\useNomenclatureCardData.js',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\BomTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\CncTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\IdentificationTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\InventoryTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\tabs\\ParamsTab.jsx',
  'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\index.jsx',
];

/**
 * Detects if a string contains the garbled "double-encoded" pattern.
 * Win1251 Cyrillic when mis-interpreted as Latin-1 then stored as UTF-8
 * produces sequences like: РЎ, РА, С‚, Рµ, etc.
 */
function isGarbled(str) {
  return /[Р][А-ЯёЁа-яЎ°\u0080-\u009f]/.test(str) || /С[‚ЂЃ„…†‡ˆ‰Š‹ŒŽ]/.test(str);
}

/**
 * Converts garbled text back to proper Cyrillic.
 * The text was originally UTF-8 Cyrillic, saved as Win1251 bytes, 
 * then those bytes were read as Latin-1 and re-encoded as UTF-8.
 * 
 * To reverse: take each character, get its char code (which is the wrong Latin-1 value),
 * create a buffer of those bytes, then decode that buffer as Win1251 (CP1251).
 */
function fixDoubleEncoding(str) {
  // Encode the garbled string as latin1 bytes, which reverses the mis-reading
  const bytes = Buffer.from(str, 'latin1');
  
  // Now decode those bytes as Windows-1251 to get proper Cyrillic
  // Node.js doesn't have native CP1251, but we can use a manual table
  const cp1251 = [
    0x0402, 0x0403, 0x201A, 0x0453, 0x201E, 0x2026, 0x2020, 0x2021,
    0x20AC, 0x2030, 0x0409, 0x2039, 0x040A, 0x040C, 0x040B, 0x040F,
    0x0452, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
    0xFFFD, 0x2122, 0x0459, 0x203A, 0x045A, 0x045C, 0x045B, 0x045F,
    0x00A0, 0x040E, 0x045E, 0x0408, 0x00A4, 0x0490, 0x00A6, 0x00A7,
    0x0401, 0x00A9, 0x0404, 0x00AB, 0x00AC, 0x00AD, 0x00AE, 0x0407,
    0x00B0, 0x00B1, 0x0406, 0x0456, 0x0491, 0x00B5, 0x00B6, 0x00B7,
    0x0451, 0x2116, 0x0454, 0x00BB, 0x0458, 0x0405, 0x0455, 0x0457,
    0x0410, 0x0411, 0x0412, 0x0413, 0x0414, 0x0415, 0x0416, 0x0417,
    0x0418, 0x0419, 0x041A, 0x041B, 0x041C, 0x041D, 0x041E, 0x041F,
    0x0420, 0x0421, 0x0422, 0x0423, 0x0424, 0x0425, 0x0426, 0x0427,
    0x0428, 0x0429, 0x042A, 0x042B, 0x042C, 0x042D, 0x042E, 0x042F,
    0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0437,
    0x0438, 0x0439, 0x043A, 0x043B, 0x043C, 0x043D, 0x043E, 0x043F,
    0x0440, 0x0441, 0x0442, 0x0443, 0x0444, 0x0445, 0x0446, 0x0447,
    0x0448, 0x0449, 0x044A, 0x044B, 0x044C, 0x044D, 0x044E, 0x044F,
  ];

  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) {
      result += String.fromCharCode(b);
    } else if (b >= 0xC0) {
      result += String.fromCharCode(cp1251[b - 0x80]);
    } else {
      // 0x80-0xBF range
      result += String.fromCharCode(cp1251[b - 0x80]);
    }
  }
  return result;
}

let fixed = 0;
let skipped = 0;

FILES.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found):', filePath);
    return;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  
  if (!isGarbled(original)) {
    console.log('OK (no garbling):', path.basename(filePath));
    skipped++;
    return;
  }

  const corrected = fixDoubleEncoding(original);
  
  // Sanity check: result should contain Cyrillic
  if (/[А-ЯҐЄІЇа-яґєії]/.test(corrected)) {
    fs.writeFileSync(filePath, corrected, 'utf8');
    console.log('FIXED:', path.basename(filePath));
    fixed++;
  } else {
    console.log('ERROR (no Cyrillic after fix):', path.basename(filePath));
  }
});

console.log(`\nDone. Fixed: ${fixed}, Skipped: ${skipped}`);
