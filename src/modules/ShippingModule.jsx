import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Truck, ArrowLeft, ClipboardList, AlertCircle, PackageCheck,
  X, Package, FileText, Printer, Calendar, User, Hash,
  Boxes, CheckSquare, Square, ChevronDown, Palette, Clock,
  CheckCircle2, ArrowRight, Download
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

// ─── Кольори маркування палет ─────────────────────────────────────────────────
const PALLET_COLORS = [
  { id: 'red',    label: 'Червоний',   hex: '#ef4444' },
  { id: 'orange', label: 'Помаранчевий', hex: '#f97316' },
  { id: 'yellow', label: 'Жовтий',    hex: '#eab308' },
  { id: 'green',  label: 'Зелений',   hex: '#22c55e' },
  { id: 'blue',   label: 'Синій',     hex: '#3b82f6' },
  { id: 'purple', label: 'Фіолетовий', hex: '#a855f7' },
  { id: 'pink',   label: 'Рожевий',   hex: '#ec4899' },
  { id: 'white',  label: 'Білий',     hex: '#f1f5f9' },
]

// ─── Кастомний Select (щоб уникнути нечитабельного нативного дропдауну на Windows) ─
const CustomSelect = ({ value, onChange, options, placeholder = '— Обрати —', accent = '#ff9000' }) => {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)
  const selected = options.find(o => o.value === value)

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '12px 40px 12px 14px',
          background: value ? `rgba(${accent === '#ff9000' ? '255,144,0' : '168,85,247'},0.08)` : 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${value ? accent + '55' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '12px',
          color: value ? '#fff' : '#555',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s',
        }}
      >
        {selected?.icon && <span>{selected.icon}</span>}
        <span style={{ flex: 1 }}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} color={accent} style={{ position: 'absolute', right: '12px', top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, transition: '0.2s', flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0, right: 0,
          background: '#111827',
          border: `1px solid ${accent}33`,
          borderRadius: '14px',
          zIndex: 999,
          overflow: 'hidden',
          boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${accent}22`,
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                background: value === opt.value ? `${accent}18` : 'transparent',
                color: value === opt.value ? '#fff' : '#aaa',
                fontSize: '0.85rem',
                fontWeight: value === opt.value ? 800 : 600,
                borderLeft: value === opt.value ? `3px solid ${accent}` : '3px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (value !== opt.value) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff' } }}
              onMouseLeave={e => { if (value !== opt.value) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' } }}
            >
              {opt.icon && <span style={{ fontSize: '1rem' }}>{opt.icon}</span>}
              <span>{opt.label}</span>
              {value === opt.value && <CheckCircle2 size={14} color={accent} style={{ marginLeft: 'auto' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ShippingModule = () => {
  const {
    orders, tasks, nomenclatures, supabase,
    fetchData, currentUser, systemUsers,
    deductIssuedMaterialsForTask
  } = useMES()

  const [activeMobileSection, setActiveMobileSection] = useState('ready')
  const [isProcessing, setIsProcessing] = useState(false)

  // Стан модального вікна "Взяти в роботу"
  const [workModal, setWorkModal] = useState(null) // { batch }
  const [shippingType, setShippingType] = useState('')
  const [shippingDate, setShippingDate] = useState('')
  const [ttnNumber, setTtnNumber] = useState('')
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [batchColor, setBatchColor] = useState('')
  const [boxes, setBoxes] = useState([])    // [ { box_number, items: [{nom_name, qty, unit}] } ]
  const [checkedBoxes, setCheckedBoxes] = useState({}) // { box_number: bool }
  const [loadingBoxes, setLoadingBoxes] = useState(false)

  // Стан пакувального листа
  const [packingSlip, setPackingSlip] = useState(null)
  const printRef = useRef(null)

  useEffect(() => { document.title = 'Логістика | Centrum' }, [])

  // Список відвантажувальників
  const shippingWorkers = useMemo(() =>
    (systemUsers || []).filter(u => u?.access_rights?.shipping === true),
    [systemUsers]
  )

  // Партії готові до відвантаження
  const readyBatches = useMemo(() => {
    const allReady = (tasks || []).filter(t =>
      t.status === 'completed' &&
      t.plan_snapshot?._metadata?.is_packaged === true &&
      t.plan_snapshot?._metadata?.is_shipped !== true
    )
    const batchMap = {}
    allReady.forEach(t => {
      const key = `${t.order_id}_${t.batch_index ?? '0'}`
      if (!batchMap[key]) batchMap[key] = []
      batchMap[key].push(t)
    })
    return Object.values(batchMap).map(taskList => {
      const t = taskList[0]
      const order = (orders || []).find(o => String(o.id) === String(t.order_id))
      const meta = t.plan_snapshot?._metadata || {}
      return {
        id: t.id,
        orderId: t.order_id,
        orderNum: order?.order_num || '???',
        customer: order?.customer || '—',
        deadline: order?.deadline,
        batchIndex: t.batch_index ?? '1',
        batchTasks: taskList,
        packedBy: meta.packaged_by || '',
        packedAt: meta.packaged_at || '',
        batchColor: meta.batch_color || '',
      }
    })
  }, [tasks, orders])

  // Відвантажені партії (для архіву)
  const shippedBatches = useMemo(() => {
    const shipped = (tasks || []).filter(t =>
      t.plan_snapshot?._metadata?.is_shipped === true
    )
    const batchMap = {}
    shipped.forEach(t => {
      const key = `${t.order_id}_${t.batch_index ?? '0'}`
      if (!batchMap[key]) batchMap[key] = []
      batchMap[key].push(t)
    })
    return Object.values(batchMap).map(taskList => {
      const t = taskList[0]
      const order = (orders || []).find(o => String(o.id) === String(t.order_id))
      const meta = t.plan_snapshot?._metadata || {}
      return {
        id: t.id,
        orderId: t.order_id,
        orderNum: order?.order_num || '???',
        customer: order?.customer || '—',
        batchIndex: t.batch_index ?? '1',
        shippedAt: meta.shipped_at || '',
        shippedBy: meta.shipped_by || '',
        ttn: meta.ttn_number || '',
        shippingType: meta.shipping_type || '',
        batchColor: meta.batch_color || '',
        packingSlipNumber: meta.packing_slip_number || null,
      }
    }).sort((a, b) => (b.shippedAt || '').localeCompare(a.shippedAt || ''))
      .slice(0, 20)
  }, [tasks, orders])

  // ─── Завантаження коробок з БД ────────────────────────────────────────────
  const loadBoxes = useCallback(async (batch) => {
    setLoadingBoxes(true)
    setBoxes([])
    setCheckedBoxes({})
    try {
      const { data, error } = await supabase
        .from('packaging_boxes')
        .select('*')
        .eq('order_id', batch.orderId)
        .eq('batch_index', String(batch.batchIndex))
        .order('box_number')

      if (error) { console.error('[Shipping] loadBoxes error:', error); return }

      // Групуємо по коробках
      const map = {}
      ;(data || []).forEach(row => {
        const key = row.box_number
        if (!map[key]) map[key] = { box_number: key, items: [] }
        // Знаходимо назву номенклатури
        const nom = (nomenclatures || []).find(n => String(n.id) === String(row.nomenclature_id))
        map[key].items.push({
          nom_id: row.nomenclature_id,
          nom_name: nom?.name || `ID:${row.nomenclature_id}`,
          qty: row.quantity,
          unit: nom?.unit || 'шт'
        })
      })

      const boxList = Object.values(map).sort((a, b) =>
        a.box_number.localeCompare(b.box_number, undefined, { numeric: true })
      )
      setBoxes(boxList)

      // Ініціалізуємо чекбокси
      const initialChecked = {}
      boxList.forEach(b => { initialChecked[b.box_number] = false })
      setCheckedBoxes(initialChecked)
    } catch (e) {
      console.error('[Shipping] loadBoxes catch:', e)
    } finally {
      setLoadingBoxes(false)
    }
  }, [supabase, nomenclatures])

  // ─── Відкрити модалку "Взяти в роботу" ────────────────────────────────────
  const openWorkModal = useCallback((batch) => {
    setWorkModal({ batch })
    setShippingType('')
    setShippingDate('')
    setTtnNumber('')
    setSelectedWorkerId('')
    setBatchColor('')
    loadBoxes(batch)
  }, [loadBoxes])

  const closeWorkModal = () => {
    setWorkModal(null)
    setBoxes([])
    setCheckedBoxes({})
  }

  // ─── Перевірка чи можна завершити ─────────────────────────────────────────
  const canFinish = useMemo(() => {
    if (!shippingType || !shippingDate || !ttnNumber.trim() || !selectedWorkerId || !batchColor) return false
    if (boxes.length === 0) return false
    const allChecked = boxes.every(b => checkedBoxes[b.box_number] === true)
    return allChecked
  }, [shippingType, shippingDate, ttnNumber, selectedWorkerId, batchColor, boxes, checkedBoxes])

  // ─── Завершити відвантаження ───────────────────────────────────────────────
  const handleFinishShipping = async () => {
    if (!workModal || !canFinish) return
    const { batch } = workModal
    const worker = shippingWorkers.find(u => String(u.id) === String(selectedWorkerId))
    const workerName = worker ? `${worker.first_name || ''} ${worker.last_name || ''}`.trim() : ''
    const colorObj = PALLET_COLORS.find(c => c.id === batchColor)

    try {
      setIsProcessing(true)

      // 1. Списуємо матеріали зі складу
      for (const t of batch.batchTasks) {
        await deductIssuedMaterialsForTask(t.id)
      }

      // 1.5. Визначаємо наступний номер пакувального листа
      const { data: allTasks, error: fetchErr } = await supabase
        .from('tasks')
        .select('plan_snapshot')
      if (fetchErr) throw fetchErr

      const shippedTasks = (allTasks || []).filter(t => t.plan_snapshot?._metadata?.is_shipped === true)
      let maxSlipNum = 856 // default starting base
      shippedTasks.forEach(t => {
        const num = Number(t.plan_snapshot?._metadata?.packing_slip_number)
        if (num && num > maxSlipNum) {
          maxSlipNum = num
        }
      })
      const nextSlipNumber = maxSlipNum + 1

      // 2. Оновлюємо метадані в завданнях
      for (const t of batch.batchTasks) {
        const newSnapshot = {
          ...(t.plan_snapshot || {}),
          _metadata: {
            ...(t.plan_snapshot?._metadata || {}),
            is_shipped: true,
            shipped_at: new Date().toISOString(),
            shipped_by: workerName,
            shipped_by_id: worker?.id,
            shipping_type: shippingType,
            shipping_date: shippingDate,
            ttn_number: ttnNumber.trim().toUpperCase(),
            batch_color: batchColor,
            batch_color_label: colorObj?.label || batchColor,
            batch_color_hex: colorObj?.hex || '#888',
            packing_slip_number: nextSlipNumber,
          }
        }
        await supabase.from('tasks').update({ plan_snapshot: newSnapshot }).eq('id', t.id)
      }

      // 3. Якщо всі партії відвантажені → статус замовлення = shipped
      const { data: siblingTasks } = await supabase
        .from('tasks').select('plan_snapshot').eq('order_id', batch.orderId)
      const allShipped = (siblingTasks || []).every(st => st.plan_snapshot?._metadata?.is_shipped === true)
      if (allShipped) {
        await supabase.from('orders').update({ status: 'shipped' }).eq('id', batch.orderId)
      }

      await fetchData()

      // 4. Генеруємо пакувальний лист
      const order = (orders || []).find(o => String(o.id) === String(batch.orderId))
      const plannedSets = batch.batchTasks[0]?.planned_sets || 0
      const productNames = order?.order_items?.map(it => (nomenclatures || []).find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ') || '—'

      // Агрегуємо вміст коробок
      const aggregatedMap = {}
      boxes.forEach(box => {
        box.items.forEach(item => {
          const key = item.nom_id || item.nom_name
          if (!aggregatedMap[key]) {
            const nom = (nomenclatures || []).find(n => String(n.id) === String(item.nom_id))
            aggregatedMap[key] = {
              nom_id: item.nom_id,
              nom_name: item.nom_name,
              qty: 0,
              unit: item.unit,
              nom: nom || null,
              boxes: []
            }
          }
          aggregatedMap[key].qty += Number(item.qty) || 0
          if (!aggregatedMap[key].boxes.includes(box.box_number)) {
            aggregatedMap[key].boxes.push(box.box_number)
          }
        })
      })

      const aggregatedList = Object.values(aggregatedMap).map(item => {
        let categoryKey = 'other'
        if (item.nom) {
          const type = (item.nom.type || '').toLowerCase()
          const name = (item.nom.name || '').toLowerCase()
          const code = (item.nom.nomenclature_code || '').toLowerCase()
          if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) categoryKey = 'mounts'
          else if (name.includes('іп') || code.includes('іп') || type.includes('part') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) categoryKey = 'sgp'
          else if (name.includes('стійка') || type.includes('стійк')) categoryKey = 'spacers'
          else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка')) categoryKey = 'hardware'
        }
        return {
          nom_id: item.nom_id,
          nom_name: item.nom_name,
          qty: item.qty,
          unit: item.unit,
          boxes: item.boxes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
          categoryKey
        }
      })

      setPackingSlip({
        orderNum: batch.orderNum,
        customer: batch.customer,
        batchIndex: batch.batchIndex,
        shippingDate,
        shippingType,
        ttn: ttnNumber.trim().toUpperCase(),
        workerName,
        batchColor: colorObj?.label || batchColor,
        batchColorHex: colorObj?.hex || '#888',
        boxes: [...boxes],
        plannedSets,
        productNames,
        aggregatedList,
        slipNumber: nextSlipNumber,
        generatedAt: new Date().toISOString(),
      })

      setWorkModal(null)
    } catch (e) {
      console.error('[Shipping] finish error:', e)
      alert('Помилка при відвантаженні: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // ─── Друк пакувального листа ───────────────────────────────────────────────
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

  // ─── Перегляд існуючого пакувального листа ───────────────────────────────
  const handleViewPackingSlip = async (batch) => {
    setLoadingBoxes(true)
    try {
      const { data, error } = await supabase
        .from('packaging_boxes')
        .select('*')
        .eq('order_id', batch.orderId)
        .eq('batch_index', String(batch.batchIndex))
        .order('box_number')

      if (error) { console.error('[Shipping] loadBoxes error:', error); return }

      const map = {}
      ;(data || []).forEach(row => {
        const key = row.box_number
        if (!map[key]) map[key] = { box_number: key, items: [] }
        const nom = (nomenclatures || []).find(n => String(n.id) === String(row.nomenclature_id))
        map[key].items.push({
          nom_id: row.nomenclature_id,
          nom_name: nom?.name || `ID:${row.nomenclature_id}`,
          qty: row.quantity,
          unit: nom?.unit || 'шт'
        })
      })

      const boxList = Object.values(map).sort((a, b) =>
        a.box_number.localeCompare(b.box_number, undefined, { numeric: true })
      )

      // Отримуємо planned_sets з бази даних
      const { data: dbTasks } = await supabase
        .from('tasks')
        .select('planned_sets, plan_snapshot')
        .eq('order_id', batch.orderId)
        .eq('batch_index', String(batch.batchIndex))
      
      const firstTask = dbTasks?.[0]
      const plannedSets = firstTask?.planned_sets || 0
      const meta = firstTask?.plan_snapshot?._metadata || {}

      const order = (orders || []).find(o => String(o.id) === String(batch.orderId))
      const productNames = order?.order_items?.map(it => (nomenclatures || []).find(n => n.id === it.nomenclature_id)?.name).filter(Boolean).join(', ') || '—'

      // Агрегуємо
      const aggregatedMap = {}
      boxList.forEach(box => {
        box.items.forEach(item => {
          const key = item.nom_id || item.nom_name
          if (!aggregatedMap[key]) {
            const nom = (nomenclatures || []).find(n => String(n.id) === String(item.nom_id))
            aggregatedMap[key] = {
              nom_id: item.nom_id,
              nom_name: item.nom_name,
              qty: 0,
              unit: item.unit,
              nom: nom || null,
              boxes: []
            }
          }
          aggregatedMap[key].qty += Number(item.qty) || 0
          if (!aggregatedMap[key].boxes.includes(box.box_number)) {
            aggregatedMap[key].boxes.push(box.box_number)
          }
        })
      })

      const aggregatedList = Object.values(aggregatedMap).map(item => {
        let categoryKey = 'other'
        if (item.nom) {
          const type = (item.nom.type || '').toLowerCase()
          const name = (item.nom.name || '').toLowerCase()
          const code = (item.nom.nomenclature_code || '').toLowerCase()
          if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) categoryKey = 'mounts'
          else if (name.includes('іп') || code.includes('іп') || type.includes('part') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) categoryKey = 'sgp'
          else if (name.includes('стійка') || type.includes('стійк')) categoryKey = 'spacers'
          else if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка')) categoryKey = 'hardware'
        }
        return {
          nom_id: item.nom_id,
          nom_name: item.nom_name,
          qty: item.qty,
          unit: item.unit,
          boxes: item.boxes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
          categoryKey
        }
      })

      setPackingSlip({
        orderNum: batch.orderNum,
        customer: batch.customer,
        batchIndex: batch.batchIndex,
        shippingDate: batch.shippingDate || meta.shipping_date,
        shippingType: batch.shippingType || meta.shipping_type,
        ttn: batch.ttn || meta.ttn_number,
        workerName: batch.shippedBy || meta.shipped_by,
        batchColor: batch.batchColor || meta.batch_color,
        batchColorHex: meta.batch_color_hex || '#888',
        boxes: boxList,
        plannedSets,
        productNames,
        aggregatedList,
        slipNumber: batch.packingSlipNumber || meta.packing_slip_number,
        generatedAt: meta.shipped_at || new Date().toISOString(),
      })
    } catch (err) {
      console.error('[Shipping] load packing slip error:', err)
    } finally {
      setLoadingBoxes(false)
    }
  }

  // Підрахунок коробок
  const totalBoxes = boxes.length
  const checkedCount = Object.values(checkedBoxes).filter(Boolean).length

  return (
    <div style={{ background: '#050505', minHeight: '100vh', color: '#e2e8f0', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* HEADER */}
      <header style={{ padding: '20px 40px', background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ background: '#111', color: '#555', width: '44px', height: '44px', borderRadius: '14px', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', textDecoration: 'none' }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'linear-gradient(135deg, #ff9000 0%, #ff5e00 100%)', padding: '12px', borderRadius: '16px', boxShadow: '0 8px 20px rgba(255,144,0,0.25)' }}>
              <Truck size={24} color="#000" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>ЛОГІСТИЧНИЙ ЦЕНТР</h1>
              <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 600, textTransform: 'uppercase', marginTop: '2px' }}>Управління відвантаженням та ТТН</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800 }}>ВІДДІЛ ВІДВАНТАЖЕННЯ</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ff900015', border: '1px solid #ff900030', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} color="#ff9000" />
          </div>
        </div>
      </header>

      {/* MOBILE TABS */}
      <div className="shipping-mobile-tabs">
        <button onClick={() => setActiveMobileSection('ready')} className={`tab-btn ${activeMobileSection === 'ready' ? 'active' : ''}`}>
          ГОТОВО ({readyBatches.length})
        </button>
        <button onClick={() => setActiveMobileSection('shipped')} className={`tab-btn ${activeMobileSection === 'shipped' ? 'active' : ''}`}>
          ВІДПРАВЛЕНО ({shippedBatches.length})
        </button>
      </div>

      <main style={{ padding: '40px', flex: 1, maxWidth: '1800px', margin: '0 auto', width: '100%' }}>
        <div className="shipping-grid">

          {/* КОЛОНКА: ГОТОВО ДО ВІДВАНТАЖЕННЯ */}
          <section className={`dashboard-col ${activeMobileSection !== 'ready' ? 'hide-mobile' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', margin: 0 }}>ГОТОВО ДО ВІДВАНТАЖЕННЯ</h3>
              </div>
              <span style={{ background: '#10b98115', color: '#10b981', fontSize: '0.65rem', fontWeight: 900, padding: '6px 12px', borderRadius: '10px', border: '1px solid #10b98130' }}>
                {readyBatches.length} ПАРТІЙ
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {readyBatches.map(batch => (
                <div key={`${batch.orderId}_${batch.batchIndex}`} className="batch-card">
                  {/* Кольорова смуга зліва якщо є колір */}
                  {batch.batchColor && (
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: PALLET_COLORS.find(c => c.id === batch.batchColor)?.hex || '#888', borderRadius: '28px 0 0 28px' }} />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>#{batch.orderNum}</div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#555', marginTop: '2px' }}>ПАРТІЯ {batch.batchIndex}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ background: '#10b98115', color: '#10b981', fontSize: '0.6rem', fontWeight: 900, padding: '5px 10px', borderRadius: '8px' }}>
                        ✓ ЗАПАКОВАНО
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0a0a0a', padding: '10px 14px', borderRadius: '12px' }}>
                    <User size={14} color="#ff9000" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ccc' }}>{batch.customer}</span>
                  </div>

                  {batch.packedBy && (
                    <div style={{ fontSize: '0.7rem', color: '#444', fontWeight: 600 }}>
                      📦 Запакував: {batch.packedBy}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#444', fontWeight: 700 }}>
                      <Calendar size={12} />
                      <span>{batch.deadline ? new Date(batch.deadline).toLocaleDateString('uk-UA') : '—'}</span>
                    </div>
                    <button
                      onClick={() => openWorkModal(batch)}
                      disabled={isProcessing}
                      className="take-work-btn"
                    >
                      <Truck size={16} />
                      <span>ВЗЯТИ В РОБОТУ</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {readyBatches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 40px', color: '#222' }}>
                  <PackageCheck size={48} color="#1a1a1a" />
                  <p style={{ fontWeight: 900, color: '#333', margin: '15px 0 5px' }}>Черга відвантаження порожня</p>
                  <span style={{ fontSize: '0.8rem' }}>Очікуємо завершення пакування в цеху</span>
                </div>
              )}
            </div>
          </section>

          {/* КОЛОНКА: ВІДПРАВЛЕНО */}
          <section className={`dashboard-col ${activeMobileSection !== 'shipped' ? 'hide-mobile' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} color="#555" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#555', margin: 0 }}>ВІДПРАВЛЕНО</h3>
              </div>
              <span style={{ background: '#111', color: '#555', fontSize: '0.65rem', fontWeight: 900, padding: '6px 12px', borderRadius: '10px', border: '1px solid #222' }}>
                {shippedBatches.length} ПАРТІЙ
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shippedBatches.map(batch => {
                const colorObj = PALLET_COLORS.find(c => c.id === batch.batchColor)
                return (
                  <div key={`${batch.orderId}_${batch.batchIndex}`} style={{
                    background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '20px',
                    padding: '18px 20px', position: 'relative', overflow: 'hidden'
                  }}>
                    {colorObj && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: colorObj.hex, borderRadius: '20px 0 0 20px' }} />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#888' }}>#{batch.orderNum} · Партія {batch.batchIndex}</div>
                        <div style={{ fontSize: '0.75rem', color: '#444', marginTop: '3px', fontWeight: 600 }}>{batch.customer}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800, background: '#10b98110', padding: '4px 8px', borderRadius: '6px' }}>ВІДПРАВЛЕНО</div>
                        {batch.shippedAt && (
                          <div style={{ fontSize: '0.65rem', color: '#333', marginTop: '4px' }}>
                            {new Date(batch.shippedAt).toLocaleDateString('uk-UA')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: '14px', borderTop: '1px dashed #1a1a1a', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {batch.ttn && (
                          <span style={{ fontSize: '0.65rem', color: '#555', background: '#111', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            ТТН: {batch.ttn}
                          </span>
                        )}
                        {batch.shippingType && (
                          <span style={{ fontSize: '0.65rem', color: '#555', background: '#111', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            {batch.shippingType}
                          </span>
                        )}
                        {batch.shippedBy && (
                          <span style={{ fontSize: '0.65rem', color: '#555', background: '#111', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            👤 {batch.shippedBy}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleViewPackingSlip(batch)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,144,0,0.1)', border: '1px solid rgba(255,144,0,0.2)', color: '#ff9000', borderRadius: '8px', padding: '5px 10px', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ff9000'; e.currentTarget.style.color = '#000' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,144,0,0.1)'; e.currentTarget.style.color = '#ff9000' }}
                      >
                        <Printer size={12} /> Лист {batch.packingSlipNumber ? `№${batch.packingSlipNumber}` : ''}
                      </button>
                    </div>
                  </div>
                )
              })}

              {shippedBatches.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 40px', color: '#222' }}>
                  <Clock size={40} color="#1a1a1a" />
                  <p style={{ fontWeight: 800, color: '#333', margin: '12px 0 0' }}>Ще нічого не відвантажено</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          МОДАЛЬНЕ ВІКНО "ВЗЯТИ В РОБОТУ"
      ═══════════════════════════════════════════════════════════════════════ */}
      {workModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', overflowY: 'auto' }}>
          <div style={{ background: 'linear-gradient(160deg, #0f1923 0%, #0a0f18 100%)', border: '1px solid rgba(255,144,0,0.2)', borderRadius: '32px', width: '100%', maxWidth: '720px', marginTop: '20px', marginBottom: '20px', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 80px rgba(255,144,0,0.05)' }}>

            {/* Modal Header */}
            <div style={{ padding: '28px 32px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,144,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #ff9000, #ff5e00)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(255,144,0,0.4)' }}>
                  <Truck size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Взяти в роботу
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#ff9000', fontWeight: 700, marginTop: '2px' }}>
                    #{workModal.batch.orderNum} · Партія {workModal.batch.batchIndex} · {workModal.batch.customer}
                  </div>
                </div>
              </div>
              <button onClick={closeWorkModal} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', color: '#888', cursor: 'pointer', padding: '10px', display: 'flex', transition: '0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* ── СЕКЦІЯ 1: ДЕТАЛІ ВІДВАНТАЖЕННЯ ── */}
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '16px' }}>
                  Деталі відвантаження
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

                  {/* Тип відвантаження */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Тип відвантаження</label>
                    <CustomSelect
                      value={shippingType}
                      onChange={setShippingType}
                      options={[
                        { value: 'Самовивіз', label: 'Самовивіз', icon: '🚗' },
                        { value: 'Доставка НП', label: 'Доставка НП', icon: '📦' },
                      ]}
                      placeholder="— Обрати —"
                    />
                  </div>

                  {/* Дата відвантаження */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Дата відвантаження</label>
                    <input
                      type="date"
                      value={shippingDate}
                      onChange={e => setShippingDate(e.target.value)}
                      onClick={e => {
                        try {
                          e.target.showPicker();
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      style={{ padding: '12px 14px', background: 'rgba(255,144,0,0.06)', border: `1.5px solid ${shippingDate ? 'rgba(255,144,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', color: shippingDate ? '#fff' : '#555', fontSize: '0.85rem', fontWeight: 700, outline: 'none', colorScheme: 'dark', cursor: 'pointer', width: '100%' }}
                    />
                  </div>

                  {/* Номер ТТН */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Номер ТТН</label>
                    <input
                      type="text"
                      placeholder="20450000000000"
                      value={ttnNumber}
                      onChange={e => setTtnNumber(e.target.value)}
                      style={{ padding: '12px 14px', background: 'rgba(255,144,0,0.06)', border: `1.5px solid ${ttnNumber.trim() ? 'rgba(255,144,0,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
                    />
                  </div>

                  {/* Відповідальний */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Відповідальний</label>
                    <CustomSelect
                      value={selectedWorkerId}
                      onChange={setSelectedWorkerId}
                      options={shippingWorkers.map(u => ({
                        value: String(u.id),
                        label: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.login,
                        icon: '👤'
                      }))}
                      placeholder="— Обрати —"
                    />
                  </div>
                </div>
              </div>

              {/* ── СЕКЦІЯ 2: КОЛІР ПАРТІЇ ── */}
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Palette size={14} />
                  Колір маркування партії (палет)
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {PALLET_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setBatchColor(c.id)}
                      title={c.label}
                      style={{
                        width: '42px', height: '42px', borderRadius: '12px',
                        background: c.hex,
                        border: batchColor === c.id ? '3px solid #fff' : '3px solid transparent',
                        cursor: 'pointer',
                        boxShadow: batchColor === c.id ? `0 0 0 2px ${c.hex}88, 0 4px 12px ${c.hex}66` : 'none',
                        transform: batchColor === c.id ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      {batchColor === c.id && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle2 size={18} color={c.id === 'white' || c.id === 'yellow' ? '#333' : '#fff'} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {batchColor && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888', fontWeight: 700 }}>
                    Обрано: <span style={{ color: PALLET_COLORS.find(c => c.id === batchColor)?.hex }}>{PALLET_COLORS.find(c => c.id === batchColor)?.label}</span>
                  </div>
                )}
              </div>

              {/* ── СЕКЦІЯ 3: ПЕРЕВІРКА КОРОБОК ── */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ff9000', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Boxes size={14} />
                    Перевірка коробок
                  </div>
                  {totalBoxes > 0 && (
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: checkedCount === totalBoxes ? '#10b981' : '#888' }}>
                      {checkedCount} / {totalBoxes} перевірено
                    </div>
                  )}
                </div>

                {loadingBoxes ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#444', fontSize: '0.8rem' }}>
                    Завантаження коробок…
                  </div>
                ) : boxes.length === 0 ? (
                  <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid #1a1a1a', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>
                    ⚠️ Коробки не знайдені в базі. Переконайтесь що пакування було збережено.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '6px' }}>
                    {boxes.map(box => {
                      const isChecked = checkedBoxes[box.box_number] === true
                      return (
                        <div
                          key={box.box_number}
                          onClick={() => setCheckedBoxes(prev => ({ ...prev, [box.box_number]: !prev[box.box_number] }))}
                          style={{
                            padding: '12px 14px',
                            background: isChecked ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isChecked ? 'rgba(16,185,129,0.25)' : '#1a1a1a'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px'
                          }}
                        >
                          <div style={{ marginTop: '2px', flexShrink: 0 }}>
                            {isChecked
                              ? <CheckSquare size={18} color="#10b981" />
                              : <Square size={18} color="#333" />
                            }
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <span style={{ background: isChecked ? '#10b98120' : '#ff900015', color: isChecked ? '#10b981' : '#ff9000', fontSize: '0.7rem', fontWeight: 900, padding: '3px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
                                #{box.box_number}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700 }}>
                                {box.items.length} позицій
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {box.items.map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: isChecked ? '#888' : '#555' }}>
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nom_name}</span>
                                  <span style={{ fontWeight: 800, marginLeft: '10px', flexShrink: 0 }}>{item.qty} {item.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Відмітити все */}
                {boxes.length > 0 && (
                  <button
                    onClick={() => {
                      const allChecked = boxes.every(b => checkedBoxes[b.box_number])
                      const newState = {}
                      boxes.forEach(b => { newState[b.box_number] = !allChecked })
                      setCheckedBoxes(newState)
                    }}
                    style={{ marginTop: '10px', background: 'transparent', border: '1px solid #222', borderRadius: '10px', color: '#555', fontSize: '0.75rem', fontWeight: 700, padding: '8px 16px', cursor: 'pointer', transition: '0.2s' }}
                  >
                    {boxes.every(b => checkedBoxes[b.box_number]) ? '✕ Зняти всі' : '✓ Відмітити всі'}
                  </button>
                )}
              </div>

              {/* ── КНОПКА ЗАВЕРШИТИ ── */}
              <button
                onClick={handleFinishShipping}
                disabled={!canFinish || isProcessing}
                style={{
                  padding: '17px',
                  background: canFinish
                    ? 'linear-gradient(135deg, #ff9000 0%, #ff5e00 100%)'
                    : 'rgba(255,255,255,0.04)',
                  border: 'none',
                  borderRadius: '16px',
                  color: canFinish ? '#fff' : '#333',
                  fontSize: '0.9rem',
                  fontWeight: 900,
                  cursor: canFinish ? 'pointer' : 'not-allowed',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: 'all 0.3s',
                  boxShadow: canFinish ? '0 8px 24px rgba(255,144,0,0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
                onMouseEnter={e => { if (canFinish) e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
              >
                {isProcessing ? (
                  <span>Обробка…</span>
                ) : (
                  <>
                    <Truck size={20} />
                    Завершити відвантаження та згенерувати пакувальний лист
                  </>
                )}
              </button>

              {!canFinish && (
                <div style={{ fontSize: '0.72rem', color: '#555', textAlign: 'center', marginTop: '-16px' }}>
                  {!shippingType && '• Оберіть тип відвантаження  '}
                  {!shippingDate && '• Вкажіть дату  '}
                  {!ttnNumber.trim() && '• Введіть номер ТТН  '}
                  {!selectedWorkerId && '• Оберіть відповідального  '}
                  {!batchColor && '• Оберіть колір партії  '}
                  {boxes.length > 0 && !boxes.every(b => checkedBoxes[b.box_number]) && `• Перевірте всі коробки (${checkedCount}/${totalBoxes})`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ПАКУВАЛЬНИЙ ЛИСТ (МОДАЛКА ПІСЛЯ ВІДВАНТАЖЕННЯ)
      ═══════════════════════════════════════════════════════════════════════ */}
      {packingSlip && (
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
                <button onClick={() => setPackingSlip(null)} style={{ background: '#222', border: 'none', borderRadius: '10px', color: '#888', padding: '10px', cursor: 'pointer', display: 'flex' }}>
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
                    {packingSlip.boxes.flatMap((box, boxIdx) =>
                      box.items.map((item, itemIdx) => {
                        const isEvenBox = boxIdx % 2 === 0
                        const isFirstItem = itemIdx === 0
                        return (
                          <tr key={`${boxIdx}-${itemIdx}`} style={{ background: isEvenBox ? '#ffffff' : '#f9fafb' }}>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#111827', fontSize: '12px', border: '1px solid #e5e7eb' }}>
                              {isFirstItem ? `Коробка ${box.box_number}` : ''}
                            </td>
                            <td style={{ color: '#374151', fontWeight: 500, border: '1px solid #e5e7eb' }}>
                              {item.nom_name}
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
                    const catItems = packingSlip.aggregatedList.filter(item => item.categoryKey === key)
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
                                <span style={{ fontWeight: 600, color: '#374151', fontSize: '11px' }}>{item.nom_name}</span>
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
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');

        .shipping-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }

        .shipping-mobile-tabs {
          display: none;
          gap: 8px;
          padding: 12px 20px;
          background: #080808;
          border-bottom: 1px solid #1a1a1a;
        }

        .tab-btn {
          flex: 1;
          padding: 12px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: #555;
          font-weight: 900;
          font-size: 0.75rem;
          cursor: pointer;
          transition: 0.2s;
        }

        .tab-btn.active {
          background: #ff9000;
          color: #000;
        }

        .batch-card {
          background: rgba(15,25,35,0.6);
          border: 1px solid #1a2535;
          border-radius: 24px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .batch-card:hover {
          border-color: rgba(255,144,0,0.25);
          transform: translateY(-3px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(255,144,0,0.04);
        }

        .take-work-btn {
          background: linear-gradient(135deg, #ff9000 0%, #ff5e00 100%);
          color: #000;
          border: none;
          padding: 11px 18px;
          border-radius: 12px;
          font-weight: 900;
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          transition: 0.2s;
          box-shadow: 0 4px 14px rgba(255,144,0,0.3);
        }

        .take-work-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 6px 20px rgba(255,144,0,0.5);
        }

        .take-work-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        @media (max-width: 1024px) {
          .shipping-grid { grid-template-columns: 1fr; }
          .shipping-mobile-tabs { display: flex; }
          .hide-mobile { display: none !important; }
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
      `}} />
    </div>
  )
}

export default ShippingModule
