import React, { useState } from 'react'
import { Upload, X, FileSpreadsheet, AlertTriangle, CheckCircle2, RefreshCw, ArrowRight, ShieldAlert, Database } from 'lucide-react'
import { parseImportFile } from '../io/importParser'
import { validateImportRows } from '../io/importValidator'
import { executeBatchImport } from '../io/batchProcessor'

export const NomenclatureImportModal = ({
  isOpen,
  onClose,
  onImportComplete,
  existingItems = [],
  groups = []
}) => {
  const [step, setStep] = useState(1) // 1: Upload, 2: Preview & Validation, 3: Execution Progress
  const [file, setFile] = useState(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  const [parsedData, setParsedData] = useState(null) // { parsedRows, detectedMapping, totalRowsCount }
  const [validationResult, setValidationResult] = useState(null) // { validRows, invalidRows, warningRows, duplicateRows... }

  const [strategy, setStrategy] = useState('skip') // 'skip' | 'overwrite' | 'new_code'
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressState, setProgressState] = useState({ current: 0, total: 0, percentage: 0, successCount: 0, skippedCount: 0, errorCount: 0 })

  if (!isOpen) return null

  const resetModalState = () => {
    setStep(1)
    setFile(null)
    setIsParsing(false)
    setParseError('')
    setParsedData(null)
    setValidationResult(null)
    setStrategy('skip')
    setIsProcessing(false)
    setProgressState({ current: 0, total: 0, percentage: 0, successCount: 0, skippedCount: 0, errorCount: 0 })
  }

  const handleClose = () => {
    resetModalState()
    onClose()
  }

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setIsParsing(true)
    setParseError('')

    try {
      const parsed = await parseImportFile(selectedFile)
      setParsedData(parsed)

      const validation = validateImportRows(parsed.parsedRows, existingItems, groups)
      setValidationResult(validation)
      setStep(2)
    } catch (err) {
      console.error('Import parse error:', err)
      setParseError('Помилка зчитування файлу: ' + err.message)
    } finally {
      setIsParsing(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      alert('Немає коректних рядків для імпорту!')
      return
    }

    setStep(3)
    setIsProcessing(true)

    try {
      const result = await executeBatchImport({
        validRows: validationResult.validRows,
        strategy,
        existingItems,
        onProgress: (pState) => setProgressState(pState)
      })

      setIsProcessing(false)
      setTimeout(() => {
        if (typeof onImportComplete === 'function') {
          onImportComplete(result)
        }
      }, 1000)
    } catch (err) {
      alert('Помилка при батч-імпорті: ' + err.message)
      setIsProcessing(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '24px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: 'var(--text, #0f172a)' }}>
                Імпорт номенклатури V2.0 (Enterprise Batch Engine)
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                Крок {step} з 3: {step === 1 ? 'Завантаження файлу' : (step === 2 ? 'Валідація та вибір стратегії' : 'Пакетна обробка')}
              </span>
            </div>
          </div>
          <button type="button" onClick={handleClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* STEP 1: FILE UPLOAD */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              style={{
                border: '2px dashed var(--border-color, #cbd5e1)',
                borderRadius: '20px',
                padding: '40px 20px',
                background: 'var(--card-header-bg, #f8fafc)',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
              onClick={() => document.getElementById('nom-import-file-input').click()}
            >
              <FileSpreadsheet size={48} color="#ea580c" />
              <div>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: 'var(--text, #0f172a)' }}>
                  Перетягніть файл сюди або натисніть для вибору
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Підтримуються формати **Excel (.xlsx, .xls)** та **CSV (.csv)**
                </p>
              </div>
              <input
                id="nom-import-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={e => handleFileSelect(e.target.files[0])}
              />
            </div>

            {isParsing && (
              <div style={{ textAlign: 'center', padding: '15px', color: '#ea580c', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <RefreshCw size={20} className="animate-spin" /> Зчитування та авто-розпізнавання колонок...
              </div>
            )}

            {parseError && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '14px 18px', color: '#ef4444', fontWeight: 800, fontSize: '0.85rem' }}>
                ⚠️ {parseError}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: PREVIEW & VALIDATION & CONFLICT STRATEGY */}
        {step === 2 && validationResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Stats Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.2)', padding: '12px', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 900 }}>ВСЬОГО В ФАЙЛІ</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>{validationResult.totalCount}</div>
              </div>

              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', padding: '12px', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 900 }}>ГОТОВІ ДО ІМПОРТУ</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{validationResult.validCount}</div>
              </div>

              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 900 }}>ДУБЛІКАТИ В БАЗІ</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f59e0b' }}>{validationResult.duplicateCount}</div>
              </div>

              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 900 }}>ПОМИЛКИ (КРИТИЧНІ)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444' }}>{validationResult.invalidCount}</div>
              </div>
            </div>

            {/* Conflicts Strategy */}
            {validationResult.duplicateCount > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '16px', padding: '16px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#b45309', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={16} /> СТРАТЕГІЯ РОЗВ'ЯЗАННЯ КОНФЛІКТІВ ДУБЛІКАТІВ ({validationResult.duplicateCount})
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text, #0f172a)' }}>
                    <input type="radio" name="strategy" value="skip" checked={strategy === 'skip'} onChange={() => setStrategy('skip')} />
                    🟢 **Пропустити дублікати** (Зберегти існуючі позиції в БД без змін)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text, #0f172a)' }}>
                    <input type="radio" name="strategy" value="overwrite" checked={strategy === 'overwrite'} onChange={() => setStrategy('overwrite')} />
                    🟡 **Оновити існуючі** (Перезаписати назви та параметри записів у БД)
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text, #0f172a)' }}>
                    <input type="radio" name="strategy" value="new_code" checked={strategy === 'new_code'} onChange={() => setStrategy('new_code')} />
                    🔵 **Створити нові коди** (Згенерувати нові унікальні коди V2-XXXXX)
                  </label>
                </div>
              </div>
            )}

            {/* Validation Warnings / Errors Detail List */}
            {(validationResult.invalidRows.length > 0 || validationResult.warningRows.length > 0) && (
              <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'var(--card-header-bg, #f8fafc)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '14px', padding: '14px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#64748b', marginBottom: '8px' }}>ЗВІТ ВАЛІДАЦІЇ РЯДКІВ:</div>
                
                {validationResult.invalidRows.map(row => (
                  <div key={row.rowIndex} style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700, marginBottom: '4px' }}>
                    ❌ Рядок #{row.rowIndex} ({row.name || 'Без назви'}): {row.errors.join('; ')}
                  </div>
                ))}

                {validationResult.warningRows.map(row => (
                  <div key={row.rowIndex} style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600, marginBottom: '4px' }}>
                    ⚠️ Рядок #{row.rowIndex} ({row.name}): {row.warnings.join('; ')}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                onClick={resetModalState}
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', color: '#64748b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                ОБРАТИ ІНШИЙ ФАЙЛ
              </button>
              
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={validationResult.validCount === 0}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                <Database size={16} /> ЗАПУСТИТИ ІМПОРТ ({validationResult.validCount})
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PROGRESS & EXECUTION SUMMARY */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', padding: '20px 10px' }}>
            <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: 'var(--text, #0f172a)' }}>
              {isProcessing ? '⚡ ВИКОНУЄТЬСЯ ПАКЕТНИЙ ІМПОРТ...' : '🎉 ІМПОРТ УСПІШНО ЗАВЕРШЕНО!'}
            </h4>

            {/* Progress Bar */}
            <div style={{ width: '100%', background: 'var(--card-header-bg, #e2e8f0)', borderRadius: '12px', height: '18px', overflow: 'hidden', border: '1px solid var(--border-color, #cbd5e1)' }}>
              <div
                style={{
                  width: `${progressState.percentage}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981' }}>
              {progressState.percentage}% ({progressState.current} з {progressState.total})
            </div>

            {/* Final Counters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginTop: '10px' }}>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', padding: '14px', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 900 }}>ДОДАНО / ОНОВЛЕНО</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{progressState.successCount}</div>
              </div>

              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', padding: '14px', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 900 }}>ПРОПУЩЕНО (ДУБЛІ)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>{progressState.skippedCount}</div>
              </div>

              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', padding: '14px', borderRadius: '14px' }}>
                <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 900 }}>ПОМИЛКИ</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>{progressState.errorCount}</div>
              </div>
            </div>

            {!isProcessing && (
              <div style={{ marginTop: '15px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: '14px 32px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(234, 88, 12, 0.35)'
                  }}
                >
                  ЗАКРИТИ ТА ОНОВИТИ КАТАЛОГ
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
