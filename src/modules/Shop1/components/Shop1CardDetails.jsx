import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, X, ArrowRight } from 'lucide-react'
import { MACHINE_TYPES, getMachineSequenceConfig, parseQcOpsStamps } from '../utils/shop1Helpers'
import { getPendingRequestsForCard } from '../../../utils/materialCardMatching.js'
import { getCardCuttingPlanSeconds, formatCuttingTime } from '../../../utils/cuttingTimeUtils.js'

export function Shop1CardDetails({
  currentCard,
  setSelectedCardId,
  orders,
  getNom,
  CHAIN,
  nextStageFor,
  qcScrapTotal,
  qcScrapEntries,
  selectedManager,
  setSelectedManager,
  selectedShift,
  setSelectedShift,
  selectedOperator,
  setSelectedOperator,
  selectedMachine,
  setSelectedMachine,
  machineNumber,
  setMachineNumber,
  getFilteredManagers,
  getFilteredOperators,
  handleStart,
  handleResumeCard,
  handleStartNext,
  handleAcceptToStock,
  setShowQCModal,
  setShowQCOpsModal,
  setShowPauseModal,
  setShowShiftChangeModal,
  setShowCompleteModal,
  setShowSortingModal,
  setScrapCount,
  setReworkCount,
  setFinalOperator,
  setCuttersUsed,
  setPauseReason,
  setCustomPauseReason,
  getCardTimeMetrics,
  formatSec,
  formatTime,
  selectedCardHistory,
  workCardHistory,
  isProcessing,
  reworkCount,
  scrapCount,
  requests = [],
  tasks = [],
  nomenclatures = []
}) {
  if (!currentCard) return null

  const nom = getNom(currentCard)
  const chainIdx = CHAIN.indexOf(currentCard.operation)
  const next = nextStageFor(currentCard)
  const isFinal = currentCard.operation === CHAIN[CHAIN.length - 1]
  const { status } = currentCard

  const parentTask = (tasks || []).find(t => String(t.id) === String(currentCard?.task_id))
  const pendingReqsForCard = getPendingRequestsForCard(currentCard, requests || [], parentTask, nomenclatures || [])
  const qcOpsData = parseQcOpsStamps(currentCard.card_info)
  const stampedOpsList = Object.entries(qcOpsData?.ops || {})
  const hasQcOpsStamps = Boolean(qcOpsData?.sheets?.verified || stampedOpsList.length > 0)

  const labelStyle = { fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }
  const selectStyle = { width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }
  const btnPrimary = { background: '#eab308', color: '#000', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '1rem', fontWeight: 1000, cursor: 'pointer' }
  const btnGreen = { background: '#10b981', color: '#fff', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '1rem', fontWeight: 1000, cursor: 'pointer' }

  return (
    <div className="s1-card-detail-view" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '0 12px 140px', boxSizing: 'border-box' }}>

      {/* Хлібні крихти ланцюжка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {CHAIN.map((s, i) => {
          const isCurrent = s === currentCard.operation
          const isDone = i < chainIdx
          return (
            <React.Fragment key={s}>
              <span className={`s1-chain-pill ${isCurrent ? 'current' : isDone ? 'done' : 'inactive'}`} style={{
                fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase',
                padding: '3px 9px', borderRadius: '5px',
                background: isCurrent ? '#eab308' : isDone ? '#10b98120' : 'var(--surface-2)',
                color: isCurrent ? '#000' : isDone ? '#10b981' : '#333'
              }}>{s}</span>
              {i < CHAIN.length - 1 && <ChevronRight size={10} color="#2a2a2a" />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Заголовок */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {nom?.name || 'Деталь'}
          </h2>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 800, marginTop: '6px', textTransform: 'uppercase' }}>
            ЗАМОВЛЕННЯ №{orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'} · Картка #{currentCard.id.slice(-8).toUpperCase()} · {(() => {
              const bz = Number(currentCard.buffer_qty) || Number(currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0
              const need = Number(currentCard.card_info?.match(/\[REQ:(\d+)\]/)?.[1]) || Number(currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Number(currentCard.quantity) - bz)
              if (bz > 0) return `${currentCard.quantity} шт (${need} + ${bz} БЗ)`
              return `${currentCard.quantity} шт`
            })()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentCard.task_id && (
            <Link
              to={`/foreman?task=${currentCard.task_id}`}
              state={{ taskId: currentCard.task_id }}
              style={{ background: '#3b82f615', border: '1px solid #3b82f640', color: '#3b82f6', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              title="Перейти до батьківського наряду">
              📋 <span className="hide-mobile">НАРЯД</span>
            </Link>
          )}
          {setShowQCOpsModal && (
            <button onClick={() => setShowQCOpsModal(true)}
              style={{ background: hasQcOpsStamps ? '#10b98120' : '#10b98115', border: `1px solid ${hasQcOpsStamps ? '#10b98180' : '#10b98145'}`, color: '#10b981', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Погодження операцій розкрою та печатка ВКЯ">
              💮 <span className="hide-mobile">ПЕЧАТКА ВКЯ</span>
              {stampedOpsList.length > 0 && (
                <span style={{ background: '#10b981', color: '#000', borderRadius: '999px', padding: '1px 7px', fontSize: '0.68rem', fontWeight: 1000 }}>
                  {stampedOpsList.length}
                </span>
              )}
            </button>
          )}
          <button onClick={() => setShowQCModal(true)}
            style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Внести додатковий брак ВКЯ">
            🛡️ <span className="hide-mobile">БРАК ВКЯ</span>
          </button>
          <button className="s1-close-btn" onClick={() => setSelectedCardId(null)}
            style={{ background: 'var(--surface-1)', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>
      </div>

      {qcScrapTotal > 0 && (
        <div style={{ background: '#ef444415', border: '1px solid #ef444455', borderRadius: '16px', padding: '14px 16px', marginBottom: '18px' }}>
          <div style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 1000 }}>🛡️ ВКЯ ВЖЕ ВНЕСЛО БРАК: {qcScrapTotal} ШТ</div>
          {(qcScrapEntries || []).slice(0, 3).map(row => (
            <div key={row.id} style={{ color: '#fca5a5', fontSize: '0.68rem', fontWeight: 800, marginTop: '6px' }}>
              {row.completed_at ? new Date(row.completed_at).toLocaleString('uk-UA') : 'Дата не вказана'} · {row.qc_scrap_reason || row.qc_scrap_comment || 'Причина не вказана'} · {Number(row.scrap_qty) || 0} шт · Відповідальний: {row.operator_name || 'не вказаний'}
            </div>
          ))}
          <div style={{ color: 'var(--text-muted)', fontSize: '0.64rem', marginTop: '8px' }}>Поточна кількість картки вже зменшена на цей брак. Повторно його не вносьте.</div>
        </div>
      )}

      {hasQcOpsStamps && (
        <div
          onClick={() => setShowQCOpsModal && setShowQCOpsModal(true)}
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '16px',
            padding: '12px 16px',
            marginBottom: '18px',
            cursor: setShowQCOpsModal ? 'pointer' : 'default'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 1000 }}>
                💮 ПОГОДЖЕНО ВКЯ ({stampedOpsList.length} оп.)
              </span>
              {qcOpsData?.lastStamp && (
                <span style={{
                  border: '2px solid #10b981',
                  color: '#10b981',
                  borderRadius: '999px',
                  padding: '2px 10px',
                  fontSize: '0.68rem',
                  fontWeight: 1000,
                  letterSpacing: '0.04em'
                }}>
                  {qcOpsData.lastStamp}
                </span>
              )}
              {qcOpsData?.sheets?.verified && (
                <span style={{
                  background: 'rgba(16, 185, 129, 0.16)',
                  color: '#10b981',
                  borderRadius: '8px',
                  padding: '2px 8px',
                  fontSize: '0.68rem',
                  fontWeight: 900
                }}>
                  ✓ Листи відповідають ({qcOpsData.sheets.stamp || 'ВКЯ'})
                </span>
              )}
            </div>
            {qcOpsData?.lastInspector && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                Фахівець: <strong style={{ color: 'var(--text-strong)' }}>{qcOpsData.lastInspector}</strong>
              </div>
            )}
          </div>
          {stampedOpsList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {stampedOpsList.map(([key, item]) => (
                <span key={key} style={{
                  background: 'var(--surface-1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  padding: '4px 9px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: 'var(--text-strong)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ color: '#10b981', fontWeight: 1000 }}>[{item.stamp || 'ВКЯ'}]</span>
                  <span>{item.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'var(--fill-subtle)', borderRadius: '24px', border: '1px solid var(--border-subtle)', padding: '25px 20px' }}>

        {/* ── СТАН: NEW / WAITING-CUTTERS / WAITING-MATERIALS → Форма старту ──────────────────────────────────── */}
        {(status === 'new' || status === 'waiting-cutters' || status === 'waiting-materials' || status === 'waiting_material' || (status === 'in-progress' && !CHAIN.includes(currentCard.operation))) && (() => {
          const displayOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0]
          const machineSequenceConfig = getMachineSequenceConfig(selectedMachine)
          return (
            <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Індикатор забезпечення матеріалами / фрезами */}
              {pendingReqsForCard.length > 0 ? (
                <div className="s1-material-pending" style={{ background: '#eab30815', border: '1px solid #eab30840', borderRadius: '16px', padding: '14px 18px', color: '#eab308', fontSize: '0.82rem', fontWeight: 800 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span>⏳</span>
                    <strong>Очікує видачі зі складу ({pendingReqsForCard.length}):</strong>
                  </div>
                  <ul className="s1-material-pending-list" style={{ margin: '4px 0 0 16px', padding: 0, color: '#fef08a', fontSize: '0.75rem', fontWeight: 700 }}>
                    {pendingReqsForCard.map((r, idx) => (
                      <li key={r.id || idx}>{r.details || 'Матеріали / фрези'}</li>
                    ))}
                  </ul>
                  <div className="s1-material-pending-hint" style={{ fontSize: '0.68rem', color: '#a1a1aa', marginTop: '8px' }}>
                    Зверніться на склад для підтвердження видачі.
                  </div>
                </div>
              ) : (
                (status === 'waiting-cutters' || status === 'waiting-materials' || status === 'waiting_material') && (
                  <div className="s1-material-ready" style={{ background: '#10b98115', border: '1px solid #10b98140', borderRadius: '16px', padding: '12px 16px', color: '#10b981', fontSize: '0.82rem', fontWeight: 800, textAlign: 'center' }}>
                    ✓ Матеріали та фрези видані складом. Картка готова до розкрою!
                  </div>
                )
              )}

              {/* Акцентована планова кількість */}
              <div className="s1-planned-quantity" style={{ background: '#eab30810', border: '1px solid #eab30830', borderRadius: '18px', padding: '20px', textAlign: 'center', marginBottom: '8px' }}>
                <div className="s1-planned-quantity-label" style={{ fontSize: '0.65rem', fontWeight: 950, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>ПЛАНОВА КІЛЬКІСТЬ</div>
                <div className="s1-planned-quantity-value" style={{ fontSize: '3rem', fontWeight: 1000, color: 'var(--text-strong)', lineHeight: 1 }}>
                  {currentCard.quantity} <small style={{ fontSize: '1rem', opacity: 0.3 }}>шт</small>
                </div>
              </div>

              <div className="s1-start-heading" style={{ fontSize: '0.72rem', fontWeight: 900, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                СТАРТ · {displayOp?.toUpperCase()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={labelStyle}>Майстер (хто пускає в роботу)</label>
                  <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)} style={selectStyle}>
                    <option value="">— Оберіть майстра —</option>
                    {getFilteredManagers('Цех №1').map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Зміна</label>
                  <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                    <option value="">— Оберіть зміну —</option>
                    <option value="Зміна 1">Зміна 1</option>
                    <option value="Зміна 2">Зміна 2</option>
                    <option value="Зміна 3">Зміна 3</option>
                    <option value="Зміна 4">Зміна 4</option>
                    <option value="Без зміни">Без зміни</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Відповідальний оператор</label>
                  <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                    <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                    {getFilteredOperators('Цех №1', selectedShift, displayOp).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {displayOp === 'Розкрій' && (
                  <div>
                    <label style={labelStyle}>Верстат / обладнання</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input type="text" placeholder="Оберіть або введіть тип верстата..."
                        value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}
                        list="machine-types-list"
                        style={{ ...selectStyle, cursor: 'text', flex: 1 }} />
                      <datalist id="machine-types-list">
                        {MACHINE_TYPES.map(t => <option key={t} value={t} />)}
                      </datalist>
                      <div style={{ position: 'relative', width: '100px' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#eab308', fontWeight: 1000, fontSize: '1.1rem', zIndex: 1 }}>{machineSequenceConfig.prefix || '№'}</span>
                        <input type="number" min={machineSequenceConfig.min} max={machineSequenceConfig.max || undefined} step="1"
                          placeholder={machineSequenceConfig.max ? `${machineSequenceConfig.min}-${machineSequenceConfig.max}` : `${machineSequenceConfig.min}+`}
                          value={machineNumber} onChange={e => setMachineNumber(e.target.value.replace(/\D/g, ''))}
                          style={{
                            ...selectStyle, fontSize: '1.2rem', fontWeight: 1000, color: '#eab308',
                            paddingLeft: machineSequenceConfig.prefix.length > 1 ? '40px' : '32px', width: '100%', cursor: 'text',
                            borderColor: machineNumber ? '#eab308' : 'var(--border-subtle)'
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && selectedOperator && selectedShift && !isProcessing && selectedMachine?.trim() && machineNumber?.trim()) {
                              handleStart()
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {(() => {
                  const isStartDisabled = !selectedOperator || !selectedShift || isProcessing ||
                    (displayOp === 'Розкрій' && (!selectedMachine?.trim() || !machineNumber?.trim()))
                  return (
                    <button onClick={handleStart} disabled={isStartDisabled}
                      style={{ ...btnPrimary, marginTop: '10px', height: '64px', fontSize: '1.2rem', opacity: isStartDisabled ? 0.45 : 1 }}>
                      ▶ ВЗЯТИ В РОБОТУ · {displayOp?.toUpperCase()}
                    </button>
                  )
                })()}
              </div>
            </div>
          )
        })()}

        {/* ── СТАН: IN-PROGRESS або PAUSED ────────────────────────────────── */}
        {((status === 'in-progress' || status === 'paused') && CHAIN.includes(currentCard.operation)) && (() => {
          const opName = currentCard.operation?.toUpperCase()
          const isPaused = status === 'paused'
          const pausedAtStr = currentCard.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1]
          const pauseReasonStr = currentCard.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Невідома причина'

          return (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ padding: '10px 20px', textAlign: 'left', borderRight: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.5rem', color: isPaused ? '#ef4444' : '#3b82f6', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {isPaused ? 'ЗУПИНЕНО' : 'У РОБОТІ'}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 1000, lineHeight: 1.2 }}>{currentCard.quantity} <small style={{ fontSize: '0.6rem', opacity: 0.35 }}>шт</small></div>
                </div>
                <div style={{ padding: '10px 20px', textAlign: 'left', borderRight: currentCard.machine ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ fontSize: '0.5rem', color: 'var(--text-dim)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ЕТАП</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 900, color: isPaused ? '#ef4444' : '#3b82f6', lineHeight: 1.2, marginTop: '2px' }}>{opName}</div>
                </div>
                {currentCard.machine && (
                  <div style={{ padding: '10px 14px', textAlign: 'left', background: isPaused ? 'rgba(239,68,68,0.03)' : '#eab30808', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.5rem', color: isPaused ? '#ef4444' : '#eab308', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>⚙ ВЕРСТАТ</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: isPaused ? '#ef4444' : '#eab308', lineHeight: 1.3, marginTop: '2px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{currentCard.machine}</div>
                  </div>
                )}
              </div>

              {isPaused ? (
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '20px', padding: '20px 24px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 950, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ⚠️ ВЕРСТАТ ЗУПИНЕНО (ПАУЗА)
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-strong)', fontWeight: 700, marginTop: '6px' }}>
                    Причина: <span style={{ color: '#ef4444' }}>{pauseReasonStr}</span>
                  </div>
                  <div style={{ fontSize: '3rem', fontWeight: 1000, color: '#ef4444', fontFamily: 'monospace', marginTop: '10px', lineHeight: 1 }}>
                    {formatTime(pausedAtStr)}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginTop: '4px' }}>
                    ТРИВАЛІСТЬ ЗУПИНКИ
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '4.5rem', fontWeight: 1000, color: '#10b981', fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.05em' }}>
                    {formatSec(getCardTimeMetrics(currentCard).totalSec)}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', opacity: 0.8 }}>
                    ЗАГАЛЬНИЙ ЧАС НА ЕТАПІ
                  </div>
                </div>
              )}

              {currentCard.operation === 'Розкрій' && (() => {
                const planSec = getCardCuttingPlanSeconds(currentCard, nom)
                if (!planSec || planSec <= 0) return null
                const totalSec = getCardTimeMetrics(currentCard).totalSec
                const isOvertime = totalSec > planSec
                const percent = Math.min(100, Math.round((totalSec / planSec) * 100))
                const remainingSec = Math.max(0, planSec - totalSec)
                const overtimeSec = totalSec - planSec

                return (
                  <div style={{
                    margin: '16px auto 0',
                    maxWidth: '380px',
                    background: isOvertime ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    border: `1px solid ${isOvertime ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    borderRadius: '16px',
                    padding: '12px 16px',
                    textAlign: 'left'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: isOvertime ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⏱ Плановий час розкрою
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 1000, color: 'var(--text-strong)' }}>
                        {formatCuttingTime(planSec)}
                      </span>
                    </div>

                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: isOvertime ? '#ef4444' : '#10b981',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: 800 }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Факт: <strong style={{ color: isOvertime ? '#ef4444' : '#10b981' }}>{formatSec(totalSec)}</strong>
                      </span>
                      {isOvertime ? (
                        <span style={{ color: '#ef4444', fontWeight: 900 }}>
                          ⚠️ Перевищення: +{formatSec(overtimeSec)}
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 800 }}>
                          Залишок: ~{formatCuttingTime(remainingSec)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div style={{
                margin: '20px auto 10px',
                padding: '12px 20px',
                background: 'var(--fill-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '16px',
                maxWidth: '380px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>ПОТОЧНИЙ ОПЕРАТОР</div>
                  <div style={{ color: 'var(--text-strong)', fontSize: '0.85rem', fontWeight: 900, marginTop: '2px' }}>{currentCard.operator_name || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>
                    {isPaused ? 'АКТИВНИЙ ЧАС' : 'ЧАС ЗМІНИ'}
                  </div>
                  <div style={{ color: isPaused ? 'var(--text-dim)' : '#eab308', fontSize: '1.1rem', fontWeight: 900, fontFamily: 'monospace', marginTop: '2px' }}>
                    {isPaused ? formatSec(getCardTimeMetrics(currentCard).totalSec) : formatTime(currentCard.started_at)}
                  </div>
                </div>
              </div>

              {currentCard.card_info?.includes('[LAST_OP:') && (() => {
                const lastOp = currentCard.card_info?.match(/\[LAST_OP:([^\]]+)\]/)?.[1]
                if (!lastOp) return null
                return (
                  <div style={{
                    margin: '10px auto 0',
                    maxWidth: '380px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.28)',
                    borderRadius: '12px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textAlign: 'left'
                  }}>
                    <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>📍</span>
                    <div>
                      <div style={{ fontSize: '0.55rem', color: '#f59e0b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Зупинилися при перезмінці
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-strong)', fontWeight: 800, marginTop: '2px' }}>
                        {lastOp}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {currentCard.operation === 'Розкрій' && (() => {
                const stageRunStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1]
                  || currentCard.started_at
                const stageRunStartMs = stageRunStart ? new Date(stageRunStart).getTime() : 0

                const shiftHistory = (selectedCardHistory.length > 0 ? selectedCardHistory : workCardHistory || []).filter(h =>
                  String(h.card_id) === String(currentCard.id) &&
                  h.stage_name === 'Розкрій (перезмінка)' &&
                  h.completed_at && new Date(h.completed_at).getTime() >= stageRunStartMs
                ).sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
                if (shiftHistory.length === 0) return null

                const formatMsToDuration = (start, end) => {
                  const diffSec = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000))
                  const hrs = Math.floor(diffSec / 3600)
                  const mins = Math.floor((diffSec % 3600) / 60)
                  const secs = diffSec % 60
                  return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':')
                }

                return (
                  <div style={{ margin: '15px auto 0', maxWidth: '380px', background: 'var(--surface-inset)', border: '1px solid #18181b', borderRadius: '16px', padding: '14px 18px' }}>
                    <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.08em', textAlign: 'left' }}>
                      ⏱️ ЧАС ПОПЕРЕДНІХ ЗМІН
                    </div>
                    {shiftHistory.map((h, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < shiftHistory.length - 1 ? '1px solid #18181b' : 'none' }}>
                        <div style={{ textAlign: 'left' }}>
                          <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 700 }}>#{i + 1} {h.operator_name}</span>
                          <span style={{ fontSize: '0.6rem', color: '#52525b', fontWeight: 700, marginLeft: '8px' }}>{h.shift_name}</span>
                          {h.card_info?.includes('[LAST_OP:') && (
                            <div style={{ fontSize: '0.62rem', color: '#f59e0b', marginTop: '2px', fontWeight: 700 }}>
                              📍 {h.card_info?.match(/\[LAST_OP:([^\]]+)\]/)?.[1]}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#71717a', fontWeight: 800, fontFamily: 'monospace' }}>
                          {formatMsToDuration(h.started_at, h.completed_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}

              <div style={{ marginBottom: '25px' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '25px', background: '#f59e0b0d', border: '1px solid #f59e0b22', borderRadius: '14px', padding: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 700 }}>{currentCard.operation}</span>
                <ArrowRight size={12} color="#f59e0b" />
                <span style={{ fontSize: '0.6rem', background: '#f59e0b', color: '#000', fontWeight: 900, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                  БУФЕР {currentCard.operation?.toUpperCase()}
                </span>
                {!isFinal && (
                  <>
                    <ArrowRight size={12} color="#444" />
                    <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 700 }}>{next}</span>
                  </>
                )}
              </div>

              {isPaused ? (
                <button
                  onClick={handleResumeCard}
                  disabled={isProcessing}
                  style={{
                    background: '#10b981', color: '#000', border: 'none', padding: '20px', width: '100%',
                    borderRadius: '18px', fontSize: '1.25rem', fontWeight: 1000, cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '10px'
                  }}
                >
                  ▶️ ЗАПУСТИТИ ВЕРСТАТ (ПРОДОВЖИТИ)
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {currentCard.operation === 'Розкрій' && (
                      <button
                        onClick={() => setShowShiftChangeModal(true)}
                        style={{
                          background: 'transparent', color: '#f59e0b', border: '2px solid #f59e0b40',
                          padding: '14px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 900,
                          cursor: 'pointer', letterSpacing: '0.04em', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                        }}
                      >
                        🔄 ПЕРЕЗМІНКА
                      </button>
                    )}
                    {currentCard.operation === 'Розкрій' && (
                      <button
                        onClick={() => {
                          setPauseReason('Поломка верстата')
                          setCustomPauseReason('')
                          setShowPauseModal(true)
                        }}
                        style={{
                          background: 'transparent', color: '#ef4444', border: '2px solid #ef444440',
                          padding: '14px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: 900,
                          cursor: 'pointer', letterSpacing: '0.04em', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: '8px', transition: 'all 0.2s'
                        }}
                      >
                        🛑 ЗУПИНИТИ ВЕРСТАТ (ПАУЗА)
                      </button>
                    )}
                  </div>

                  <button onClick={() => {
                    if (currentCard.operation === 'Сортування') {
                      setScrapCount(0)
                      setReworkCount(0)
                      setShowSortingModal(true)
                    } else {
                      setScrapCount(0)
                      setFinalOperator('')
                      setCuttersUsed(0)
                      setShowCompleteModal(true)
                    }
                  }}
                    style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '22px', width: '100%', borderRadius: '18px', fontSize: '1.3rem', fontWeight: 1000, cursor: 'pointer', boxShadow: '0 10px 30px rgba(139,92,246,0.3)' }}>
                    {currentCard.operation === 'Сортування' ? '🚀 ЗАВЕРШИТИ СОРТУВАННЯ → ЦЕХ №2' : isFinal ? '✓ ПРИЙНЯТО' : `ЗАВЕРШИТИ ${opName}`}
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── СТАН: AT-BUFFER(Сортування) ────────────────────────────────── */}
        {status === 'at-buffer' && currentCard.operation === 'Сортування' && (() => {
          return (
            <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div style={{ background: '#8b5cf610', border: '1px solid #8b5cf630', borderRadius: '24px', padding: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 950, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
                  🔵 СОРТУВАННЯ — ГОТОВО ДО ВІДПРАВКИ В ЦЕХ №2
                </div>
                <div style={{ fontSize: '3.5rem', fontWeight: 1000, color: 'var(--text-strong)', lineHeight: 1 }}>
                  {currentCard.quantity} <small style={{ fontSize: '1.2rem', opacity: 0.3 }}>шт</small>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '8px', fontWeight: 700 }}>
                  Відскануйте картку для підтвердження сортування
                </div>
              </div>

              <div style={{ background: 'var(--surface-inset)', borderRadius: '20px', padding: '20px', textAlign: 'center', border: '1px solid #ef444422' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ БРАКУ ПРИ СОРТУВАННІ
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity - reworkCount} value={scrapCount === 0 ? '' : scrapCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value
                      setScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - reworkCount, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setScrapCount(v => Math.min(currentCard.quantity - reworkCount, v + 1))}
                    style={{ width: '46px', height: '46px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
              </div>

              <div style={{ background: 'var(--surface-inset)', borderRadius: '20px', padding: '20px', textAlign: 'center', border: '1px solid #f59e0b22' }}>
                <label style={{ color: '#f59e0b', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ НА ДООПРАЦЮВАННЯ (ДОДАТКОВА КАРТКА)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setReworkCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity - scrapCount} value={reworkCount === 0 ? '' : reworkCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value
                      setReworkCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - scrapCount, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setReworkCount(v => Math.min(currentCard.quantity - scrapCount, v + 1))}
                    style={{ width: '46px', height: '46px', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-strong)', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={labelStyle}>Зміна</label>
                <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                  <option value="">— Оберіть зміну —</option>
                  <option value="Зміна 1">Зміна 1</option>
                  <option value="Зміна 2">Зміна 2</option>
                  <option value="Зміна 3">Зміна 3</option>
                  <option value="Зміна 4">Зміна 4</option>
                  <option value="Без зміни">Без зміни</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Відповідальний за сортування</label>
                <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                  <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                  {getFilteredOperators('Сортування', selectedShift, 'Сортування').map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <button onClick={() => setShowSortingModal(true)} disabled={!selectedOperator || !selectedShift || isProcessing}
                style={{
                  ...btnPrimary, width: '100%', height: '64px', fontSize: '1.2rem',
                  opacity: (!selectedOperator || !selectedShift || isProcessing) ? 0.5 : 1
                }}>
                🚀 ПІДТВЕРДИТИ СОРТУВАННЯ ({Math.max(0, currentCard.quantity - scrapCount - reworkCount)} шт)
              </button>
            </div>
          )
        })()}

        {/* ── СТАН: AT-BUFFER ────────────────────────────────────────────── */}
        {status === 'at-buffer' && currentCard.operation !== 'Сортування' && (() => {
          const nextOp = next
          return (
            <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: '24px', padding: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 950, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
                  БУФЕР · ОЧІКУЄ {nextOp?.toUpperCase()}
                </div>
                <div style={{ fontSize: '3.5rem', fontWeight: 1000, color: 'var(--text-strong)', lineHeight: 1 }}>
                  {currentCard.quantity} <small style={{ fontSize: '1.2rem', opacity: 0.3 }}>шт</small>
                </div>
              </div>

              {nextOp === 'Прийомка' ? (
                <div className="s1-action-card" style={{ background: 'var(--surface-1)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 900, marginBottom: '20px', textTransform: 'uppercase', textAlign: 'center' }}>
                    📦 ПРИЙНЯТИ НА СКЛАД НФ (ПРИЙОМКА)
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={labelStyle}>Зміна</label>
                    <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                      <option value="">— Оберіть зміну —</option>
                      <option value="Зміна 1">Зміна 1</option>
                      <option value="Зміна 2">Зміна 2</option>
                      <option value="Зміна 3">Зміна 3</option>
                      <option value="Зміна 4">Зміна 4</option>
                      <option value="Без зміни">Без зміни</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>Відповідальний за прийомку</label>
                    {(() => {
                      const receptionOps = getFilteredOperators('Цех №1', selectedShift, 'Прийомка') || []
                      const availableOps = receptionOps.length > 0 ? receptionOps : (getFilteredOperators('Цех №1', selectedShift) || [])
                      return (
                        <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                          <option value="">{selectedShift ? (availableOps.length > 0 ? '— Оберіть оператора (або Команда) —' : 'Команда') : '— Спочатку оберіть зміну —'}</option>
                          {availableOps.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )
                    })()}
                  </div>
                  <button onClick={handleAcceptToStock} disabled={!selectedShift || isProcessing}
                    style={{
                      background: '#10b981', color: '#fff', border: 'none', width: '100%',
                      height: '64px', borderRadius: '16px', fontSize: '1.3rem', fontWeight: 1000,
                      cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: '0 10px 30px rgba(16,185,129,0.2)',
                      opacity: (!selectedShift || isProcessing) ? 0.5 : 1
                    }}>
                    ✅ ВІДПРАВИТИ В ПРИЙОМКУ
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.65rem', color: '#444', fontWeight: 600 }}>
                    Картка перейде в Прийомку, де її відсканують для взяття в роботу на Сортування
                  </div>
                </div>
              ) : (
                <div className="s1-action-card" style={{ background: 'var(--surface-1)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, marginBottom: '20px', textTransform: 'uppercase', textAlign: 'center' }}>
                    НАСТУПНИЙ ЕТАП: <span style={{ color: '#f59e0b' }}>{nextOp}</span>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={labelStyle}>Зміна</label>
                    <select value={selectedShift} onChange={e => setSelectedShift(e.target.value)} style={selectStyle}>
                      <option value="">— Оберіть зміну —</option>
                      <option value="Зміна 1">Зміна 1</option>
                      <option value="Зміна 2">Зміна 2</option>
                      <option value="Зміна 3">Зміна 3</option>
                      <option value="Зміна 4">Зміна 4</option>
                      <option value="Без зміни">Без зміни</option>
                    </select>
                  </div>

                  {!nextOp?.startsWith('Галтовка') && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={labelStyle}>Відповідальний за {nextOp}</label>
                      <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                        <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                        {getFilteredOperators('Цех №1', selectedShift, nextOp).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  )}

                  <button onClick={handleStartNext} disabled={((nextOp?.startsWith('Галтовка') ? !selectedShift : !selectedOperator) || isProcessing)}
                    style={{
                      ...btnGreen, width: '100%', height: '64px', fontSize: '1.2rem',
                      opacity: ((nextOp?.startsWith('Галтовка') ? !selectedShift : !selectedOperator) || isProcessing) ? 0.5 : 1
                    }}>
                    ▶ ВЗЯТИ В {nextOp?.toUpperCase()}
                  </button>
                </div>
              )}
            </div>
          )
        })()}

      </div>
    </div>
  )
}
