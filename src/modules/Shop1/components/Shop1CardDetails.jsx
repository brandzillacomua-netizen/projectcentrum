import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, X, ArrowRight, Play, Square, Pause } from 'lucide-react'
import { CHAIN, MACHINE_TYPES } from '../hooks/useShop1Data'

export function Shop1CardDetails({
  currentCard,
  setSelectedCardId,
  selectedOperator,
  setSelectedOperator,
  selectedMachine,
  setSelectedMachine,
  machineNumber,
  setMachineNumber,
  selectedManager,
  setSelectedManager,
  selectedShift,
  setSelectedShift,
  galtPriority,
  setGaltPriority,
  getNom,
  getCardTimeMetrics,
  formatSec,
  formatTime,
  orders,
  tasks,
  workCardHistory,
  getFilteredManagers,
  getFilteredOperators,
  handleStart,
  handleResumeCard,
  handleStartNext,
  setShowCompleteModal,
  setShowPauseModal,
  setShowShiftChangeModal,
  setShowQCModal,
  isProcessing,
  systemUsers,
  formatUserName
}) {
  if (!currentCard) return null
  const nom = getNom(currentCard)
  const chainIdx = CHAIN.indexOf(currentCard.operation)
  const next = (() => {
    const op = currentCard?.operation || ''
    if (op === 'Галтовка') return 'Прийомка'
    const i = CHAIN.indexOf(op)
    return i >= 0 && i < CHAIN.length - 1 ? CHAIN[i + 1] : null
  })()
  const isFinal = currentCard.operation === CHAIN[CHAIN.length - 1]
  const { status } = currentCard

  const labelStyle = { fontSize: '0.6rem', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }
  const selectStyle = { width: '100%', background: '#1a1a1a', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }
  const btnPrimary = { background: '#eab308', color: '#000', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '1rem', fontWeight: 1000, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }
  const btnGreen = { background: '#10b981', color: '#fff', border: 'none', padding: '15px', borderRadius: '14px', fontSize: '1rem', fontWeight: 1000, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      {/* Хлібні крихти ланцюжка */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {CHAIN.map((s, i) => {
          const isCurrent = s === currentCard.operation
          const isDone = i < chainIdx
          return (
            <React.Fragment key={s}>
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 950,
                textTransform: 'uppercase',
                padding: '3px 9px',
                borderRadius: '5px',
                background: isCurrent ? '#eab308' : isDone ? '#10b98120' : '#1a1a1a',
                color: isCurrent ? '#000' : isDone ? '#10b981' : '#333'
              }}>
                {s}
              </span>
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
              title="Перейти до батьківського наряду"
            >
              📋 <span className="hide-mobile">НАРЯД</span>
            </Link>
          )}
          <button
            onClick={() => setShowQCModal(true)}
            style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Внести додатковий брак ВКЯ"
          >
            🛡️ <span className="hide-mobile">БРАК ВКЯ</span>
          </button>
          <button
            onClick={() => setSelectedCardId(null)}
            style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid #1a1a1a', padding: '25px 20px' }}>
        {/* ── СТАН: NEW → Форма старту ──────────────────────────────────── */}
        {(status === 'new' || (status === 'in-progress' && !CHAIN.includes(currentCard.operation))) && (() => {
          const displayOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0]
          return (
            <div style={{ maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                      <input
                        type="text"
                        placeholder="Оберіть або введіть тип верстата..."
                        value={selectedMachine}
                        onChange={e => setSelectedMachine(e.target.value)}
                        list="machine-types-list"
                        style={{ ...selectStyle, cursor: 'text', flex: 1 }}
                      />
                      <datalist id="machine-types-list">
                        {MACHINE_TYPES.map(t => <option key={t} value={t} />)}
                      </datalist>
                      <div style={{ position: 'relative', width: '90px' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontWeight: 1000, fontSize: '1.1rem' }}>№</span>
                        <input
                          type="text"
                          placeholder="1-88"
                          value={machineNumber}
                          onChange={e => setMachineNumber(e.target.value)}
                          style={{
                            ...selectStyle,
                            fontSize: '1.2rem',
                            fontWeight: 1000,
                            color: '#eab308',
                            paddingLeft: '32px',
                            width: '100%',
                            cursor: 'text',
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
                    <button
                      onClick={handleStart}
                      disabled={isStartDisabled}
                      style={{ ...btnPrimary, marginTop: '10px', height: '64px', fontSize: '1.2rem', opacity: isStartDisabled ? 0.45 : 1 }}
                    >
                      <Play size={18} /> ▶ ВЗЯТИ В РОБОТУ · {displayOp?.toUpperCase()}
                    </button>
                  )
                })()}
              </div>
            </div>
          )
        })()}

        {/* ── СТАН: IN-PROGRESS або PAUSED (якщо вже в CHAIN) → Таймер + завершити ── */}
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

              {/* Попередні оператори */}
              {currentCard.operation === 'Розкрій' && (() => {
                const stageRunStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || currentCard.started_at
                const stageRunStartMs = stageRunStart ? new Date(stageRunStart).getTime() : 0

                const shiftHistory = (workCardHistory || []).filter(h =>
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
                  style={{ background: '#10b981', color: '#000', border: 'none', padding: '20px', width: '100%', borderRadius: '18px', fontSize: '1.25rem', fontWeight: 1000, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 8px 25px rgba(16,185,129,0.3)' }}
                >
                  ▶ ВІДНОВИТИ РОБОТУ ВЕРСТАТА
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    {currentCard.operation === 'Розкрій' && (
                      <button
                        onClick={() => setShowShiftChangeModal(true)}
                        disabled={isProcessing}
                        style={{ flex: 1, background: '#1f1f1f', border: '1px solid #333', color: '#fff', padding: '18px', borderRadius: '16px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        👥 ПЕРЕЗМІНКА
                      </button>
                    )}
                    {currentCard.operation === 'Розкрій' && (
                      <button
                        onClick={() => setShowPauseModal(true)}
                        disabled={isProcessing}
                        style={{ flex: 1, background: '#ef444410', border: '1px solid #ef444430', color: '#ef4444', padding: '18px', borderRadius: '16px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Pause size={18} /> ЗУПИНИТИ (ПАУЗА)
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setShowCompleteModal(true)}
                    disabled={isProcessing}
                    style={{ ...btnGreen, height: '72px', fontSize: '1.3rem', width: '100%', borderRadius: '20px', boxShadow: '0 12px 30px rgba(16,185,129,0.25)' }}
                  >
                    <Square size={20} /> ✓ ЗАВЕРШИТИ ЕТАП ТА ЗДАТИ В БУФЕР
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── СТАН: AT-BUFFER → Передача далі ───────────────────────────── */}
        {status === 'at-buffer' && (() => {
          const isGaltBuf = currentCard.operation === 'Розкрій'
          const isSortingBuf = currentCard.operation === 'Прийомка'
          return (
            <div style={{ textAlign: 'center', maxWidth: '520px', margin: '0 auto' }}>
              <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: '20px', padding: '24px 20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 950, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  ДЕТАЛЕЙ У БУФЕРІ
                </div>
                <div style={{ fontSize: '3.5rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>
                  {currentCard.quantity} <small style={{ fontSize: '1.2rem', opacity: 0.3 }}>шт</small>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#555', fontWeight: 800, marginTop: '8px', textTransform: 'uppercase' }}>
                  після етапу: <strong style={{ color: '#fff' }}>{currentCard.operation}</strong>
                </div>
              </div>

              {isGaltBuf ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700, marginBottom: '5px' }}>
                    Ці деталі знаходяться в буфері розкрою. Оберіть пріоритет галтовки перед початком етапу:
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    {[1, 2, 3].map(p => {
                      const colors = { 1: '#ef4444', 2: '#3b82f6', 3: '#10b981' }
                      const names = { 1: 'ВИСОКИЙ', 2: 'СЕРЕДНІЙ', 3: 'НИЗЬКИЙ' }
                      const activePri = galtPriority === p
                      return (
                        <button
                          key={p}
                          onClick={() => setGaltPriority(p)}
                          style={{
                            flex: 1,
                            background: activePri ? colors[p] : '#111',
                            color: activePri ? '#000' : '#888',
                            border: `1px solid ${activePri ? colors[p] : '#333'}`,
                            padding: '12px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: 950,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {names[p]}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleStartNext}
                    disabled={isProcessing}
                    style={{ ...btnPrimary, height: '64px', fontSize: '1.15rem' }}
                  >
                    ▶ ЗАПУСТИТИ ГАЛТОВКУ
                  </button>
                </div>
              ) : isSortingBuf ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                      <label style={labelStyle}>Оператор сортування</label>
                      <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5 }}>
                        <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                        {getFilteredOperators('Цех №1', selectedShift, 'Сортування').map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleStartNext}
                    disabled={!selectedOperator || !selectedShift || isProcessing}
                    style={{ ...btnPrimary, height: '64px', fontSize: '1.15rem', opacity: (!selectedOperator || !selectedShift || isProcessing) ? 0.5 : 1 }}
                  >
                    ▶ ВЗЯТИ НА СОРТУВАННЯ
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {next === 'Прийомка' ? (
                    <button
                      onClick={handleStartNext}
                      disabled={isProcessing}
                      style={{ ...btnGreen, height: '64px', fontSize: '1.15rem' }}
                    >
                      ✓ ПРИЙНЯТИ НА СКЛАД
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                          <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ ...selectStyle, opacity: selectedShift ? 1 : 0.5 }}>
                            <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                            {getFilteredOperators('Цех №1', selectedShift, next).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={handleStartNext}
                        disabled={!selectedOperator || !selectedShift || isProcessing}
                        style={{ ...btnPrimary, height: '64px', fontSize: '1.15rem', opacity: (!selectedOperator || !selectedShift || isProcessing) ? 0.5 : 1 }}
                      >
                        ▶ ЗАПУСТИТИ НАСТУПНИЙ ЕТАП ({next})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
