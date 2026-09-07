import { describe, it, expect, vi } from 'vitest'
import { formatNomenclatureRowsForExport, exportNomenclatureToCSV } from '../src/modules/Nomenclature/io/exportService'
import { autoMapHeader, parseImportFile } from '../src/modules/Nomenclature/io/importParser'
import { validateImportRows } from '../src/modules/Nomenclature/io/importValidator'
import { executeBatchImport } from '../src/modules/Nomenclature/io/batchProcessor'

describe('Nomenclature V2 I/O Sub-system Unit Tests', () => {
  
  const mockGroups = [
    { id: 'grp_production_frames', name: 'Продакшн', code: 'FG.PRODUCTION' },
    { id: 'cat_parts', name: 'Деталі', code: 'PARTS' }
  ]

  const mockItems = [
    { id: 'v2-1', code: 'V2-90001', name: 'Комплект рами JET 13"', group_id: 'grp_production_frames', unit: 'шт', status: 'active' },
    { id: 'v2-2', code: 'V2-90002', name: 'Планка карбонова 3мм', group_id: 'cat_parts', unit: 'шт', status: 'active' }
  ]

  describe('Export Service (exportService.js)', () => {
    it('correctly formats rows with resolved group names for export', () => {
      const formatted = formatNomenclatureRowsForExport(mockItems, mockGroups)
      expect(formatted).toHaveLength(2)
      expect(formatted[0]['Код V2']).toBe('V2-90001')
      expect(formatted[0]['Стандартизована назва']).toBe('Комплект рами JET 13"')
      expect(formatted[0]['Категорія (Група)']).toBe('Продакшн')
      expect(formatted[1]['Категорія (Група)']).toBe('Деталі')
    })
  })

  describe('Import Parser (importParser.js)', () => {
    it('correctly auto-maps Ukrainian and English header aliases', () => {
      expect(autoMapHeader('Код V2')).toBe('code')
      expect(autoMapHeader('Артикул')).toBe('code')
      expect(autoMapHeader('Стандартизована назва')).toBe('name')
      expect(autoMapHeader('Назва')).toBe('name')
      expect(autoMapHeader('Категорія')).toBe('group_id')
      expect(autoMapHeader('Одиниця виміру')).toBe('unit')
      expect(autoMapHeader('Статус')).toBe('status')
    })
  })

  describe('Import Validator (importValidator.js)', () => {
    it('detects missing names as critical errors and validates valid rows', () => {
      const parsedRows = [
        { rowIndex: 2, code: 'V2-90003', name: 'Нова рама F5', group_id: 'grp_production_frames', unit: 'шт' },
        { rowIndex: 3, code: 'V2-90004', name: '', group_id: 'cat_parts', unit: 'шт' },
        { rowIndex: 4, code: 'V2-90001', name: 'Комплект рами JET 13"', group_id: 'grp_production_frames', unit: 'шт' }
      ]

      const result = validateImportRows(parsedRows, mockItems, mockGroups)

      expect(result.validCount).toBe(2)
      expect(result.invalidCount).toBe(1)
      expect(result.duplicateCount).toBe(1) // V2-90001 collides with mockItems
      expect(result.invalidRows[0].errors).toContain('Відсутня назва позиції (обовязкове поле)')
    })
  })

  describe('Batch Processor (batchProcessor.js)', () => {
    it('respects "skip" strategy for duplicate items', async () => {
      const validRows = [
        { code: 'V2-90001', name: 'Комплект рами JET 13"', isDbDuplicate: true, existingMatch: mockItems[0] },
        { code: 'V2-90005', name: 'Нова рама BIT 10"', isDbDuplicate: false }
      ]

      const result = await executeBatchImport({
        validRows,
        strategy: 'skip',
        existingItems: mockItems
      })

      expect(result.skippedCount).toBe(1)
    })
  })

})
