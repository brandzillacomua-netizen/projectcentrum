import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, X, ArrowRight } from 'lucide-react'
import { MACHINE_TYPES, getMachineSequenceConfig } from '../utils/shop1Helpers'
import { getPendingRequestsForCard } from '../../../utils/materialCardMatching.js'

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

  const labelStyle = { fontSize: '0.6rem', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }
  const selectStyle = { width: '100%', background: '#1a1a1a', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }
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
                background: isCurrent ? '#eab308' : isDone ? '#10b98120' : '#1a1a1a',
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
          <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 800, marginTop: '6px', textTransform: 'uppercase' }}>
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
          <button onClick={() => setShowQCModal(true)}
            style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Внести додатковий брак ВКЯ">
            🛡️ <span className="hide-mobile">БРАК ВКЯ</span>
          </button>
          <button className="s1-close-btn" onClick={() => setSelectedCardId(null)}
            style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
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
          <div style={{ color: '#888', fontSize: '0.64rem', marginTop: '8px' }}>Поточна кількість картки вже зменшена на цей брак. Повторно його не вносьте.</div>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid #1a1a1a', padding: '25px 20px' }}>

        {/* ── СТАН: NEW / WAITING-CUTTERS / WAITING-MATERIALS → Форма старту ──────────────────────────────────── */}
        {(status === 'new' || status === 'waiting-cutters' || status === 'waiting-materials' || status === 'waiting_material' || (status === 'in-progress' && !CHAIN.includes(currentCard.operation))) && (() => {
          const displayOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0]
          const machineSequenceConfig = getMachineSequenceConfig(selectedMachine)
          return (
            <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Індикатор забезпечення матеріалами / фрезами */}
              {pendingReqsForCard.length > 0 ? (
                <div style={{ background: '#eab30815', border: '1px solid #eab30840', borderRadius: '16px', padding: '14px 18px', color: '#eab308', fontSize: '0.82rem', fontWeight: 800 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span>⏳</span>
                    <strong>Очікує видачі зі складу ({pendingReqsForCard.length}):</strong>
                  </div>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#fef08a', fontSize: '0.75rem', fontWeight: 700 }}>
                    {pendingReqsForCard.map((r, idx) => (
                      <li key={r.id || idx}>{r.details || 'Матеріали / фрези'}</li>
                    ))}
                  </ul>
                  <div style={{ fontSize: '0.68rem', color: '#a1a1aa', marginTop: '8px' }}>
                    Зверніться на склад для підтвердження видачі.
                  </div>
                </div>
              ) : (
                (status === 'waiting-cutters' || status === 'waiting-materials' || status === 'waiting_material') && (
                  <div style={{ background: '#10b98115', border: '1px solid #10b98140', borderRadius: '16px', padding: '12px 16px', color: '#10b981', fontSize: '0.82rem', fontWeight: 800, textAlign: 'center' }}>
                    ✓ Матеріали та фрези видані складом. Картка готова до розкрою!
                  </div>
                )
              )}

              {/* Акцентована планова кількість */}
              <div style={{ background: '#eab30810', border: '1px solid #eab30830', borderRadius: '18px', padding: '20px', textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 950, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>ПЛАНОВА КІЛЬКІСТЬ</div>
                <div style={{ fontSize: '3rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                  {currentCard.quantity} <small style={{ fontSize: '1rem', opacity: 0.3 }}>шт</small>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
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
                            borderColor: machineNumber ? '#eab308' : '#333'
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
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', background: '#0f0f0f', border: '1px solid #222', borderRadius: '16px', marginBottom: '24px', overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ padding: '10px 20px', textAlign: 'left', borderRight: '1px solid #222' }}>
                  <div style={{ fontSize: '0.5rem', color: isPaused ? '#ef4444' : '#3b82f6', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {isPaused ? 'ЗУПИНЕНО' : 'У РОБОТІ'}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 1000, lineHeight: 1.2 }}>{currentCard.quantity} <small style={{ fontSize: '0.6rem', opacity: 0.35 }}>шт</small></div>
                </div>
                <div style={{ padding: '10px 20px', textAlign: 'left', borderRight: currentCard.machine ? '1px solid #222' : 'none' }}>
                  <div style={{ fontSize: '0.5rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ЕТАП</div>
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
                  <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700, marginTop: '6px' }}>
                    Причина: <span style={{ color: '#ef4444' }}>{pauseReasonStr}</span>
                  </div>
                  <div style={{ fontSize: '3rem', fontWeight: 1000, color: '#ef4444', fontFamily: 'monospace', marginTop: '10px', lineHeight: 1 }}>
                    {formatTime(pausedAtStr)}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#888', fontWeight: 800, textTransform: 'uppercase', marginTop: '4px' }}>
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

              <div style={{
                margin: '20px auto 10px',
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid #222',
                borderRadius: '16px',
                maxWidth: '380px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#555', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>ПОТОЧНИЙ ОПЕРАТОР</div>
                  <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 900, marginTop: '2px' }}>{currentCard.operator_name || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#555', fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase' }}>
                    {isPaused ? 'АКТИВНИЙ ЧАС' : 'ЧАС ЗМІНИ'}
                  </div>
                  <div style={{ color: isPaused ? '#666' : '#eab308', fontSize: '1.1rem', fontWeight: 900, fontFamily: 'monospace', marginTop: '2px' }}>
                    {isPaused ? formatSec(getCardTimeMetrics(currentCard).totalSec) : formatTime(currentCard.started_at)}
                  </div>
                </div>
              </div>

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
                  <div style={{ margin: '15px auto 0', maxWidth: '380px', background: '#09090b', border: '1px solid #18181b', borderRadius: '16px', padding: '14px 18px' }}>
                    <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.08em', textAlign: 'left' }}>
                      ⏱️ ЧАС ПОПЕРЕДНІХ ЗМІН
                    </div>
                    {shiftHistory.map((h, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < shiftHistory.length - 1 ? '1px solid #18181b' : 'none' }}>
                        <div style={{ textAlign: 'left' }}>
                          <span style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 700 }}>#{i + 1} {h.operator_name}</span>
                          <span style={{ fontSize: '0.6rem', color: '#52525b', fontWeight: 700, marginLeft: '8px' }}>{h.shift_name}</span>
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
                <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 700 }}>{currentCard.operation}</span>
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
                <div style={{ fontSize: '3.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                  {currentCard.quantity} <small style={{ fontSize: '1.2rem', opacity: 0.3 }}>шт</small>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#8b5cf6', marginTop: '8px', fontWeight: 700 }}>
                  Відскануйте картку для підтвердження сортування
                </div>
              </div>

              <div style={{ background: '#0d0d0d', borderRadius: '20px', padding: '20px', textAlign: 'center', border: '1px solid #ef444422' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ БРАКУ ПРИ СОРТУВАННІ
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity - reworkCount} value={scrapCount === 0 ? '' : scrapCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value
                      setScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - reworkCount, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setScrapCount(v => Math.min(currentCard.quantity - reworkCount, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
              </div>

              <div style={{ background: '#0d0d0d', borderRadius: '20px', padding: '20px', textAlign: 'center', border: '1px solid #f59e0b22' }}>
                <label style={{ color: '#f59e0b', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ НА ДООПРАЦЮВАННЯ (ДОДАТКОВА КАРТКА)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setReworkCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity - scrapCount} value={reworkCount === 0 ? '' : reworkCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value
                      setReworkCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity - scrapCount, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setReworkCount(v => Math.min(currentCard.quantity - scrapCount, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
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
                <div style={{ fontSize: '3.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                  {currentCard.quantity} <small style={{ fontSize: '1.2rem', opacity: 0.3 }}>шт</small>
                </div>
              </div>

              {nextOp === 'Прийомка' ? (
                <div className="s1-action-card" style={{ background: '#111', padding: '24px', borderRadius: '20px', border: '1px solid #222' }}>
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
                    <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                      <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                      {getFilteredOperators('Прийомка', selectedShift, 'Прийомка').map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <button onClick={handleAcceptToStock} disabled={!selectedOperator || !selectedShift || isProcessing}
                    style={{
                      background: '#10b981', color: '#fff', border: 'none', width: '100%',
                      height: '64px', borderRadius: '16px', fontSize: '1.3rem', fontWeight: 1000,
                      cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: '0 10px 30px rgba(16,185,129,0.2)',
                      opacity: (!selectedOperator || isProcessing) ? 0.5 : 1
                    }}>
                    ✅ ВІДПРАВИТИ В ПРИЙОМКУ
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.65rem', color: '#444', fontWeight: 600 }}>
                    Картка перейде в Прийомку, де її відсканують для взяття в роботу на Сортування
                  </div>
                </div>
              ) : (
                <div className="s1-action-card" style={{ background: '#111', padding: '24px', borderRadius: '20px', border: '1px solid #222' }}>
                  <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800, marginBottom: '20px', textTransform: 'uppercase', textAlign: 'center' }}>
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
