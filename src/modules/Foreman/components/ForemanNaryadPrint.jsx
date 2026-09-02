import React from 'react'
import { X } from 'lucide-react'
import { getCustomerCode } from '../../../utils/customerCodeUtils.js'

export function ForemanNaryadPrint({
  printNaryadQueue,
  setPrintNaryadQueue,
  nomenclatures,
  getBOMParts,
  inventory,
  getRequestQty
}) {
  if (!printNaryadQueue) return null

  const { task, order, materialRequests } = printNaryadQueue

  let productNames = order?.order_items?.map(it => nomenclatures.find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ')
  if (!productNames && task.plan_snapshot) {
    productNames = Object.values(task.plan_snapshot)
      .map(s => nomenclatures.find(n => String(n.id) === String(s.id))?.name || s.name)
      .filter(Boolean)
      .join(', ')
  }

  const isReworkOrder = order?.order_num?.startsWith('ВБ')

  const tableRows = []
  let totalNeed = 0
  let totalPlan = 0
  let totalSheets = 0

  const snapshot = task.plan_snapshot
  const hasSnapshot = snapshot && Object.keys(snapshot).filter(k => !k.startsWith('_') && !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'].includes(k)).length > 0

  if (hasSnapshot) {
    const keys = Object.keys(snapshot).filter(k => !k.startsWith('_') && !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures'].includes(k))
    keys.forEach(nomId => {
      const snapEntry = snapshot[nomId]
      if (!snapEntry) return

      const need = Number(snapEntry.need) || 0
      const plan = Number(snapEntry.plan) || 0
      const sheets = Number(snapEntry.sheets) || 0
      const stockBZ = Number(snapEntry.stock) || 0
      const unitsPerSheet = Number(snapEntry.units_per_sheet) || 1
      const name = snapEntry.name || nomenclatures.find(n => String(n.id) === String(nomId))?.name || '—'
      const code = snapEntry.code || nomenclatures.find(n => String(n.id) === String(nomId))?.nomenclature_code || 'БЕЗ КОДУ'
      const material = snapEntry.material || nomenclatures.find(n => String(n.id) === String(nomId))?.material_type || '—'

      totalNeed += need
      totalPlan += plan
      totalSheets += sheets

      tableRows.push({
        name,
        code,
        need,
        stockBZ,
        plan,
        material,
        unitsPerSheet,
        sheets
      })
    })
  } else {
    order?.order_items?.forEach(item => {
      const parts = getBOMParts(item.nomenclature_id)
      const initialRows = parts.length > 0 ? parts : [{ nom: nomenclatures.find(n => n.id === item.nomenclature_id), quantity_per_parent: 1 }]
      const rows = initialRows.filter(r => r.nom?.type === 'part')

      rows.forEach((part) => {
        const nomId = part.nom?.id
        const need = (Number(item.quantity) || 0) * (Number(part.quantity_per_parent) || 1)
        const bzInv = (inventory || []).find(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz' && (!i.pocket_owner || i.pocket_owner === 'Не вказано'))
        const stockBZ = bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
        const plan = Math.max(0, need - stockBZ)
        const unitsPerSheet = Number(part.nom?.units_per_sheet) || 1
        const sheets = Math.ceil(plan / unitsPerSheet)

        totalNeed += need
        totalPlan += plan
        totalSheets += sheets

        tableRows.push({
          name: part.nom?.name || '—',
          code: part.nom?.nomenclature_code || 'БЕЗ КОДУ',
          need,
          stockBZ,
          plan,
          material: part.nom?.material_type || '—',
          unitsPerSheet,
          sheets
        })
      })
    })
  }

  // Materials summary
  const materialsSummary = {}
  const snapshotMaterials = task?.plan_snapshot?.materialSummary
  if (snapshotMaterials && Object.keys(snapshotMaterials).length > 0) {
    Object.values(snapshotMaterials).forEach(mat => {
      const name = mat.matName || mat.name || ''
      const qty = Number(mat.sheets) || 0
      if (name && qty > 0) {
        materialsSummary[name] = (materialsSummary[name] || 0) + qty
      }
    })
  } else {
    tableRows.forEach(row => {
      if (row.material && row.material !== '—' && row.sheets > 0) {
        materialsSummary[row.material] = (materialsSummary[row.material] || 0) + row.sheets
      }
    })
  }

  // Consumables summary
  const cuttersSummary = {}
  materialRequests.forEach(r => {
    let displayName = r.nomenclature?.name || ''
    if (!displayName && r.details) {
      const match = r.details.match(/:\s*(Фреза[^-—]+)(?:[-—]|$)/i)
      displayName = match ? match[1].trim() : r.details
    }
    if (displayName.toLowerCase().includes('фреза')) {
      cuttersSummary[displayName] = (cuttersSummary[displayName] || 0) + getRequestQty(r)
    }
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#111', color: '#000', zIndex: 10000, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
      <div className="no-print" style={{ position: 'sticky', top: 0, width: '100%', padding: '15px 30px', background: '#111', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', zIndex: 100 }}>
        <h3>Друк наряду: №{order?.order_num}</h3>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>ДРУКУВАТИ</button>
          <button onClick={() => setPrintNaryadQueue(null)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
        </div>
      </div>

      <div className="a4-page" style={{ width: '210mm', minHeight: '297mm', background: '#fff', padding: '20mm', margin: '0 auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontSize: '24pt', fontWeight: 950, margin: '0 0 20px 0', textTransform: 'uppercase', color: '#000', letterSpacing: '-0.5px' }}>
          НАРЯД №{order?.order_num}{task.batch_index ? `/${task.batch_index}` : ''}
        </h1>

        {/* Box Info */}
        <div style={{ border: '1.5px solid #000', borderRadius: '16px', padding: '18px', marginBottom: '30px' }}>
          <div style={{ fontSize: '12pt', fontWeight: 1000, borderBottom: '1.5px solid #000', paddingBottom: '10px', marginBottom: '12px', textTransform: 'uppercase' }}>
            ВИРІБ: <span style={{ textDecoration: 'underline' }}>{productNames || '—'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            <div>
              <div style={{ fontSize: '6.5pt', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>Замовник</div>
              <div style={{ fontSize: '10pt', fontWeight: 950 }}>{getCustomerCode(order?.customer, nomenclatures, order)}</div>
            </div>
            <div>
              <div style={{ fontSize: '6.5pt', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>Дата формування</div>
              <div style={{ fontSize: '10pt', fontWeight: 950 }}>{formatDate(task.created_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: '6.5pt', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>Дедлайн на цю партію</div>
              <div style={{ fontSize: '10pt', fontWeight: 950 }}>{formatDate(order?.deadline)}</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '9pt' }}>
          <thead>
            <tr style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', textAlign: 'left', fontWeight: 900, textTransform: 'uppercase', fontSize: '7pt' }}>
              <th style={{ padding: '8px 10px', borderRight: '1px solid #000', width: '40%' }}>Деталь в розкрій</th>
              <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '10%' }}>Потреба</th>
              {!isReworkOrder && (
                <>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '10%' }}>Склад БЗ</th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '10%' }}>План</th>
                </>
              )}
              <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '18%' }}>Матеріал</th>
              <th style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', width: '6%' }}>Шт/л</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: '10%' }}>Листів</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #000' }}>
                <td style={{ padding: '8px 10px', borderRight: '1px solid #000' }}>
                  <div style={{ fontWeight: 900 }}>{row.name}</div>
                  <div style={{ fontSize: '7pt', color: '#666' }}>{row.code}</div>
                </td>
                <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 800 }}>{row.need}</td>
                {!isReworkOrder && (
                  <>
                    <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', color: '#555' }}>{row.stockBZ}</td>
                    <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 850 }}>{row.plan}</td>
                  </>
                )}
                <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center', fontSize: '8pt' }}>{row.material}</td>
                <td style={{ padding: '8px 10px', borderRight: '1px solid #000', textAlign: 'center' }}>{row.unitsPerSheet}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 1000, fontSize: '10pt' }}>{row.sheets}</td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', fontWeight: 950, textTransform: 'uppercase', background: '#fcfcfc' }}>
              <td style={{ padding: '10px', borderRight: '1px solid #000' }}>Загальний підсумок:</td>
              <td style={{ padding: '10px', borderRight: '1px solid #000', textAlign: 'center' }}>{totalNeed}</td>
              {!isReworkOrder && (
                <>
                  <td style={{ padding: '10px', borderRight: '1px solid #000' }}></td>
                  <td style={{ padding: '10px', borderRight: '1px solid #000', textAlign: 'center' }}>{totalPlan}</td>
                </>
              )}
              <td style={{ padding: '10px', borderRight: '1px solid #000' }}></td>
              <td style={{ padding: '10px', borderRight: '1px solid #000' }}></td>
              <td style={{ padding: '10px', textAlign: 'center', fontSize: '11pt' }}>{totalSheets}</td>
            </tr>
          </tbody>
        </table>

        {/* Bottom blocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Materials Summary */}
          <div style={{ border: '1.5px solid #000', borderRadius: '16px', padding: '15px' }}>
            <div style={{ fontSize: '7.5pt', fontWeight: 900, textTransform: 'uppercase', color: '#555', marginBottom: '12px', letterSpacing: '0.5px' }}>
              Відомість матеріалів:
            </div>
            {Object.keys(materialsSummary).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                {Object.entries(materialsSummary).map(([mat, qty]) => (
                  <div key={mat} style={{ borderLeft: '3.5px solid #000', paddingLeft: '10px', minWidth: '160px' }}>
                    <div style={{ fontSize: '8pt', color: '#555', fontWeight: 600 }}>{mat}</div>
                    <div style={{ fontSize: '13pt', fontWeight: 1000, marginTop: '2px' }}>{qty} листів</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '9pt', color: '#888' }}>Немає запланованих матеріалів</div>
            )}
          </div>

          {/* Consumables Summary */}
          <div style={{ border: '1.5px solid #000', borderRadius: '16px', padding: '15px' }}>
            <div style={{ fontSize: '7.5pt', fontWeight: 900, textTransform: 'uppercase', color: '#555', marginBottom: '12px', letterSpacing: '0.5px' }}>
              Витратні матеріали:
            </div>
            {Object.keys(cuttersSummary).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                {Object.entries(cuttersSummary).map(([name, qty]) => (
                  <div key={name} style={{ borderLeft: '3.5px solid #000', paddingLeft: '10px', minWidth: '160px' }}>
                    <div style={{ fontSize: '8pt', color: '#555', fontWeight: 600 }}>{name}</div>
                    <div style={{ fontSize: '13pt', fontWeight: 1000, marginTop: '2px' }}>{qty} од.</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ borderLeft: '3.5px solid #000', paddingLeft: '10px', minWidth: '160px' }}>
                  <div style={{ fontSize: '8pt', color: '#555', fontWeight: 600 }}>Фреза</div>
                  <div style={{ fontSize: '13pt', fontWeight: 1000, marginTop: '2px' }}>— од.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
