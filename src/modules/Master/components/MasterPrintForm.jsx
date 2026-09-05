import React from 'react'
import { CheckCircle2 } from 'lucide-react'
import { getCustomerCode } from '../../../utils/customerCodeUtils.js'
import { getNomUnitsPerSheet } from '../../../utils/unitsHelper.js'

export function MasterPrintForm({
  activeNaryadOrder,
  getBatchSuffix,
  materialSummary,
  consumableSummary,
  getDisplayPartsForOrderItem,
  naryadQtys,
  isReprintMode,
  reprintTask,
  inventory,
  nomenclatures,
  rowMachines,
  rowMachinesSplits,
  customers = []
}) {
  if (!activeNaryadOrder) return null

  const dateStr = new Date().toLocaleDateString('uk-UA').replace(/\//g, '.')
  const batchSuffix = getBatchSuffix()

  return (
    <div className="print-target" style={{ display: 'none', background: '#fff', color: '#000', padding: '10mm 15mm', width: '100%' }}>
      {/* Printable header */}
      <div className="worksheet-header-area" style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '15px' }}>
        <h1 className="doc-ti" style={{ fontSize: '2rem', margin: 0, fontWeight: 900 }}>
          {activeNaryadOrder.isPrepOrder ? 'НАРЯД НА ПІДГОТОВКУ' : 'ТЕХНОЛОГІЧНА КАРТА РОЗКРОЮ'}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '5px' }}>
          <div>НОМЕР: <strong>№{activeNaryadOrder.order_num}{batchSuffix}</strong></div>
          <div>ДАТА: <strong>{dateStr}</strong></div>
        </div>
      </div>

      {/* Client / Order Info */}
      <div className="print-info-box" style={{ border: '2px solid #000', padding: '10px 15px', marginBottom: '15px', fontSize: '0.85rem' }}>
        <div>Замовник: <strong className="print-prod-info" style={{ fontSize: '1.2rem' }}>{getCustomerCode(activeNaryadOrder?.customer, customers, activeNaryadOrder)}</strong></div>
        {activeNaryadOrder.deadline && (
          <div style={{ marginTop: '5px' }}>Термін виконання: <strong>{new Date(activeNaryadOrder.deadline).toLocaleDateString('uk-UA')}</strong></div>
        )}
      </div>

      {/* Parts Table */}
      <div className="table-responsive-container" style={{ marginBottom: '20px' }}>
        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
          <thead>
            <tr className="print-thr" style={{ background: '#eee' }}>
              <th className="col-name" style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', fontSize: '0.7rem' }}>Назва деталі</th>
              <th className="col-plan" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '0.7rem' }}>План</th>
              <th className="col-material" style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', fontSize: '0.7rem' }}>Матеріал</th>
              <th className="col-sheets" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '0.7rem' }}>Листів</th>
              <th className="col-bz" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '0.7rem' }}>Верстат</th>
            </tr>
          </thead>
          <tbody>
            {activeNaryadOrder.order_items?.map(it => {
              const displayParts = getDisplayPartsForOrderItem(it)
              const currentQty = isReprintMode ? Number(it.quantity) : (naryadQtys[it.id] || 0)
              if (currentQty <= 0) return null

              return displayParts.map((part, pIdx) => {
                if (!part.nom) return null
                const snapshot = reprintTask?.plan_snapshot?.[String(part.nom.id)]
                const totalNeeded = snapshot ? snapshot.need : (currentQty * (Number(part.quantity_per_parent) || 1))
                const inStock = snapshot ? snapshot.stock : (() => {
                  const bzInv = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
                  return bzInv ? Math.max(0, (Number(bzInv.total_qty) || 0) - (Number(bzInv.reserved_qty) || 0)) : 0
                })()
                const totalToProduce = Math.max(0, totalNeeded - inStock)
                const unitsPerSheet = getNomUnitsPerSheet(part.nom, snapshot)
                const sheets = Math.ceil(totalToProduce / unitsPerSheet)
                const mName = rowMachines[part.nom.id] || '—'

                return (
                  <tr key={`${it.id}-${pIdx}`} className="print-tr">
                    <td className="col-name" style={{ border: '1px solid #000', padding: '6px', fontSize: '0.75rem' }}>{part.nom.name}</td>
                    <td className="col-plan" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 800 }}>{totalNeeded}</td>
                    <td className="col-material" style={{ border: '1px solid #000', padding: '6px' }}>{part.nom.material_type || '—'}</td>
                    <td className="col-sheets" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{sheets}</td>
                    <td className="col-bz" style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{mName}</td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>

      {/* Materials Summary */}
      <div className="mat-summary-section" style={{ border: '2px solid #000', padding: '12px', marginTop: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '4px' }}>ВИТРАТИ МАТЕРІАЛІВ</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {materialSummary.map((m, idx) => (
            <div key={idx} style={{ fontSize: '0.75rem' }}>
              • {m.name}: <strong>{m.sheets} {m.unit}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Consumables Summary */}
      {consumableSummary.length > 0 && (
        <div className="consumable-summary-section" style={{ border: '2px solid #000', padding: '12px', marginTop: '15px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '4px' }}>НЕОБХІДНИЙ ІНСТРУМЕНТ (РОЗРАХУНКОВО)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {consumableSummary.map((c, idx) => (
              <div key={idx} style={{ fontSize: '0.75rem' }}>
                • {c.name}: <strong>{c.total} шт.</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signatures */}
      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
        <div>Видав: ________________________ (Майстер)</div>
        <div>Отримав: ________________________ (Виконавець)</div>
      </div>
    </div>
  )
}
