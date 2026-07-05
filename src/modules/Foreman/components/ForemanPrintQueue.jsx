import React from 'react'
import { X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export default function ForemanPrintQueue({
  printQueue,
  setPrintQueue,
  orders,
  allOrdersMap,
  nomenclatures,
  machines,
  machineOperations,
  getDisplayMaterial,
  formatDurationHMS // if defined
}) {
  if (!printQueue) return null

  return (
    <div className="print-overlay" style={{ position: 'fixed', inset: 0, background: '#111', color: '#000', zIndex: 10000, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
      <div className="no-print" style={{ position: 'sticky', top: 0, width: '100%', padding: '15px 30px', background: '#111', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', zIndex: 100 }}>
        <h3>Друк: {printQueue.part?.nom?.name}</h3>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => window.print()} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>ДРУКУВАТИ</button>
          <button onClick={() => setPrintQueue(null)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
        </div>
      </div>

      {printQueue.metadata.map((m, i) => {
        const order = orders.find(o => o.id === printQueue.task?.order_id) || allOrdersMap[printQueue.task?.order_id]
        const nomenclature = nomenclatures.find(n => n.id === (printQueue.part?.nomenclature_id || printQueue.part?.nom?.id))
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
        const opRows = Array.from({ length: maxOps }).map((_, idx) => ({
          s1: s1Ops[idx] || '',
          s2: s2Ops[idx] || '',
          s2cF2: s2CutOpsF2[idx] || '',
          s2cF15: s2CutOpsF15[idx] || ''
        }))

        return (
          <div key={i} className="a4-page" style={{ width: '210mm', height: '297mm', background: '#fff', padding: '10mm', margin: '0 auto 40px auto', pageBreakAfter: i === printQueue.metadata.length - 1 ? 'avoid' : 'always', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
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
                      <div style={{ width: '25%', borderRight: '1px solid #000', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10pt', fontWeight: 950 }}>{order?.customer || '—'}</div>
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
                      <div style={{ width: '15%', borderRight: '1px solid #000', fontSize: '11pt', fontWeight: 1000 }}>{m.loading?.split(' [')[0]}</div>
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
                              <span style={{ fontSize: '11pt', fontWeight: 1000 }}>{formatTime(m.estimatedTime || 0)}</span>
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
                  <div style={{ padding: '0 15px', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', fontSize: '10pt', fontWeight: 900 }}>{nomenclature?.material_type || '—'}</div>
                  <div style={{ padding: '0 15px', display: 'flex', alignItems: 'center', fontSize: '14pt', fontWeight: 900 }}>☐</div>
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
                        <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt', letterSpacing: '2px' }}>☐ | ☐</td>
                        <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2}</td>
                        <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt', letterSpacing: '2px' }}>☐ | ☐</td>
                        {!isCutter1_5 ? (
                          <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2cF2}</td>
                        ) : (
                          <td style={{ border: '1.5px solid #000', paddingLeft: '4px' }}>{row.s2cF15}</td>
                        )}
                        <td style={{ border: '1.5px solid #000', textAlign: 'center', fontSize: '10pt' }}>☐</td>
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
                        <div style={{ width: '60%' }}></div>
                      </div>
                      <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '24px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>2мм</div>
                        <div style={{ width: '60%' }}></div>
                      </div>
                      <div style={{ display: 'flex', height: '24px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>3мм</div>
                        <div style={{ width: '60%' }}></div>
                      </div>
                    </div>
                    <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', borderBottom: '1.5px solid #000', height: '36px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>4мм</div>
                        <div style={{ width: '60%' }}></div>
                      </div>
                      <div style={{ display: 'flex', height: '36px' }}>
                        <div style={{ width: '40%', borderRight: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>6мм</div>
                        <div style={{ width: '60%' }}></div>
                      </div>
                    </div>
                  </div>
                  <div style={{ width: '30%', display: 'flex', flexDirection: 'column', fontWeight: 900, padding: '4px 8px', justifyContent: 'space-between' }}>
                    <div>1,5мм - </div>
                    <div>2мм - </div>
                    <div>3мм - </div>
                    <div>4мм - </div>
                    <div>6мм - </div>
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
                    <div style={{ flex: 1 }}></div>
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
