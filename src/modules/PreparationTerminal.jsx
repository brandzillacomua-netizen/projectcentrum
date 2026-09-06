import React from 'react'
import {
  Tablet, ArrowLeft, Play, CheckCircle,
  X, Menu, ClipboardList
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePreparationData } from './Preparation/hooks/usePreparationData'

const PreparationTerminal = () => {
  const {
    prepSubTasks,
    currentSubTask,
    selectedSubTaskId,
    setSelectedSubTaskId,
    selectedShift,
    setSelectedShift,
    selectedOperator,
    setSelectedOperator,
    currentTime,
    isProcessing,
    isDrawerOpen,
    setIsDrawerOpen,
    showCompleteModal,
    setShowCompleteModal,
    completeQty,
    setCompleteQty,
    scrapQty,
    setScrapQty,
    scrapReason,
    setScrapReason,
    prepOperators,
    formatElapsedTime,
    handleSelectSubTask,
    handleStart,
    handleCompleteClick,
    submitCompletion,
    setHasUserDeselected
  } = usePreparationData()


  const renderQueue = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
      {prepSubTasks.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>
          Немає активних завдань
        </div>
      )}
      {prepSubTasks.map(sub => {
        const isActive = selectedSubTaskId === sub.id
        return (
          <div
            key={sub.id}
            onClick={() => handleSelectSubTask(sub.id)}
            style={{
              background: isActive ? '#10b981' : '#1a1a1a',
              borderRadius: '12px',
              padding: '15px',
              marginBottom: '10px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: isActive ? '#10b981' : '#333',
              color: isActive ? '#000' : '#fff',
              transition: '0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, opacity: isActive ? 1 : 0.6 }}>
                № {sub.task.plan_snapshot?._prep_num || 'НП------'}
              </span>
            </div>
            <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '5px' }}>{sub.name}</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '8px' }}>ПЛАН: {sub.plan} шт.</div>
            <span style={{
              fontSize: '0.6rem',
              background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(16, 185, 129, 0.1)',
              color: isActive ? '#000' : '#10b981',
              padding: '3px 8px',
              borderRadius: '6px',
              fontWeight: 900
            }}>
              {sub.status === 'in-progress' ? 'В РОБОТІ' : 'ОЧІКУЄ'}
            </span>
          </div>
        )
      })}
    </div>
  )

  const renderMonitoringTable = () => (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 950, marginBottom: '25px' }}>МОНІТОРИНГ ВІДДІЛУ ПІДГОТОВКИ</h2>
      <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflowX: 'auto' }}>
        <div style={{ padding: '25px', borderBottom: '1px solid #222' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>В РОБОТІ ТА БУФЕРІ</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '12px 15px' }}>ДЕТАЛЬ</th>
              <th style={{ padding: '12px 15px' }}>СТАТУС</th>
              <th style={{ padding: '12px 15px' }}>К-СТЬ</th>
              <th style={{ padding: '12px 15px' }}>ЗМІНА</th>
              <th style={{ padding: '12px 15px' }}>ОПЕРАТОР</th>
              <th style={{ padding: '12px 15px' }}>ЧАС</th>
              <th style={{ padding: '12px 15px', width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {prepSubTasks.map(sub => {
              const subTaskSnapshot = sub.task?.plan_snapshot?.[sub.nomenclatureId]
              const startedAt = subTaskSnapshot?.started_at
              const operatorName = subTaskSnapshot?.operator || '—'
              const shiftName = subTaskSnapshot?.shift || '—'
              return (
                <tr key={sub.id} style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem' }}>
                  <td style={{ padding: '12px 15px', fontWeight: 800, fontSize: '0.75rem' }}>{sub.name}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <span style={{
                      color: sub.status === 'in-progress' ? '#3b82f6' : '#eab308',
                      fontWeight: 900,
                      fontSize: '0.7rem',
                      background: sub.status === 'in-progress' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      {sub.status === 'in-progress' ? 'В РОБОТІ' : 'ОЧІКУЄ'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 15px', fontWeight: 900 }}>{sub.plan} шт</td>
                  <td style={{ padding: '12px 15px', color: '#888' }}>{shiftName}</td>
                  <td style={{ padding: '12px 15px', color: '#aaa' }}>{operatorName}</td>
                  <td style={{ padding: '12px 15px', color: '#10b981' }}>
                    {sub.status === 'in-progress' ? formatElapsedTime(startedAt) : '—'}
                  </td>
                  <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleSelectSubTask(sub.id)}
                      style={{ background: '#10b981', border: 'none', color: '#000', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Відкрити"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </td>
                </tr>
              )
            })}
            {prepSubTasks.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#444', fontSize: '0.8rem' }}>
                  Немає активних карток у відділі підготовки
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #10b981', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">Вихід</span>
          </Link>
          {/* Burger — mobile only */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="burger-btn-labeled mobile-only"
          >
            <Menu size={20} />
            <span>Черга ({prepSubTasks.length})</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Tablet size={20} color="#10b981" />
          <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, letterSpacing: '1px' }} className="hide-mobile">
            ТЕРМІНАЛ ПІДГОТОВКИ (ВП)
          </h1>
        </div>

        <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#10b981' }}>
          {currentTime.toLocaleTimeString()}
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR — desktop only */}
        <div className="side-panel hide-mobile" style={{ width: '350px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 900, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={16} /> ЗАВДАННЯ В ЧЕРЗІ ({prepSubTasks.length})
          </div>
          {renderQueue()}
        </div>

        {/* DRAWER OVERLAY — mobile */}
        {isDrawerOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999 }}
            onClick={() => setIsDrawerOpen(false)}
          />
        )}
        <div style={{
          position: 'fixed',
          left: isDrawerOpen ? 0 : '-360px',
          top: 0,
          bottom: 0,
          width: '320px',
          background: '#121212',
          zIndex: 100000,
          transition: '0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ ЗАВДАННЯ</span>
            <X size={20} onClick={() => setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />
          </div>
          {renderQueue()}
        </div>

        {/* CONTENT PANEL */}
        <div className="content-panel" style={{ flex: 1, padding: '20px 15px', overflowY: 'auto', position: 'relative' }}>
          {currentSubTask ? (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{
                      display: 'inline-block',
                      background: currentSubTask.status === 'new' ? '#ef4444' : '#3b82f6',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.65rem',
                      fontWeight: 900
                    }}>
                      {currentSubTask.status === 'new' ? 'НОВЕ ЗАВДАННЯ' : 'В РОБОТІ'}
                    </span>
                  </div>
                  <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', margin: 0, fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    НАРЯД № {currentSubTask.task.plan_snapshot?._prep_num || 'НП------'}
                  </h2>
                  <div style={{ fontSize: '1.1rem', color: '#10b981', fontWeight: 800, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ПІДГОТОВКА СИРОВИНИ
                  </div>
                  <div style={{ fontSize: 'clamp(1rem, 3vw, 1.35rem)', color: '#eee', marginTop: '15px', fontWeight: 900 }}>
                    Деталь: <span style={{ color: '#ff9000' }}>{currentSubTask.name}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedSubTaskId(null); setHasUserDeselected(true) }}
                  style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer', flexShrink: 0 }}
                >
                  <X size={24} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900 }}>ПЛАНОВА КІЛЬКІСТЬ</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#3b82f6' }}>{currentSubTask.plan} шт</div>
                </div>
                <div style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 900 }}>ОБЛАДНАННЯ</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff' }}>{currentSubTask.task.machine_name || '—'}</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 'clamp(15px, 4vw, 30px)', borderRadius: '24px', border: '1px solid #222' }}>
                {currentSubTask.status === 'new' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Зміна</label>
                      <select
                        value={selectedShift}
                        onChange={e => { setSelectedShift(e.target.value); setSelectedOperator('') }}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', color: '#10b981', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 800 }}
                      >
                        <option value="">— Оберіть зміну —</option>
                        <option value="Зміна 1">Зміна 1</option>
                        <option value="Зміна 2">Зміна 2</option>
                        <option value="Зміна 3">Зміна 3</option>
                        <option value="Зміна 4">Зміна 4</option>
                        <option value="Без зміни">Без зміни</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>ПРАЦІВНИК ВП (АВТОРИЗАЦІЯ)</label>
                      <select
                        value={selectedOperator}
                        onChange={e => setSelectedOperator(e.target.value)}
                        disabled={!selectedShift}
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', color: '#10b981', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 800, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}
                      >
                        <option value="">{selectedShift ? '— Оберіть працівника —' : '— Спочатку оберіть зміну —'}</option>
                        {prepOperators.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>

                    <button
                      disabled={isProcessing || !selectedOperator || !selectedShift}
                      onClick={handleStart}
                      style={{
                        width: '100%',
                        padding: '20px',
                        background: '#10b981',
                        color: '#000',
                        border: 'none',
                        borderRadius: '16px',
                        fontSize: '1.2rem',
                        fontWeight: 950,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '15px',
                        cursor: (isProcessing || !selectedOperator || !selectedShift) ? 'not-allowed' : 'pointer',
                        opacity: (isProcessing || !selectedOperator || !selectedShift) ? 0.7 : 1
                      }}
                    >
                      <Play size={24} fill="currentColor" /> {isProcessing ? 'ЧЕКАЙТЕ...' : 'РОЗПОЧАТИ ПІДГОТОВКУ'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '20px 0' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                      <CheckCircle size={40} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>ПРОЦЕС ВИКОНУЄТЬСЯ...</h3>
                    <div style={{ fontSize: '1rem', color: '#888', marginTop: '-10px' }}>
                      Працівник: <strong style={{ color: '#fff' }}>{currentSubTask.operator}</strong>
                    </div>
                    <div style={{ fontSize: 'clamp(3rem, 10vw, 4.5rem)', fontWeight: 1000, color: '#fff', fontFamily: 'monospace', letterSpacing: '-2px', margin: '15px 0' }}>
                      {formatElapsedTime(currentSubTask.task?.plan_snapshot?.[currentSubTask.nomenclatureId]?.started_at)}
                    </div>
                    <button
                      onClick={handleCompleteClick}
                      style={{ width: '100%', padding: '20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 950, marginTop: '20px', cursor: 'pointer', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)' }}
                    >
                      ЗАКРИТИ ЗАДАЧУ
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            renderMonitoringTable()
          )}
        </div>
      </div>

      {/* COMPLETION MODAL */}
      {showCompleteModal && currentSubTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0a0a0a', width: '100%', maxWidth: '500px', borderRadius: '24px', border: '1px solid #333', padding: '30px', position: 'relative' }}>
            <button onClick={() => setShowCompleteModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h2 style={{ margin: '0 0 10px', fontSize: '1.8rem', color: '#10b981', fontWeight: 950 }}>ЗАКРИТТЯ ЗАДАЧІ</h2>
            <div style={{ fontSize: '1.1rem', color: '#ff9000', fontWeight: 800, marginBottom: '25px' }}>{currentSubTask.name}</div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', fontWeight: 900, marginBottom: '10px' }}>ГОТОВИХ ЛИСТІВ (ШТ)</label>
              <div style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '20px', borderRadius: '16px', fontSize: '2rem', fontWeight: 950, textAlign: 'center', boxSizing: 'border-box' }}>
                {completeQty}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px', textAlign: 'center' }}>
                Вираховується як: План ({currentSubTask.plan} шт) - Брак ({scrapQty} шт)
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#ef4444', fontWeight: 900, marginBottom: '10px' }}>БРАК (ШТ)</label>
              <input
                type="number"
                min="0"
                max={currentSubTask.plan}
                value={scrapQty === 0 ? '' : scrapQty}
                placeholder="0"
                onChange={e => {
                  const val = e.target.value
                  const parsed = val === '' ? 0 : Number(val)
                  const num = Math.max(0, Math.min(currentSubTask.plan, isNaN(parsed) ? 0 : parsed))
                  setScrapQty(num)
                  setCompleteQty(currentSubTask.plan - num)
                }}
                style={{ width: '100%', background: '#111', border: '1px solid #ef4444', color: '#ef4444', padding: '20px', borderRadius: '16px', fontSize: '2rem', fontWeight: 950, textAlign: 'center', boxSizing: 'border-box' }}
              />
            </div>

            {scrapQty > 0 && (
              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#ff9000', fontWeight: 900, marginBottom: '10px' }}>ПРИЧИНА БРАКУ (ОБОВ'ЯЗКОВО)</label>
                <input
                  type="text"
                  value={scrapReason}
                  onChange={e => setScrapReason(e.target.value)}
                  placeholder="Вкажіть причину браку..."
                  style={{ width: '100%', background: '#111', border: '1px solid #ff9000', color: '#fff', padding: '15px', borderRadius: '16px', fontSize: '1rem', boxSizing: 'border-box' }}
                  required
                />
              </div>
            )}

            <button
              disabled={isProcessing || (scrapQty > 0 && !scrapReason.trim())}
              onClick={submitCompletion}
              style={{
                width: '100%', padding: '20px',
                background: scrapQty > 0 ? '#ff9000' : '#10b981',
                color: '#000', border: 'none', borderRadius: '16px',
                fontSize: '1.1rem', fontWeight: 950,
                cursor: (isProcessing || (scrapQty > 0 && !scrapReason.trim())) ? 'not-allowed' : 'pointer',
                opacity: (isProcessing || (scrapQty > 0 && !scrapReason.trim())) ? 0.7 : 1
              }}
            >
              {isProcessing ? 'ОБРОБКА...' : (scrapQty > 0 ? 'ПІДТВЕРДИТИ І ЗАПРОСИТИ НА СВ' : 'ПІДТВЕРДИТИ ТА ОПРИБУТКУВАТИ')}
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .mobile-only { display: flex !important; }
          .content-panel { padding: 15px 12px !important; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
        }
        .burger-btn-labeled {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.3);
          color: #10b981;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 900;
          cursor: pointer;
          letter-spacing: 0.3px;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
      `}} />
    </div>
  )
}

export default PreparationTerminal
