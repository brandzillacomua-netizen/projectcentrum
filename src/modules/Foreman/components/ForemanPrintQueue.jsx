import React from 'react'
import { X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { getCustomerCode } from '../../../utils/customerCodeUtils.js'
import { getCardCuttingPlanSeconds, formatCuttingTime } from '../../../utils/cuttingTimeUtils.js'
import { parseQcOpsStamps, extractCuttersByDiameter } from '../../Shop1/utils/shop1Helpers.js'

const renderStampBadge = (stampInfo) => {
  if (!stampInfo?.stamp) return null
  return (
    <span
      title={stampInfo.inspector ? `${stampInfo.stamp} · ${stampInfo.inspector} (${stampInfo.at || ''})` : stampInfo.stamp}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1.5px double #047857',
        color: '#047857',
        background: 'rgba(16, 185, 129, 0.08)',
        borderRadius: '999px',
        padding: '1px 5px',
        fontSize: '5.5pt',
        fontWeight: 1000,
        letterSpacing: '0.03em',
        transform: 'rotate(-4deg)',
        lineHeight: 1.1,
        whiteSpace: 'nowrap'
      }}
    >
      {stampInfo.stamp}
    </span>
  )
}

const getLoadingSequence = (metadata) => {
  const loading = String(metadata?.loading || metadata?.card_info || '')
  const fraction = loading.match(/(?:^|\D)(\d+)\s*\/\s*(\d+)(?:\D|$)/)
  if (fraction) return Number(fraction[1])

  const leadingNumber = loading.match(/^\s*(\d+)/)
  return leadingNumber ? Number(leadingNumber[1]) : Number.MAX_SAFE_INTEGER
}

const getLoadingDeclaredTotal = (metadata) => {
  const loading = String(metadata?.loading || metadata?.card_info || '')
  const fraction = loading.match(/(?:^|\D)(\d+)\s*\/\s*(\d+)(?:\D|$)/)
  return fraction ? Number(fraction[2]) : 0
}

const getLoadingLabel = (metadata) => {
  const loading = String(metadata?.loading || metadata?.card_info || '')
  const sequence = getLoadingSequence(metadata)
  if (sequence && Number.isFinite(sequence) && sequence !== Number.MAX_SAFE_INTEGER) {
    return `№${sequence}`
  }
  const clean = loading.split(' [')[0].trim()
  const fractionMatch = clean.match(/(?:^|\D)(\d+)\s*\/\s*\d+/)
  if (fractionMatch) return `№${fractionMatch[1]}`
  return clean ? (clean.startsWith('№') ? clean : `№${clean}`) : '—'
}

export default function ForemanPrintQueue({
  printQueue,
  setPrintQueue,
  orders,
  allOrdersMap,
  nomenclatures,
  machines,
  machineOperations,
  getDisplayMaterial,
  formatDurationHMS,
  customers = []
}) {
  if (!printQueue) return null

  // Cards can arrive from Supabase in creation/update order. Printing must follow
  // the human sequence stored in card_info/loading: 1/99, 2/99, ... 99/99.
  const sortedMetadata = (printQueue.metadata || [])
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => getLoadingSequence(a.item) - getLoadingSequence(b.item) || a.originalIndex - b.originalIndex)
    .map(entry => entry.item)
  const printTotal = sortedMetadata.reduce((max, item) => {
    const sequence = getLoadingSequence(item)
    const declaredTotal = getLoadingDeclaredTotal(item)
    return Number.isFinite(sequence) && sequence !== Number.MAX_SAFE_INTEGER
      ? Math.max(max, sequence, declaredTotal)
      : Math.max(max, declaredTotal)
  }, sortedMetadata.length)

  return (
    <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#111', color: '#000', zIndex: 10000, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body, #root, .foreman-module {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .no-print,
          body > *:not(#root),
          nav, header, footer, .sidebar, .glass-nav, .back-btn-modern,
          .foreman-module > *:not(.print-overlay),
          .master-grid,
          .module-nav {
            display: none !important;
          }
          .print-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            display: block !important;
            width: 210mm !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            z-index: 999999 !important;
          }
          .a4-page {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            padding: 6mm 8mm !important;
            margin: 0 !important;
            margin-bottom: 0 !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .a4-page:last-child,
          .a4-page:last-of-type {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>
      <div className="no-print" style={{ position: 'sticky', top: 0, width: '100%', padding: '15px 30px', background: '#111', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', zIndex: 100 }}>
        <h3>Друк: {printQueue.part?.nom?.name}</h3>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>ДРУКУВАТИ</button>
          <button onClick={() => setPrintQueue(null)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
        </div>
      </div>

      {sortedMetadata.map((m, i) => {
        const order = orders.find(o => o.id === printQueue.task?.order_id) || allOrdersMap[printQueue.task?.order_id]
        const nomenclature = nomenclatures.find(n => n.id === (printQueue.part?.nomenclature_id || printQueue.part?.nom?.id))
        const sheets = m.sheetsPerLoading ?? Math.ceil(m.qty / (nomenclature?.units_per_sheet || 1))
        const planSec = getCardCuttingPlanSeconds(
          { ...m, operation: 'Розкрій', estimated_time: m.estimatedTime, sheetsPerLoading: sheets, quantity: m.qty },
          nomenclature
        )
        const currentDate = new Date().toLocaleDateString('uk-UA')
        const finishedProduct = order?.order_items?.[0] ? nomenclatures.find(n => n.id === order.order_items[0].nomenclature_id) : null
        const formatTime = (seconds) => {
          const h = Math.floor(seconds / 3600)
          const min = Math.floor((seconds % 3600) / 60)
          if (h > 0) return `${h}год ${min}хв`
          return `${min}хв`
        }

        // Dynamically resolve operations
        const mac = machines.find(mac => mac.name === m.machine)
        const opData = machineOperations?.find(o =>
          o.nomenclature_id === nomenclature?.id &&
          (o.machine_type === m.machine || (mac && o.machine_id === mac.id))
        )
        let s1Ops = (opData?.side1_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
        let s2Ops = (opData?.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
        let s2CutOps = (opData?.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))

        const snapshotPart = printQueue.task?.plan_snapshot?.[String(nomenclature?.id)]
        const isCutter1_5 = snapshotPart?.cutter_override === '1.5'

        if (isCutter1_5) {
          const replacer = (op) => {
            if (op.includes('|')) return op.split('|')[1].trim()
            return op.replace(/[фФ]2(?![0-9.])/g, match => match[0] === 'ф' ? 'ф1.5' : 'Ф1.5')
          }
          s1Ops = s1Ops.map(replacer)
          s2Ops = s2Ops.map(replacer)
        } else {
          const replacer = (op) => {
            if (op.includes('|')) return op.split('|')[0].trim()
            return op
          }
          s1Ops = s1Ops.map(replacer)
          s2Ops = s2Ops.map(replacer)
        }

        const s2CutOpsF2 = s2CutOps.map(op => {
          if (op.includes('|')) return op.split('|')[0].trim()
          return op.replace(/[фФ]1\.5(?![0-9.])/g, match => match[0] === 'ф' ? 'ф2' : 'Ф2')
        })
        const s2CutOpsF15 = s2CutOps.map(op => {
          if (op.includes('|')) return op.split('|')[1].trim()
          return op.replace(/[фФ]2(?![0-9.])/g, match => match[0] === 'ф' ? 'ф1.5' : 'Ф1.5')
        })

        const maxOps = Math.max(10, s1Ops.length, s2Ops.length, s2CutOpsF2.length, s2CutOpsF15.length)
        const qcOpsData = parseQcOpsStamps(m.loading || m.card_info)
        const cuttersData = extractCuttersByDiameter(m.loading || m.card_info)
        const utilQty = Number(
          m.utilQty ??
          m.util ??
          m.cat4 ??
          m.scrapInfo?.util ??
          (m.status === 'scrapped' ? m.qty : 0)
        ) || 0
        const displayScrapQty = utilQty > 0 ? utilQty : ''
        const findOpStamp = (prefix, idx, opText) => {
          if (!opText || !qcOpsData?.ops) return null
          if (qcOpsData.ops[`${prefix}:${idx}`]) return qcOpsData.ops[`${prefix}:${idx}`]
          return Object.values(qcOpsData.ops).find(v => v?.name && v.name.trim() === opText.trim()) || null
        }

        const opRows = Array.from({ length: maxOps }).map((_, idx) => ({
          s1: s1Ops[idx] || '',
          s1Stamp: findOpStamp('s1', idx, s1Ops[idx]),
          s2: s2Ops[idx] || '',
          s2Stamp: findOpStamp('s2', idx, s2Ops[idx]),
          s2cF2: s2CutOpsF2[idx] || '',
          s2cF15: s2CutOpsF15[idx] || '',
          s2cStamp: findOpStamp('s2c', idx, isCutter1_5 ? s2CutOpsF15[idx] : s2CutOpsF2[idx])
        }))

        return (
          <div key={m.id || i} className="a4-page" style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '10mm', margin: '0 auto 40px auto', pageBreakAfter: i === sortedMetadata.length - 1 ? 'avoid' : 'always', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', border: '1.5px solid #000' }}>
              {[1, 2].map(blockIdx => (
                <div key={blockIdx} style={{ borderBottom: '1.5px solid #000', marginBottom: blockIdx === 1 ? '20px' : '0' }}>
                  <div style={{ borderTop: blockIdx === 2 ? '1.5px solid #000' : 'none' }}>
                    <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center', background: '#fff' }}>
                      <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Замовник</div>
                      <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Номер замовлення</div>
                      <div style={{ width: '35%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Планова дата відвантаження</div>
                      <div style={{ width: '15%', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Дата</div>
                    </div>
                    <div style={{ display: 'flex', height: '24px', borderBottom: '1.5px solid #000', textAlign: 'center', alignItems: 'center' }}>
                      <div style={{ width: '25%', borderRight: '1px solid #000', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10pt', fontWeight: 950 }}>{getCustomerCode(order?.customer, customers, order)}</div>
                      <div style={{ width: '25%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 950 }}>{order?.order_num || '—'}</div>
                      <div style={{ width: '35%', borderRight: '1px solid #000', fontSize: '10pt', fontWeight: 950 }}>{order?.deadline ? new Date(order.deadline).toLocaleDateString('uk-UA') : '—'}</div>
                      <div style={{ width: '15%', fontSize: '11pt', fontWeight: 950 }}>{currentDate}</div>
                    </div>
                    <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center', background: '#fff' }}>
                      <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Назва проєкту</div>
                      <div style={{ width: '10%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>К-сть листів</div>
                      <div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Товщина, мм</div>
                      <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Тип станку</div>
                      <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>№ картки</div>
                      <div style={{ width: '18%', fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Системний номер</div>
                    </div>
                    <div style={{ display: 'flex', height: '26px', borderBottom: '1.5px solid #000', textAlign: 'center', alignItems: 'center' }}>
                      <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '9pt', fontWeight: 1000 }}>{finishedProduct?.name || '—'}</div>
                      <div style={{ width: '10%', borderRight: '1px solid #000', fontSize: '13pt', fontWeight: 1000 }}>
                        {Math.ceil(m.qty / (nomenclature?.units_per_sheet || 1))}
                      </div>
                      <div style={{ width: '12%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, lineHeight: 1.1 }}>{getDisplayMaterial(nomenclature, snapshotPart)}</div>
                      <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '7.5pt', fontWeight: 1000, padding: '0 2px' }}>{m.machine}</div>
                      <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 1000 }}>{getLoadingLabel(m, printTotal)}</div>
                      <div style={{ width: '18%', fontSize: '11pt', fontWeight: 1000 }}>#{m.id.slice(-8).toUpperCase()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', height: '125px' }}>
                    <div style={{ width: '75%', borderRight: '1.5px solid #000', display: 'flex' }}>
                      <div style={{ width: '68%', borderRight: '1.5px solid #000', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', height: '18px', borderBottom: '1px solid #000', textAlign: 'center' }}>
                          <div style={{ width: '50%', borderRight: '1px solid #000', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Основна номенклатура</div>
                          <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Планова к-сть, шт</div>
                          <div style={{ width: '20%', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ЧПУ №</div>
                        </div>
                        <div style={{ display: 'flex', height: '28px', borderBottom: '1px solid #000', textAlign: 'center', alignItems: 'center' }}>
                          <div style={{ width: '50%', borderRight: '1px solid #000', fontSize: '8pt', fontWeight: 1000, padding: '0 4px', lineHeight: 1.1 }}>{nomenclature?.name}</div>
                          <div style={{ width: '30%', borderRight: '1px solid #000', fontSize: '20pt', fontWeight: 1000 }}>{m.qty}</div>
                          <div style={{ width: '20%', fontSize: '11pt', fontWeight: 1000 }}></div>
                        </div>
                        <div style={{ display: 'flex', height: '30px', borderBottom: '1px solid #000' }}>
                          <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 900 }}>ПІБ працівника</span><div style={{ flex: 1 }}></div></div>
                          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 900 }}>ПІБ працівника</span><div style={{ flex: 1 }}></div></div>
                        </div>
                        <div style={{ display: 'flex', height: '49px' }}>
                          <div style={{ width: '50%', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 950 }}>Дата початку / Час початку</span><div style={{ flex: 1 }}></div></div>
                          <div style={{ width: '50%', display: 'flex', flexDirection: 'column', padding: '1px 2px' }}><span style={{ fontSize: '6pt', fontWeight: 950 }}>Дата завершення / Час завершення</span><div style={{ flex: 1 }}></div></div>
                        </div>
                      </div>
                      <div style={{ width: '32%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                        <QRCodeSVG value={`CENTRUM_CARD_${m.id}`} size={105} />
                      </div>
                    </div>
                    <div style={{ width: '25%', display: 'flex', flexDirection: 'column' }}>
                      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize: '6pt' }}>
                        <tbody>
                          {[1, 2, 3].map(idx => (
                            <tr key={idx} style={{ height: '28px', borderBottom: '1px solid #000' }}>
                              <td style={{ borderRight: '1px solid #000', width: '70%', background: '#fff' }}></td>
                              <td style={{ textAlign: 'center', width: '30%' }}>
                                <div style={{ fontSize: '5pt', fontWeight: 900, borderBottom: '1px solid #eee', textTransform: 'uppercase' }}>К-сть, шт</div>
                                <div style={{ fontSize: '9pt', fontWeight: 1000 }}>0</div>
                              </td>
                            </tr>
                          ))}
                          <tr style={{ flex: 1, background: '#fff' }}>
                            <td colSpan="2" style={{ padding: '2px', textAlign: 'center' }}>
                              <span style={{ fontSize: '6pt', fontWeight: 900, display: 'block', textTransform: 'uppercase', marginBottom: '1px' }}>План. час виконання</span>
                              <span style={{ fontSize: '11pt', fontWeight: 1000 }}>{formatCuttingTime(planSec)}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '28px', margin: '4px 0' }}>
                <div style={{ display: 'flex', border: '1.5px solid #000', height: '100%' }}>
                  <div style={{ padding: '0 15px', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', fontSize: '10pt', fontWeight: 900 }}>Листи відповідають</div>
                  <div style={{ padding: '0 15px', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', fontSize: '10pt', fontWeight: 900 }}>{getDisplayMaterial(nomenclature, snapshotPart) || nomenclature?.material_type || '—'}</div>
                  <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14pt', fontWeight: 900 }}>
                    {qcOpsData?.sheets?.verified ? (
                      <>
                        <span style={{ color: '#047857' }}>☑</span>
                        {renderStampBadge(qcOpsData.sheets)}
                      </>
                    ) : '☐'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '2px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '6.5pt' }}>
                  <thead>
                    <tr style={{ background: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
                      <td style={{ border: '1.5px solid #000', width: '22%', height: '36px' }}>Операція (1 сторона)</td>
                      <td style={{ border: '1.5px solid #000', width: '11%', fontSize: '5.5pt', lineHeight: 1.2 }}>
                        Статус<br />виконання ☑<br />
                        <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '2px 0', padding: '2px 0' }}>Лист | Лист</div>
                        1, 2 | 3, 4
                      </td>
                      <td style={{ border: '1.5px solid #000', width: '22%' }}>Операція (2 сторона)</td>
                      <td style={{ border: '1.5px solid #000', width: '11%', fontSize: '5.5pt', lineHeight: 1.2 }}>
                        Статус<br />виконання ☑<br />
                        <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '2px 0', padding: '2px 0' }}>Лист | Лист</div>
                        1, 2 | 3, 4
                      </td>
                      {!isCutter1_5 ? (
                        <td style={{ border: '1.5px solid #000', width: '26%', fontSize: '6.5pt', fontWeight: 'bold' }}>Операція (2 сторона вирізка)<br />Ф2мм</td>
                      ) : (
                        <td style={{ border: '1.5px solid #000', width: '26%', fontSize: '6.5pt', fontWeight: 'bold' }}>Операція (2 сторона вирізка)<br />Ф1.5мм</td>
                      )}
                      <td style={{ border: '1.5px solid #000', width: '8%', fontSize: '5.5pt', lineHeight: 1 }}>Статус<br />виконання<br />☑</td>
                    </tr>
                  </thead>
                  <tbody>
                    {opRows.map((row, idx) => (
                      <tr key={idx} style={{ height: '22px' }}>
                        <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s1}</td>
                        <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt', letterSpacing: row.s1Stamp ? '0' : '2px' }}>
                          {(() => {
                            if (!row.s1Stamp) return '☐ | ☐'
                            const s = row.s1Stamp
                            const has1_2 = Boolean(s.sheet1_2 || s.sheets?.['1-2'] || s.sheet === 'Лист 1, 2' || s.allSheets)
                            const has3_4 = Boolean(s.sheet3_4 || s.sheets?.['3-4'] || s.sheet === 'Лист 3, 4' || s.allSheets)
                            const check1_2 = has1_2 || (!s.sheet1_2 && !s.sheet3_4 && !s.sheet)
                            const check3_4 = has3_4 || (!s.sheet1_2 && !s.sheet3_4 && !s.sheet)
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                <span style={{ color: '#047857', fontWeight: 1000, fontSize: '9pt' }}>
                                  {check1_2 ? '☑' : '☐'} | {check3_4 ? '☑' : '☐'}
                                </span>
                                {renderStampBadge(s)}
                              </span>
                            )
                          })()}
                        </td>
                        <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2}</td>
                        <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt', letterSpacing: row.s2Stamp ? '0' : '2px' }}>
                          {(() => {
                            if (!row.s2Stamp) return '☐ | ☐'
                            const s = row.s2Stamp
                            const has1_2 = Boolean(s.sheet1_2 || s.sheets?.['1-2'] || s.sheet === 'Лист 1, 2' || s.allSheets)
                            const has3_4 = Boolean(s.sheet3_4 || s.sheets?.['3-4'] || s.sheet === 'Лист 3, 4' || s.allSheets)
                            const check1_2 = has1_2 || (!s.sheet1_2 && !s.sheet3_4 && !s.sheet)
                            const check3_4 = has3_4 || (!s.sheet1_2 && !s.sheet3_4 && !s.sheet)
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                <span style={{ color: '#047857', fontWeight: 1000, fontSize: '9pt' }}>
                                  {check1_2 ? '☑' : '☐'} | {check3_4 ? '☑' : '☐'}
                                </span>
                                {renderStampBadge(s)}
                              </span>
                            )
                          })()}
                        </td>
                        {!isCutter1_5 ? (
                          <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2cF2}</td>
                        ) : (
                          <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2cF15}</td>
                        )}
                        <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt' }}>
                          {row.s2cStamp ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                              <span style={{ color: '#047857', fontWeight: 1000, fontSize: '10pt' }}>☑</span>
                              {renderStampBadge(row.s2cStamp)}
                            </span>
                          ) : '☐'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ border: '1.5px solid #000', borderTop: 'none', display: 'flex', height: '35px' }}>
                <div style={{ width: '130px', borderRight: '1.5px solid #000', background: '#fff', fontWeight: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8pt' }}>Коментар</div>
                <div style={{ flex: 1 }}></div>
              </div>
              <div style={{ border: '1.5px solid #000', marginTop: '4px', display: 'flex', flexDirection: 'column', fontSize: '7.5pt' }}>
                <div style={{ display: 'flex', borderBottom: '1.5px solid #000', background: '#f5f5f5', fontWeight: 900, textAlign: 'center' }}>
                  <div style={{ width: '70%', padding: '4px', borderRight: '1.5px solid #000' }}>Кількість використаних фрез</div>
                  <div style={{ width: '30%', padding: '4px' }}>Загалом використано фрез</div>
                </div>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '70%', borderRight: '1.5px solid #000', display: 'flex' }}>
                    <div style={{ width: '50%', borderRight: '1.5px solid #000', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '24px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>1,5мм</div>
                        <div style={{ width: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 1000, fontSize: '9pt', color: '#000' }}>
                          {cuttersData['1,5мм'] || ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '24px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>2мм</div>
                        <div style={{ width: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 1000, fontSize: '9pt', color: '#000' }}>
                          {cuttersData['2мм'] || ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', height: '24px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>3мм</div>
                        <div style={{ width: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 1000, fontSize: '9pt', color: '#000' }}>
                          {cuttersData['3мм'] || ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '36px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>4мм</div>
                        <div style={{ width: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 1000, fontSize: '9pt', color: '#000' }}>
                          {cuttersData['4мм'] || ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', height: '36px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>6мм</div>
                        <div style={{ width: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 1000, fontSize: '9pt', color: '#000' }}>
                          {cuttersData['6мм'] || ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '30%', display: 'flex', flexDirection: 'column', fontWeight: 900, padding: '4px 8px', justifyContent: 'space-between' }}>
                    <div>1,5мм - {cuttersData['1,5мм'] ? <strong style={{ fontSize: '9pt', fontWeight: 1000 }}>{cuttersData['1,5мм']}</strong> : ''}</div>
                    <div>2мм - {cuttersData['2мм'] ? <strong style={{ fontSize: '9pt', fontWeight: 1000 }}>{cuttersData['2мм']}</strong> : ''}</div>
                    <div>3мм - {cuttersData['3мм'] ? <strong style={{ fontSize: '9pt', fontWeight: 1000 }}>{cuttersData['3мм']}</strong> : ''}</div>
                    <div>4мм - {cuttersData['4мм'] ? <strong style={{ fontSize: '9pt', fontWeight: 1000 }}>{cuttersData['4мм']}</strong> : ''}</div>
                    <div>6мм - {cuttersData['6мм'] ? <strong style={{ fontSize: '9pt', fontWeight: 1000 }}>{cuttersData['6мм']}</strong> : ''}</div>
                  </div>
                </div>
                <div style={{ marginTop: '2px', border: '1.5px solid #000', display: 'flex', fontSize: '7.5pt', height: '60px' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '110px', padding: '2px', fontWeight: 1000, textAlign: 'center' }}>Причина браку:</div>
                    <div style={{ flex: 1, padding: '2px', fontSize: '5.5pt', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px' }}>
                      <div>☐ Биття цанги</div>
                      <div>☐ Помилка програми</div>
                      <div>☐ Збій станка</div>
                      <div>☐ Кривизна листа</div>
                      <div>☐ Поломка флешки</div>
                      <div>☐ Прив'язка</div>
                      <div>☐ Помилка оператора</div>
                      <div>☐ Інше (коментар)</div>
                    </div>
                  </div>
                  <div style={{ width: '120px', borderLeft: '1.5px solid #000', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ borderBottom: '1px solid #000', padding: '2px', fontWeight: 1000 }}>Кількість браку</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15pt', fontWeight: 1000, color: utilQty > 0 ? '#b91c1c' : '#000' }}>
                      {displayScrapQty}
                    </div>
                  </div>
                  <div style={{ width: '140px', borderLeft: '1.5px solid #000', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ borderBottom: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 1000, fontSize: '6pt' }}>Корекція перегортання</div>
                    <div style={{ flex: 1, display: 'flex' }}>
                      <div style={{ flex: 1, borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '7pt', fontWeight: 900 }}>X</span>
                        <div style={{ flex: 1 }}></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '7pt', fontWeight: 900 }}>Y</span>
                        <div style={{ flex: 1 }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
