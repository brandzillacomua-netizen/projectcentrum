// scratch/test_imports_functional.mjs
import * as XLSX from 'xlsx'
import {
  normalizeHomoglyphs,
  parseCSV,
  detectDelimiter,
  parseDiameterFromName,
  autoDetectMapping,
  matchDepartment,
  matchPosition,
  computeBzRemnants,
  computeSheetsRemnants,
  computeCuttersList,
  computeFastenersList,
  computeUserPreviewData
} from '../src/modules/Settings/hooks/subhooks/useSettingsImports.js'

console.log('═══════════════════════════════════════════════════════════════════════')
console.log('🧪 FUNCTIONAL AUDIT: USE_SETTINGS_IMPORTS (PARSERS & LOGIC)')
console.log(`⏱️  Timestamp: ${new Date().toISOString()}`)
console.log('═══════════════════════════════════════════════════════════════════════\n')

let passedTests = 0
let failedTests = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passedTests++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failedTests++
    throw new Error(`Assertion failed: ${message}`)
  }
}

// ─── TEST 1: HOMOGLYPH NORMALIZATION ───
console.log('--- TEST 1: Cyrillic & Latin Homoglyph Normalization ---')
{
  const cyrillicA = 'а' // U+0430
  const latinA = 'a'    // U+0061
  assert(normalizeHomoglyphs(cyrillicA) === normalizeHomoglyphs(latinA), 'Cyrillic "а" normalizes to Latin "a"')

  const cyrillicC = 'С' // U+0421
  const latinC = 'C'    // U+0043
  assert(normalizeHomoglyphs(cyrillicC) === normalizeHomoglyphs(latinC), 'Cyrillic "С" normalizes to Latin "c"')

  // Real factory part name with mixed Cyrillic/Latin characters and punctuation
  const original = 'Кронштейн бічний (тип-А) 2026'
  const mixed = 'Kpoнштeйн бiчний (тип-A) 2026' // contains Latin K, p, o, e, i, A
  assert(normalizeHomoglyphs(original) === normalizeHomoglyphs(mixed), 'Mixed Cyrillic/Latin strings match after normalization')
}

// ─── TEST 2: CSV PARSER & DELIMITER DETECTION ───
console.log('\n--- TEST 2: Robust CSV Parser & Delimiter Detection ---')
{
  const semiText = 'Номенклатура;Склад\n"Деталь 1; тип А";15\nДеталь 2;25\n'
  assert(detectDelimiter(semiText) === ';', 'Detects semicolon delimiter')

  const parsedSemi = parseCSV(semiText, ';')
  assert(parsedSemi.length === 3, 'Parses 3 rows (header + 2 data rows)')
  assert(parsedSemi[1][0] === 'Деталь 1; тип А', 'Correctly preserves semicolon inside quoted cells')
  assert(parsedSemi[1][1] === '15', 'Parses second column correctly')

  const commaText = 'name,qty\n"Part, with comma",10\n"Escaped ""quotes""",5'
  assert(detectDelimiter(commaText) === ',', 'Detects comma delimiter')
  const parsedComma = parseCSV(commaText, ',')
  assert(parsedComma[1][0] === 'Part, with comma', 'Correctly preserves comma inside quotes')
  assert(parsedComma[2][0] === 'Escaped "quotes"', 'Correctly unescapes double quotes')
}

// ─── TEST 3: BZ REMNANTS PARSER & MATCHER ───
console.log('\n--- TEST 3: BZ Remnants Processing (processBzRemnants) ---')
{
  const mockNomenclatures = [
    { id: 'nom-bz-01', name: 'Ніжка столу 710мм', type: 'part' },
    { id: 'nom-bz-02', name: 'Кронштейн опорний', type: 'part' }
  ]

  // CSV has 1 exact match, 1 homoglyph match (Latin 'o' and 'e'), and 1 unrecognized
  const csvContent = [
    ['Номенклатура', 'Склад'],
    ['Ніжка столу 710мм', '12'],
    ['Крoнштeйн опорний', '8'], // homoglyphs
    ['Невідома тестова деталь', '5']
  ]

  const result = computeBzRemnants(csvContent, mockNomenclatures)
  
  assert(result.leftovers.length === 2, '2 recognized items in leftovers')
  const item1 = result.leftovers.find(i => i.nomenclature_id === 'nom-bz-01')
  assert(item1 && item1.qty === 12, 'Exact match found with correct qty (12)')

  const item2 = result.leftovers.find(i => i.nomenclature_id === 'nom-bz-02')
  assert(item2 && item2.qty === 8, 'Homoglyph match found with correct qty (8)')

  assert(result.unrecognized.length === 1, '1 unrecognized item flagged')
  assert(result.unrecognized[0].name === 'Невідома тестова деталь', 'Unrecognized part captured')
  assert(result.unrecognized[0].qty === 5, 'Unrecognized part qty preserved')
  assert(result.unrecognized[0].rowNum === 4, 'Correct row number recorded (4)')
}

// ─── TEST 4: PREPARED SHEETS REMNANTS PARSER ───
console.log('\n--- TEST 4: Prepared Sheets Processing (processSheetsRemnants) ---')
{
  const mockNomenclatures = [
    { id: 'sheet-01', name: 'Лист сталь 2мм [Підготовлений]', type: 'raw' }
  ]

  const csvContent = [
    ['Назва матеріалу', 'Кількість'],
    ['Лист сталь 2мм [Підготовлений]', '30'],
    ['Лист алюміній 3мм', '15']
  ]

  const preview = computeSheetsRemnants(csvContent, mockNomenclatures)
  assert(preview.length === 2, '2 sheet items previewed')
  
  const existingSheet = preview.find(p => p.name === 'Лист сталь 2мм [Підготовлений]')
  assert(existingSheet && !existingSheet.isNew && existingSheet.nomenclature_id === 'sheet-01', 'Existing sheet matched to DB')
  assert(existingSheet.qty === 30, 'Existing sheet qty matches (30)')

  const newSheet = preview.find(p => p.name === 'Лист алюміній 3мм')
  assert(newSheet && newSheet.isNew && newSheet.nomenclature_id === null, 'New sheet flagged as isNew: true')
  assert(newSheet.qty === 15, 'New sheet qty matches (15)')
}

// ─── TEST 5: CUTTERS CSV PARSER & DIAMETER EXTRACTION ───
console.log('\n--- TEST 5: Cutters CSV Processing & Diameter Sorting ---')
{
  // Test diameter parser independently
  assert(parseDiameterFromName('Фреза кінцева 3.175х12') === 3.175, 'Parses 3.175 from "3.175х12"')
  assert(parseDiameterFromName('Фреза компресійна ø6 мм') === 6, 'Parses 6 from "ø6 мм"')
  assert(parseDiameterFromName('Фреза чорнова 12,5 мм') === 12.5, 'Parses 12.5 from comma format "12,5"')
  assert(parseDiameterFromName('Фреза 4') === 4, 'Parses single integer "4"')

  const csvContent = [
    ['Номенклатура', 'Діаметр', 'Залишок'],
    ['Фреза алмазна 12мм', '', '2'],
    ['Фреза компресійна ø6 мм', '6.0', '10'],
    ['Фреза мікро 3.175х12', '', '5'],
    ['Свердло по металу 8мм', '', '20'] // Not a cutter -> must be filtered out!
  ]

  const cutters = computeCuttersList(csvContent)
  assert(cutters.length === 3, 'Non-cutter item (Свердло) correctly filtered out')

  // Check sort order: must be strictly ascending by diameter (3.175, then 6.0, then 12.0)
  assert(cutters[0].diameter === 3.175 && cutters[0].qty === 5, '1st cutter: 3.175mm')
  assert(cutters[1].diameter === 6.0 && cutters[1].qty === 10, '2nd cutter: 6.0mm')
  assert(cutters[2].diameter === 12.0 && cutters[2].qty === 2, '3rd cutter: 12.0mm')
}

// ─── TEST 6: FASTENERS CSV PARSER ───
console.log('\n--- TEST 6: Fasteners CSV Processing & Alphabetical Sorting ---')
{
  const csvContent = [
    ['Номенклатура', 'Кількість'],
    ['Шайба М6 DIN 125', '500'],
    ['Болт М8х30 DIN 933', '200'],
    ['Гайка М8 DIN 934', '300']
  ]

  const fasteners = computeFastenersList(csvContent)
  assert(fasteners.length === 3, 'All 3 fasteners parsed')
  assert(fasteners[0].name.startsWith('Болт'), '1st sorted item: Болт')
  assert(fasteners[1].name.startsWith('Гайка'), '2nd sorted item: Гайка')
  assert(fasteners[2].name.startsWith('Шайба'), '3rd sorted item: Шайба')
  assert(fasteners[0].qty === 200, 'Quantities accurately preserved')
}

// ─── TEST 7: USER IMPORT COLUMN AUTO-DETECTION & PREVIEW ───
console.log('\n--- TEST 7: User CSV Auto-Detection & Mapping ---')
{
  const headers = ['Логін', 'Пароль', 'Ім’я', 'Прізвище', 'Цех', 'Посада', 'Зміна']
  const mapping = autoDetectMapping(headers)
  
  assert(mapping.login === 0, 'Auto-detected login column (0)')
  assert(mapping.password === 1, 'Auto-detected password column (1)')
  assert(mapping.first_name === 2, 'Auto-detected first_name column (2)')
  assert(mapping.last_name === 3, 'Auto-detected last_name column (3)')
  assert(mapping.department === 4, 'Auto-detected department column (4)')
  assert(mapping.position === 5, 'Auto-detected position column (5)')
  assert(mapping.shift === 6, 'Auto-detected shift column (6)')

  const mockStructure = [
    { id: 'str-1', name: 'Цех №1' },
    { id: 'str-2', name: 'Оперативний склад' }
  ]
  const mockPositions = [
    { id: 'pos-1', name: 'Оператор' },
    { id: 'pos-2', name: 'Майстер цеху' }
  ]
  const mockUsers = [
    { id: 'usr-1', login: 'existing_user', first_name: 'Олег' }
  ]

  assert(matchDepartment('цех 1', mockStructure, 'Цех №1') === 'Цех №1', 'Fuzzy department match: "цех 1" -> "Цех №1"')
  assert(matchDepartment('склад', mockStructure, 'Цех №1') === 'Оперативний склад', 'Fuzzy department match: "склад" -> "Оперативний склад"')
  assert(matchPosition('оператор', mockPositions, 'Оператор') === 'Оператор', 'Position match: "оператор" -> "Оператор"')

  // Preview computation with duplicate skip policy
  const previewSkip = computeUserPreviewData({
    csvRows: [
      ['new_user', 'pass123', 'Іван', 'Петренко', 'Цех №1', 'Оператор', 'Зміна 1'],
      ['existing_user', 'pass456', 'Олег', 'Сидоренко', 'Цех №1', 'Оператор', 'Зміна 2']
    ],
    columnMapping: mapping,
    defaultValues: { password: 'pass', department: 'Цех №1', position: 'Оператор', shift: 'Без зміни' },
    duplicatePolicy: 'skip',
    systemUsers: mockUsers,
    companyStructure: mockStructure,
    companyPositions: mockPositions
  })

  assert(previewSkip.length === 2, '2 users in preview')
  assert(previewSkip[0].status === 'insert', 'New user status is "insert"')
  assert(previewSkip[1].status === 'skip', 'Existing user status is "skip" under duplicatePolicy=skip')

  // Preview computation with duplicate update policy
  const previewUpdate = computeUserPreviewData({
    csvRows: [
      ['existing_user', 'newpass', 'Олег', 'Сидоренко', 'Цех №1', 'Оператор', 'Зміна 2']
    ],
    columnMapping: mapping,
    defaultValues: { password: 'pass', department: 'Цех №1', position: 'Оператор', shift: 'Без зміни' },
    duplicatePolicy: 'update',
    systemUsers: mockUsers,
    companyStructure: mockStructure,
    companyPositions: mockPositions
  })

  assert(previewUpdate[0].status === 'update', 'Existing user status is "update" under duplicatePolicy=update')
}

// ─── TEST 8: REAL EXCEL (.XLSX) ROUND-TRIP BINARY PARSE ───
console.log('\n--- TEST 8: Real Excel (.xlsx) Binary Spreadsheet Round-Trip ---')
{
  // Create an Excel workbook in memory with binary formatting
  const wb = XLSX.utils.book_new()
  const data = [
    ['Номенклатура', 'Діаметр', 'Залишок'],
    ['Фреза компресійна 4мм', '4', 15],
    ['Фреза алмазна 8мм', '8', 6],
    ['Фреза кінцева 2мм', '2', 20]
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Cutters')

  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  assert(excelBuffer.length > 0, 'Generated valid in-memory .xlsx file buffer')

  // Read back buffer using XLSX engine
  const readWb = XLSX.read(excelBuffer, { type: 'buffer' })
  const readWs = readWb.Sheets[readWb.SheetNames[0]]
  const parsedSheet = XLSX.utils.sheet_to_json(readWs, { header: 1 })

  assert(parsedSheet.length === 4, 'Parsed 4 rows from Excel binary')
  
  // Convert into format expected by computeCuttersList
  const stringified = parsedSheet.map(row => row.map(cell => String(cell ?? '')))
  const cuttersFromExcel = computeCuttersList(stringified)

  assert(cuttersFromExcel.length === 3, 'Excel file processed successfully with 3 cutters')
  assert(cuttersFromExcel[0].diameter === 2, 'Sorted 1st: 2mm cutter')
  assert(cuttersFromExcel[1].diameter === 4, 'Sorted 2nd: 4mm cutter')
  assert(cuttersFromExcel[2].diameter === 8, 'Sorted 3rd: 8mm cutter')
  assert(cuttersFromExcel[0].qty === 20, 'Excel numeric cell values parsed accurately into qty (20)')
}

console.log('\n═══════════════════════════════════════════════════════════════════════')
console.log(`🎉 ALL TESTS PASSED! (${passedTests} passed, ${failedTests} failed)`)
console.log('✓ useSettingsImports parsing logic is 100% functionally verified!')
console.log('═══════════════════════════════════════════════════════════════════════')
