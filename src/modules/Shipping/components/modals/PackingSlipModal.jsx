import React, { useRef } from 'react'
import { FileText, Printer, X } from 'lucide-react'
import { formatPackingSlipName } from '../../utils/shippingHelpers'

const PackingSlipModal = ({ packingSlip, onClose }) => {
  const printRef = useRef(null)

  if (!packingSlip) return null

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML
    if (!printContent) return
    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Пакувальний лист</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            color: #111827;
            background: #fff;
            padding: 24px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th { background: #f3f4f6; color: #111827; padding: 8px 12px; text-align: left; font-weight: 700; border: 1px solid #e5e7eb; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 7px 12px; border: 1px solid #e5e7eb; font-size: 10px; }
          @media print {
            body {
              padding: 0;
              zoom: 75%; /* Proportional scaling down to guarantee clean fitting */
            }
            .category-block {
              padding: 8px !important;
              margin-bottom: 8px !important;
            }
            .category-grid {
              gap: 6px !important;
            }
            .category-item-card {
              padding: 6px 10px !important;
            }
            .signatures-row {
              margin-top: 20px !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            table {
              margin-bottom: 12px !important;
            }
            th {
              padding: 5px 8px !important;
              font-size: 9px !important;
            }
            td {
              padding: 5px 8px !important;
              font-size: 9px !important;
            }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.addEventListener('load', () => {
            const images = document.getElementsByTagName('img');
            let loaded = 0;
            if (images.length === 0) {
              window.print();
              window.close();
            } else {
              Array.from(images).forEach(img => {
                if (img.complete) {
                  loaded++;
                  if (loaded === images.length) {
                    setTimeout(() => { window.print(); window.close(); }, 500);
                  }
                } else {
                  img.addEventListener('load', () => {
                    loaded++;
                    if (loaded === images.length) {
                      setTimeout(() => { window.print(); window.close(); }, 500);
                    }
                  });
                  img.addEventListener('error', () => {
                    loaded++;
                    if (loaded === images.length) {
                      setTimeout(() => { window.print(); window.close(); }, 500);
                    }
                  });
                }
              });
            }
          });
        </script>
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 50px 120px rgba(0,0,0,0.9)' }}>

        {/* Toolbar */}
        <div style={{ padding: '16px 24px', background: '#1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={20} color="#ff9000" />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>ПАКУВАЛЬНИЙ ЛИСТ</span>
            <span style={{ color: '#555', fontSize: '0.75rem' }}>#{packingSlip.orderNum} / Партія {packingSlip.batchIndex}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ff9000', border: 'none', borderRadius: '10px', color: '#000', fontWeight: 800, fontSize: '0.8rem', padding: '10px 18px', cursor: 'pointer' }}>
              <Printer size={16} /> ДРУКУВАТИ
            </button>
            <button onClick={onClose} style={{ background: '#222', border: 'none', borderRadius: '10px', color: '#888', padding: '10px', cursor: 'pointer', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Print Content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div ref={printRef} style={{ padding: '40px', color: '#111827', fontFamily: "'Inter', sans-serif" }}>

            {/* ─── Шапка ──────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px', color: '#111827' }}>
                  Пакувальний лист {packingSlip.slipNumber ? `№ ${packingSlip.slipNumber}` : ''}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#ff9000', marginTop: '4px' }}>
                  Замовлення №{packingSlip.orderNum} / Партія {packingSlip.batchIndex}
                </div>
              </div>
              {/* Logo or Company details */}
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <img src="https://i.postimg.cc/d3NQkT4G/logo-3.jpg" alt="Ultra Contact" style={{ height: '36px', width: 'auto', marginBottom: '4px', display: 'block' }} />
                <div style={{ fontSize: '10px', color: '#6b7280' }}>ТОВ "УЛЬТРАКОНТАКТ"</div>
              </div>
            </div>

            {/* ─── Деталі відвантаження (Таблиця замість сітки) ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151', width: '40%' }}>Замовник</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{packingSlip.customer}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151' }}>Тип відвантаження</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{packingSlip.shippingType}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151' }}>Дата відвантаження</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600 }}>
                      {packingSlip.shippingDate ? new Date(packingSlip.shippingDate).toLocaleDateString('uk-UA') : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151', width: '40%' }}>Номер ТТН</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 700, fontSize: '13px' }}>{packingSlip.ttn || '—'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151' }}>Відвантажив</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{packingSlip.workerName || '—'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', background: '#f9fafb', fontWeight: 700, color: '#374151' }}>Дата формування</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 500, color: '#4b5563' }}>
                      {new Date(packingSlip.generatedAt).toLocaleString('uk-UA')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ─── Синє / Колір палети (Готовий виріб) ─────────── */}
            <div style={{
              background: packingSlip.batchColorHex || '#3b82f6',
              color: ['#f1f5f9', '#fdf0d5', '#eab308'].includes(packingSlip.batchColorHex?.toLowerCase()) ? '#111827' : '#ffffff',
              padding: '16px 20px',
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              border: '1px solid rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, display: 'block', fontWeight: 700 }}>Маркування палет</span>
                  <span style={{ fontSize: '15px', fontWeight: 900 }}>
                    {(() => {
                      const rawColor = packingSlip.batchColor?.toLowerCase() || ''
                      const colorMapping = {
                        red: 'Червоний',
                        orange: 'Помаранчевий',
                        yellow: 'Жовтий',
                        green: 'Зелений',
                        blue: 'Синій',
                        purple: 'Фіолетовий',
                        pink: 'Рожевий',
                        white: 'Білий'
                      }
                      return (colorMapping[rawColor] || packingSlip.batchColor || '').toUpperCase()
                    })()}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, display: 'block', fontWeight: 700 }}>Готовий виріб</span>
                  <span style={{ fontSize: '15px', fontWeight: 900 }}>{packingSlip.productNames} — {packingSlip.plannedSets} компл.</span>
                </div>
              </div>
            </div>

            {/* ─── Вміст коробок (Розподіл) ───────────────────── */}
            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#111827', marginBottom: '10px', letterSpacing: '0.5px' }}>
              Розподіл по коробках
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
              <thead>
                <tr>
                  <th style={{ width: '120px', textAlign: 'center' }}>№ коробки</th>
                  <th>Номенклатура</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Одн.Вим.</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>К-сть</th>
                </tr>
              </thead>
              <tbody>
                {packingSlip.boxes?.flatMap((box, boxIdx) =>
                  box.items.map((item, itemIdx) => {
                    const isEvenBox = boxIdx % 2 === 0
                    const isFirstItem = itemIdx === 0
                    return (
                      <tr key={`${boxIdx}-${itemIdx}`} style={{ background: isEvenBox ? '#ffffff' : '#f9fafb' }}>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#111827', fontSize: '12px', border: '1px solid #e5e7eb' }}>
                          {isFirstItem ? `Коробка ${box.box_number}` : ''}
                        </td>
                        <td style={{ color: '#374151', fontWeight: 500, border: '1px solid #e5e7eb' }}>
                          {formatPackingSlipName(item.nom_name, item.material_type, packingSlip.productNames)}
                        </td>
                        <td style={{ textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                          {item.unit}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#111827', fontSize: '12px', border: '1px solid #e5e7eb' }}>
                          {item.qty}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>

            {/* ─── Повний перелік пакування (checklist) ────────── */}
            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#111827', marginBottom: '12px', letterSpacing: '0.5px', pageBreakBefore: 'always', breakBefore: 'page' }}>
              Повний перелік пакування (За категоріями)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
              {Object.entries({
                sgp: { title: '1. ДЕТАЛІ / ГОТОВІ ВИРОБИ (СГП)', color: '#f43f5e', border: '#fda4af', bg: 'rgba(244,63,94,0.03)' },
                mounts: { title: '2. КРІПЛЕННЯ / 3Д ДРУК', color: '#eab308', border: '#fde047', bg: 'rgba(234,179,8,0.03)' },
                hardware: { title: '3. МЕТИЗИ (Гвинти/Гайки)', color: '#06b6d4', border: '#67e8f9', bg: 'rgba(6,182,212,0.03)' },
                spacers: { title: '4. СТІЙКИ', color: '#8b5cf6', border: '#c084fc', bg: 'rgba(139,92,246,0.03)' },
                other: { title: '5. НАКЛАДКИ / ТРИМАЧІ / УПАКОВКА', color: '#3b82f6', border: '#93c5fd', bg: 'rgba(59,130,246,0.03)' }
              }).map(([key, cat]) => {
                const catItems = (packingSlip.aggregatedList || []).filter(item => item.categoryKey === key)
                if (catItems.length === 0) return null

                return (
                  <div key={key} className="category-block" style={{ border: `1px solid ${cat.border}`, borderRadius: '10px', background: cat.bg, padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cat.color }} />
                      {cat.title}
                    </div>
                    <div className="category-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {catItems.map((item, idx) => (
                        <div key={idx} className="category-item-card" style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <span style={{ fontWeight: 600, color: '#374151', fontSize: '11px' }}>{formatPackingSlipName(item.nom_name, item.material_type, packingSlip.productNames)}</span>
                            <span style={{ fontWeight: 800, color: '#111827', fontSize: '12px', whiteSpace: 'nowrap' }}>{item.qty} {item.unit}</span>
                          </div>
                          <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600, marginTop: '6px' }}>
                            Коробки: {item.boxes.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ─── Підписи ────────────────────────────────────── */}
            <div className="signatures-row" style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #111827', width: '200px', paddingTop: '6px', fontSize: '10px', fontWeight: 700, color: '#4b5563' }}>Підготував</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #111827', width: '250px', paddingTop: '6px', fontSize: '10px', fontWeight: 700, color: '#111827' }}>
                  Відвантажувальник: {packingSlip.workerName}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #111827', width: '200px', paddingTop: '6px', fontSize: '10px', fontWeight: 700, color: '#4b5563' }}>Отримав</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(PackingSlipModal)
