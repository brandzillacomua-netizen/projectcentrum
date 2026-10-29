import React, { useState, useEffect, useMemo } from 'react'
import { X, Stamp, CheckCircle2, ShieldCheck, CheckSquare, Square, FileCheck2 } from 'lucide-react'
import { useStore } from '../../../../store/index.js'
import { supabase } from '../../../../supabase'
import { parseQcOpsStamps, stripQcOpsStamps } from '../../utils/shop1Helpers'

const STAMP_OPTIONS = ['ВКЯ 1', 'ВКЯ 2', 'ВКЯ 3', 'ВКЯ 4', 'ВКЯ 5', 'ВКЯ 6', 'ВКЯ 7', 'ВКЯ 8']

export function Shop1QCOpsModal({
  showQCOpsModal,
  onClose,
  currentCard,
  nomenclature,
  tasks = [],
  currentUser,
  systemUsers = [],
  workCards = [],
  setWorkCards,
  setSelectedCardHistory,
  fetchData,
  showAlert,
  isProcessing,
  setIsProcessing
}) {
  const machineOperations = useStore(state => state.machineOperations) || []
  const machines = useStore(state => state.machines) || []

  const [localOpConfig, setLocalOpConfig] = useState(null)
  const [selectedStamp, setSelectedStamp] = useState(() => {
    try { return localStorage.getItem('centrum_vkya_stamp') || 'ВКЯ 1' } catch { return 'ВКЯ 1' }
  })
  const [inspectorName, setInspectorName] = useState('')
  const [sheetsVerified, setSheetsVerified] = useState(false)
  const [sheetsStampInfo, setSheetsStampInfo] = useState(null)
  const [stampedOps, setStampedOps] = useState({})

  // Check if current machine is a small CNC (12x8 / 1200x800 / Малий / 1.)
  const isSmallMachine = useMemo(() => {
    const machineName = currentCard?.machine || ''
    const norm = machineName.toLowerCase().replace(/х/g, 'x')
    return (
      norm.includes('12x8') ||
      norm.includes('12*8') ||
      norm.includes('1200x800') ||
      norm.includes('1200') ||
      norm.includes('малий') ||
      norm.includes('1.')
    )
  }, [currentCard?.machine])

  const parentTask = useMemo(
    () => (tasks || []).find(t => String(t.id) === String(currentCard?.task_id)),
    [tasks, currentCard?.task_id]
  )

  const snapshotPart = useMemo(
    () => parentTask?.plan_snapshot?.[String(currentCard?.nomenclature_id)] || null,
    [parentTask, currentCard?.nomenclature_id]
  )

  const isCutter1_5 = snapshotPart?.cutter_override === '1.5'

  // Resolve operation configuration for this card and machine (same logic as ForemanPrintQueue & Shop1ShiftChangeModal)
  const opConfig = useMemo(() => {
    if (!currentCard?.nomenclature_id) return null
    const nomId = String(currentCard.nomenclature_id)
    const macName = currentCard.machine || ''
    const macId = currentCard.machine_id
    const macObj = machines.find(m => m.name === macName || (macId && String(m.id) === String(macId)))

    const exact = machineOperations.find(o =>
      String(o.nomenclature_id) === nomId &&
      (
        (macId && String(o.machine_id) === String(macId)) ||
        (macObj && String(o.machine_id) === String(macObj.id)) ||
        (macName && o.machine_type === macName)
      )
    )
    if (exact) return exact

    const normMac = macName.toLowerCase().replace(/х/g, 'x')
    const matchType = machineOperations.find(o => {
      if (String(o.nomenclature_id) !== nomId) return false
      const typeLower = (o.machine_type || '').toLowerCase().replace(/х/g, 'x')
      if (isSmallMachine && (typeLower.includes('1200') || typeLower.includes('12x8') || typeLower.includes('малий'))) return true
      if (normMac.includes('3050') && typeLower.includes('3050')) return true
      if (normMac.includes('3060') && typeLower.includes('3060')) return true
      if (normMac.includes('6000') && (typeLower.includes('6000') || typeLower.includes('дракон'))) return true
      if (normMac.includes('ke xin') && (typeLower.includes('ke xin') || typeLower.includes('фея'))) return true
      return false
    })
    if (matchType) return matchType

    return machineOperations.find(o => String(o.nomenclature_id) === nomId) || null
  }, [currentCard?.nomenclature_id, currentCard?.machine, currentCard?.machine_id, machineOperations, machines, isSmallMachine])

  useEffect(() => {
    if (showQCOpsModal && currentCard?.nomenclature_id && (!opConfig || machineOperations.length === 0)) {
      supabase
        .from('machine_operations')
        .select('*')
        .eq('nomenclature_id', currentCard.nomenclature_id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const found = data.find(d => {
              const t = (d.machine_type || '').toLowerCase().replace(/х/g, 'x')
              return isSmallMachine ? (t.includes('1200') || t.includes('12x8') || t.includes('малий')) : true
            }) || data[0]
            setLocalOpConfig(found)
          }
        })
        .catch(console.error)
    }
  }, [showQCOpsModal, currentCard?.nomenclature_id, opConfig, machineOperations.length, isSmallMachine])

  const activeConfig = opConfig || localOpConfig

  // Build formatted operations lists matching printed card
  const { s1Ops, s2Ops, s2CutOps, allItems } = useMemo(() => {
    const rawS1 = (activeConfig?.side1_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
    const rawS2 = (activeConfig?.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
    const rawS2Cut = (activeConfig?.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))

    const formatSideOp = (op) => {
      if (!op) return ''
      if (isCutter1_5) {
        if (op.includes('|')) return op.split('|')[1].trim()
        return op.replace(/[фФ]2(?![0-9.])/g, m => m[0] === 'ф' ? 'ф1.5' : 'Ф1.5').trim()
      }
      if (op.includes('|')) return op.split('|')[0].trim()
      return op.trim()
    }

    const formatCutOp = (op) => {
      if (!op) return ''
      if (isCutter1_5) {
        if (op.includes('|')) return op.split('|')[1].trim()
        return op.replace(/[фФ]2(?![0-9.])/g, m => m[0] === 'ф' ? 'ф1.5' : 'Ф1.5').trim()
      }
      if (op.includes('|')) return op.split('|')[0].trim()
      return op.replace(/[фФ]1\.5(?![0-9.])/g, m => m[0] === 'ф' ? 'ф2' : 'Ф2').trim()
    }

    const s1 = rawS1.map(formatSideOp).filter(Boolean)
    const s2 = rawS2.map(formatSideOp).filter(Boolean)
    const s2c = rawS2Cut.map(formatCutOp).filter(Boolean)

    const items = [
      ...s1.map((name, idx) => ({ key: `s1:${idx}`, side: '1 сторона', name, idx })),
      ...s2.map((name, idx) => ({ key: `s2:${idx}`, side: '2 сторона', name, idx })),
      ...s2c.map((name, idx) => ({ key: `s2c:${idx}`, side: `2 сторона вирізка (${isCutter1_5 ? 'Ф1.5мм' : 'Ф2мм'})`, name, idx }))
    ]

    return { s1Ops: s1, s2Ops: s2, s2CutOps: s2c, allItems: items }
  }, [activeConfig, isCutter1_5])

  const qcStaffList = useMemo(() => {
    const list = (systemUsers || []).filter(u =>
      u?.access_rights?.brak ||
      (u?.position && (u.position.toLowerCase().includes('вкя') || u.position.toLowerCase().includes('якост') || u.position.toLowerCase().includes('контрол')))
    ).map(u => [u.last_name, u.first_name].filter(Boolean).join(' ').trim() || u.login).filter(Boolean)
    return Array.from(new Set(list))
  }, [systemUsers])

  // Hydrate existing stamps when modal opens
  useEffect(() => {
    if (!showQCOpsModal || !currentCard) return
    const parsed = parseQcOpsStamps(currentCard.card_info)
    if (parsed) {
      setSheetsVerified(Boolean(parsed.sheets?.verified))
      setSheetsStampInfo(parsed.sheets || null)
      setStampedOps(parsed.ops || {})
      if (parsed.lastStamp) setSelectedStamp(parsed.lastStamp)
      if (parsed.lastInspector) setInspectorName(parsed.lastInspector)
    } else {
      setSheetsVerified(false)
      setSheetsStampInfo(null)
      setStampedOps({})
    }

    if (!parsed?.lastInspector) {
      const savedInspector = (() => {
        try { return localStorage.getItem('centrum_vkya_inspector') || '' } catch { return '' }
      })()
      const isGenericAdmin = currentUser?.login === 'admin' || /system\s*admin/i.test(`${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`)
      const currentFullName = isGenericAdmin
        ? ''
        : ([currentUser?.last_name, currentUser?.first_name].filter(Boolean).join(' ').trim() || '')
      setInspectorName(savedInspector || currentFullName)
    }
  }, [showQCOpsModal, currentCard?.id])

  if (!showQCOpsModal || !currentCard) return null

  const nowTimeShort = () => {
    const d = new Date()
    return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) + ' ' +
      d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
  }

  const isInspectorValid = Boolean(inspectorName && inspectorName.trim().length >= 2)

  const toggleOpStamp = (item) => {
    if (!isInspectorValid) return
    setStampedOps(prev => {
      const next = { ...prev }
      if (next[item.key]) {
        delete next[item.key]
      } else {
        next[item.key] = {
          stamp: selectedStamp || 'ВКЯ 1',
          inspector: inspectorName.trim(),
          name: item.name,
          side: item.side,
          at: nowTimeShort()
        }
      }
      return next
    })
  }

  const toggleSheetsVerified = () => {
    if (!isInspectorValid) return
    setSheetsVerified(prev => {
      const next = !prev
      if (next) {
        setSheetsStampInfo({
          verified: true,
          stamp: selectedStamp || 'ВКЯ 1',
          inspector: inspectorName.trim(),
          at: nowTimeShort()
        })
      } else {
        setSheetsStampInfo(null)
      }
      return next
    })
  }

  const handleStampAll = () => {
    if (!isInspectorValid) return
    const stampTime = nowTimeShort()
    const nextOps = { ...stampedOps }
    allItems.forEach(item => {
      if (!nextOps[item.key]) {
        nextOps[item.key] = {
          stamp: selectedStamp || 'ВКЯ 1',
          inspector: inspectorName.trim(),
          name: item.name,
          side: item.side,
          at: stampTime
        }
      }
    })
    setStampedOps(nextOps)
    if (!sheetsVerified) {
      setSheetsVerified(true)
      setSheetsStampInfo({
        verified: true,
        stamp: selectedStamp || 'ВКЯ 1',
        inspector: inspectorName.trim(),
        at: stampTime
      })
    }
  }

  const handleClearAll = () => {
    setStampedOps({})
    setSheetsVerified(false)
    setSheetsStampInfo(null)
  }

  const handleSaveStamps = async () => {
    if (isProcessing) return
    if (!isInspectorValid) {
      alert('Будь ласка, спочатку оберіть або введіть ПІБ контролера ВКЯ, який ставить печатки!')
      return
    }
    setIsProcessing(true)
    try {
      const cleanInspector = inspectorName.trim()
      const cleanStamp = selectedStamp || 'ВКЯ 1'
      try {
        localStorage.setItem('centrum_vkya_stamp', cleanStamp)
        localStorage.setItem('centrum_vkya_inspector', cleanInspector)
      } catch { /* ignore */ }

      const qcPayload = {
        lastStamp: cleanStamp,
        lastInspector: cleanInspector,
        updatedAt: new Date().toISOString(),
        sheets: sheetsVerified ? (sheetsStampInfo || {
          verified: true,
          stamp: cleanStamp,
          inspector: cleanInspector,
          at: nowTimeShort()
        }) : null,
        ops: stampedOps
      }

      const baseInfo = stripQcOpsStamps(currentCard.card_info || '')
      const hasAnyVerification = sheetsVerified || Object.keys(stampedOps).length > 0
      const updatedCardInfo = hasAnyVerification
        ? `${baseInfo} [QC_OPS:${JSON.stringify(qcPayload)}]`.trim()
        : baseInfo

      const stampedNames = Object.values(stampedOps).map(v => `${v.name} (${v.stamp})`)
      const summaryComment = [
        sheetsVerified ? 'Листи відповідають ✓' : null,
        stampedNames.length > 0 ? `Перевірено операцій (${stampedNames.length}/${allItems.length}): ${stampedNames.join('; ')}` : 'Відмітки ВКЯ знято'
      ].filter(Boolean).join(' | ')

      const nowIso = new Date().toISOString()

      const { error: cardErr } = await supabase
        .from('work_cards')
        .update({ card_info: updatedCardInfo })
        .eq('id', currentCard.id)

      if (cardErr) throw cardErr

      const historyEntry = {
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Печатка ВКЯ (Операції)',
        operator_name: `${cleanStamp} · ${cleanInspector}`,
        qty_at_start: currentCard.quantity || 0,
        qty_completed: currentCard.quantity || 0,
        scrap_qty: 0,
        started_at: nowIso,
        completed_at: nowIso,
        shift_name: currentCard.shift_name || null,
        manager_name: currentCard.manager_name || null,
        machine_name: currentCard.machine || null,
        qc_scrap_comment: summaryComment,
        card_info: updatedCardInfo
      }

      const { data: insertedHistory } = await supabase
        .from('work_card_history')
        .insert([historyEntry])
        .select('*')

      if (typeof setWorkCards === 'function') {
        setWorkCards(prev => (prev || []).map(c => c.id === currentCard.id ? { ...c, card_info: updatedCardInfo } : c))
      }
      if (typeof setSelectedCardHistory === 'function' && insertedHistory?.[0]) {
        setSelectedCardHistory(prev => [...(prev || []), insertedHistory[0]])
      }
      if (typeof fetchData === 'function') {
        fetchData(['work_cards', 'work_card_history']).catch(() => {})
      }

      onClose()
      if (typeof showAlert === 'function') {
        showAlert(
          `Печатку ${cleanStamp} (${cleanInspector}) збережено!\nПогоджено операцій: ${Object.keys(stampedOps).length} з ${allItems.length}${sheetsVerified ? '\n✓ Листи відповідають матеріалу' : ''}`,
          '💮 Печатка ВКЯ поставлена'
        )
      }
    } catch (err) {
      alert('Помилка збереження печатки ВКЯ: ' + (err?.message || err))
    } finally {
      setIsProcessing(false)
    }
  }

  const materialLabel = snapshotPart?.raw_material_name || nomenclature?.rule_params?.rawSheet || nomenclature?.material_type || 'Лист за техпроцесом'
  const stampedCount = Object.keys(stampedOps).length
  const totalOpsCount = allItems.length

  const renderSection = (title, items) => {
    if (!items || items.length === 0) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          fontSize: '0.68rem',
          fontWeight: 950,
          color: '#10b981',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '6px 10px',
          background: 'rgba(16, 185, 129, 0.08)',
          borderRadius: '8px',
          borderLeft: '3px solid #10b981'
        }}>
          {title} ({items.filter(it => stampedOps[it.key]).length}/{items.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(item => {
            const stampData = stampedOps[item.key]
            const isChecked = Boolean(stampData)
            return (
              <div
                key={item.key}
                onClick={() => toggleOpStamp(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '11px 14px',
                  borderRadius: '14px',
                  cursor: isInspectorValid ? 'pointer' : 'not-allowed',
                  opacity: isInspectorValid ? 1 : 0.55,
                  background: isChecked ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-inset)',
                  border: isChecked ? '1.5px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border-subtle)',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  {isChecked ? (
                    <CheckSquare size={20} color="#10b981" style={{ flexShrink: 0 }} />
                  ) : (
                    <Square size={20} color="#64748b" style={{ flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: '0.86rem',
                      fontWeight: 850,
                      color: isChecked ? 'var(--text-strong)' : 'var(--text-muted, #94a3b8)',
                      lineHeight: 1.25,
                      wordBreak: 'break-word'
                    }}>
                      {item.name}
                    </div>
                    {isChecked && (
                      <div style={{ fontSize: '0.64rem', color: '#10b981', fontWeight: 800, marginTop: '3px' }}>
                        ✓ Перевірив: {stampData.inspector} · {stampData.at}
                      </div>
                    )}
                  </div>
                </div>

                {/* Візуальна кругла/овальна печатка ВКЯ як на паперовому бланку */}
                {isChecked ? (
                  <div style={{
                    flexShrink: 0,
                    border: '2px double #10b981',
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.12)',
                    borderRadius: '999px',
                    padding: '4px 11px',
                    fontSize: '0.72rem',
                    fontWeight: 1000,
                    letterSpacing: '0.06em',
                    transform: 'rotate(-4deg)',
                    boxShadow: '0 0 0 1px rgba(16,185,129,0.2)',
                    textTransform: 'uppercase'
                  }}>
                    {stampData.stamp}
                  </div>
                ) : (
                  <div style={{
                    flexShrink: 0,
                    border: '1px dashed var(--border-subtle, #475569)',
                    color: 'var(--text-dim, #64748b)',
                    borderRadius: '999px',
                    padding: '4px 10px',
                    fontSize: '0.62rem',
                    fontWeight: 800
                  }}>
                    Поставити {selectedStamp}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 10030,
      padding: '24px 14px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: 'var(--surface-1)',
        width: '100%',
        maxWidth: '640px',
        borderRadius: '26px',
        border: '1.5px solid rgba(16, 185, 129, 0.4)',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45), 0 0 32px rgba(16, 185, 129, 0.12)',
        margin: 'auto 0'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          background: 'var(--surface-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(16, 185, 129, 0.25)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 950, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Stamp size={19} />
              <span>ПЕЧАТКА ВКЯ · ПОГОДЖЕННЯ ОПЕРАЦІЙ КАРТКИ</span>
            </h3>
            <div style={{ fontSize: '0.66rem', color: 'var(--text-dim)', marginTop: '3px', fontWeight: 700 }}>
              Картка #{String(currentCard.id).slice(-8).toUpperCase()} · {nomenclature?.name || 'Деталь'} · {currentCard.machine || 'Верстат'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Вибір номера печатки ВКЯ та ПІБ інспектора */}
          <div style={{
            background: 'var(--surface-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div>
              <label style={{ fontSize: '0.62rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>
                Номер печатки ВКЯ
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {STAMP_OPTIONS.map(stamp => {
                  const active = selectedStamp === stamp
                  return (
                    <button
                      key={stamp}
                      type="button"
                      onClick={() => setSelectedStamp(stamp)}
                      style={{
                        background: active ? '#10b981' : 'var(--surface-2)',
                        color: active ? '#000' : 'var(--text-strong)',
                        border: active ? '1.5px solid #10b981' : '1px solid var(--border-subtle)',
                        borderRadius: '999px',
                        padding: '6px 12px',
                        fontSize: '0.74rem',
                        fontWeight: 950,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      💮 {stamp}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.62rem', fontWeight: 900, color: !isInspectorValid ? '#ef4444' : 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                ПІБ контролера ВКЯ <span style={{ color: '#ef4444' }}>* (обов'язково)</span>
              </label>
              <input
                type="text"
                list="qc-inspectors-datalist"
                placeholder="Спочатку оберіть або введіть ПІБ інспектора ВКЯ..."
                value={inspectorName}
                onChange={e => setInspectorName(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--surface-2)',
                  border: !isInspectorValid ? '1.5px solid #ef4444' : '1px solid var(--border-subtle)',
                  color: 'var(--text-strong)',
                  padding: '11px 13px',
                  borderRadius: '11px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  boxSizing: 'border-box'
                }}
              />
              {!isInspectorValid && (
                <div style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 800, marginTop: '5px' }}>
                  ⚠️ Спочатку вкажіть ПІБ працівника ВКЯ, щоб розблокувати проставлення печаток
                </div>
              )}
              <datalist id="qc-inspectors-datalist">
                {qcStaffList.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
          </div>

          {/* Блок «Листи відповідають» як у шапці друкованої картки */}
          <div
            onClick={toggleSheetsVerified}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '14px',
              cursor: isInspectorValid ? 'pointer' : 'not-allowed',
              opacity: isInspectorValid ? 1 : 0.55,
              background: sheetsVerified ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-inset)',
              border: sheetsVerified ? '1.5px solid #10b981' : '1.5px dashed var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {sheetsVerified ? <CheckSquare size={21} color="#10b981" /> : <Square size={21} color="#64748b" />}
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 950, color: 'var(--text-strong)' }}>
                  Листи відповідають: <span style={{ color: '#10b981' }}>{materialLabel}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 700, marginTop: '2px' }}>
                  {sheetsVerified && sheetsStampInfo
                    ? `Підтверджено: ${sheetsStampInfo.stamp} · ${sheetsStampInfo.inspector} (${sheetsStampInfo.at})`
                    : 'Натисніть для підтвердження відповідності товщини та марки листа'}
                </div>
              </div>
            </div>
            {sheetsVerified && (
              <div style={{
                border: '2px double #10b981',
                color: '#10b981',
                borderRadius: '999px',
                padding: '3px 10px',
                fontSize: '0.7rem',
                fontWeight: 1000,
                transform: 'rotate(-4deg)'
              }}>
                {sheetsStampInfo?.stamp || selectedStamp}
              </div>
            )}
          </div>

          {/* Швидкі дії */}
          {totalOpsCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 900, color: 'var(--text-dim)' }}>
                Погоджено операцій: <strong style={{ color: '#10b981' }}>{stampedCount}</strong> з <strong>{totalOpsCount}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleStampAll}
                  disabled={!isInspectorValid}
                  style={{
                    background: 'rgba(16, 185, 129, 0.14)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#10b981',
                    padding: '6px 12px',
                    borderRadius: '9px',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    cursor: isInspectorValid ? 'pointer' : 'not-allowed',
                    opacity: isInspectorValid ? 1 : 0.45
                  }}
                >
                  ✓ Погодити всі операції
                </button>
                {stampedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: '6px 10px',
                      borderRadius: '9px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Очистити
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Таблиця операцій з техпроцесу */}
          {totalOpsCount === 0 ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              background: 'var(--surface-inset)',
              borderRadius: '14px',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-dim)',
              fontSize: '0.82rem',
              fontWeight: 700
            }}>
              Для цієї деталі ще не заповнено поопераційний список у техпроцесі інженера, але ви можете підтвердити відповідність листів та поставити загальну печатку ВКЯ на картку.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
              {renderSection('Операція (1 сторона)', allItems.filter(i => i.key.startsWith('s1:')))}
              {renderSection('Операція (2 сторона)', allItems.filter(i => i.key.startsWith('s2:')))}
              {renderSection(`Операція (2 сторона вирізка) ${isCutter1_5 ? 'Ф1.5мм' : 'Ф2мм'}`, allItems.filter(i => i.key.startsWith('s2c:')))}
            </div>
          )}

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveStamps}
            disabled={isProcessing || !isInspectorValid}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              padding: '16px',
              borderRadius: '15px',
              fontSize: '1rem',
              fontWeight: 1000,
              cursor: (isProcessing || !isInspectorValid) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 10px 28px rgba(16, 185, 129, 0.3)',
              opacity: (isProcessing || !isInspectorValid) ? 0.45 : 1
            }}
          >
            <FileCheck2 size={20} />
            <span>
              {isProcessing
                ? 'ЗБЕРЕЖЕННЯ ПЕЧАТКИ...'
                : !isInspectorValid
                  ? 'ВКАЖІТЬ ПІБ КОНТРОЛЕРА ВКЯ ДЛЯ ПЕЧАТКИ'
                  : `ПОСТАВИТИ ПЕЧАТКУ ${selectedStamp} (${stampedCount}/${totalOpsCount})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

