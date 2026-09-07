import React, { useState } from 'react'
import { Download, X, FileSpreadsheet, FileText, CheckCircle } from 'lucide-react'
import { exportNomenclatureToXLSX, exportNomenclatureToCSV } from '../io/exportService'

export const NomenclatureExportModal = ({
  isOpen,
  onClose,
  allItems = [],
  visibleItems = [],
  selectedGroup = null,
  groups = [],
  searchQuery = ''
}) => {
  const [format, setFormat] = useState('xlsx') // 'xlsx' | 'csv'
  const [scope, setScope] = useState('all') // 'all' | 'filtered'
  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  const targetItems = scope === 'filtered' ? visibleItems : allItems

  const handleExportSubmit = async (e) => {
    e.preventDefault()
    if (targetItems.length === 0) {
      alert('Немає позицій для експорту!')
      return
    }

    setIsExporting(true)
    try {
      const timestamp = new Date().toISOString().slice(0, 10)
      const groupSlug = selectedGroup ? `_${selectedGroup.name.replace(/\s+/g, '_')}` : ''
      const filename = `nomenclatures_v2${groupSlug}_${timestamp}.${format}`

      if (format === 'xlsx') {
        await exportNomenclatureToXLSX({ items: targetItems, groups, filename })
      } else {
        exportNomenclatureToCSV({ items: targetItems, groups, filename })
      }
      onClose()
    } catch (err) {
      alert('Помилка при експорті: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '24px', width: '100%', maxWidth: '520px', padding: '28px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(234,88,12,0.1)', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={20} />
            </div>
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem', color: 'var(--text, #0f172a)' }}>
              Експорт номенклатури v2.0
            </h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleExportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Scope Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
              ОБСЯГ ДАНИХ ДЛЯ ЕКСПОРТУ
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div 
                onClick={() => setScope('all')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: scope === 'all' ? '2px solid #ea580c' : '1px solid var(--border-color, #e2e8f0)',
                  background: scope === 'all' ? 'rgba(234,88,12,0.05)' : 'var(--card-header-bg, #f8fafc)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text, #0f172a)' }}>🌐 Повний каталог номенклатури</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Всі {allItems.length} позицій системи</div>
                </div>
                {scope === 'all' && <CheckCircle size={18} color="#ea580c" />}
              </div>

              <div 
                onClick={() => setScope('filtered')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: scope === 'filtered' ? '2px solid #ea580c' : '1px solid var(--border-color, #e2e8f0)',
                  background: scope === 'filtered' ? 'rgba(234,88,12,0.05)' : 'var(--card-header-bg, #f8fafc)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text, #0f172a)' }}>
                    🎯 Відфільтровані позиції ({visibleItems.length})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {selectedGroup ? `Категорія: «${selectedGroup.name}»` : (searchQuery ? `Пошук: «${searchQuery}»` : 'Поточна вибірка')}
                  </div>
                </div>
                {scope === 'filtered' && <CheckCircle size={18} color="#ea580c" />}
              </div>
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
              ФОРМАТ ФАЙЛУ
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div
                onClick={() => setFormat('xlsx')}
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  border: format === 'xlsx' ? '2px solid #10b981' : '1px solid var(--border-color, #e2e8f0)',
                  background: format === 'xlsx' ? 'rgba(16,185,129,0.06)' : 'var(--card-header-bg, #f8fafc)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <FileSpreadsheet size={24} color={format === 'xlsx' ? '#10b981' : '#64748b'} />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text, #0f172a)' }}>Excel (.xlsx)</span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>З форматуванням та стилями</span>
              </div>

              <div
                onClick={() => setFormat('csv')}
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  border: format === 'csv' ? '2px solid #3b82f6' : '1px solid var(--border-color, #e2e8f0)',
                  background: format === 'csv' ? 'rgba(59,130,246,0.06)' : 'var(--card-header-bg, #f8fafc)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  alignItems: 'center',
                  textAlign: 'center'
                }}
              >
                <FileText size={24} color={format === 'csv' ? '#3b82f6' : '#64748b'} />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text, #0f172a)' }}>CSV (.csv)</span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Стандартний текстовий CSV</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'transparent',
                color: '#64748b',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              СКАСУВАТИ
            </button>
            <button
              type="submit"
              disabled={isExporting}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)'
              }}
            >
              <Download size={16} />
              {isExporting ? 'ГЕНЕРАЦІЯ...' : `ЗАВАНТАЖИТИ (${targetItems.length})`}
            </button>
          </div>

        </form>

      </div>
    </div>
  )
}
