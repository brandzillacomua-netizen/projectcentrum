import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CornerUpLeft, Play, RefreshCw, Search, ShieldCheck, Wrench, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useVKYARestorationData } from './VKYA/hooks/useVKYARestorationData'

const STATUS = {
  new: { label: 'ОЧІКУЄ', color: '#f59e0b' },
  in_progress: { label: 'В РОБОТІ', color: '#06b6d4' },
  completed: { label: 'ЗАВЕРШЕНО', color: '#10b981' }
}

export default function VKYARestorationTerminal() {
  const {
    PAGE_SIZE,
    cards,
    legacyItems,
    loading,
    error,
    tab,
    setTab,
    query,
    setQuery,
    currentPage,
    setCurrentPage,
    selectedCard,
    setSelectedCard,
    operator,
    setOperator,
    completedQty,
    setCompletedQty,
    finalScrapQty,
    setFinalScrapQty,
    saving,
    legacyDraft,
    setLegacyDraft,
    legacyQuantity,
    setLegacyQuantity,
    legacyStageId,
    setLegacyStageId,
    restorationStages,
    loadCards,
    visibleCards,
    totalPages,
    paginatedCards,
    startCard,
    completeCard,
    openCard,
    returnToSourceRoute,
    returnLegacyToBZ,
    dispatchToShop2,
    assignLegacyItem
  } = useVKYARestorationData()

  return <div style={{ minHeight: '100vh', background: 'var(--bg, #050505)', color: 'var(--text, #fff)', padding: '28px clamp(16px, 3vw, 42px)' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link to="/brak" style={{ color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', textDecoration: 'none', gap: '7px', fontWeight: 800 }}><ArrowLeft size={18}/> ВКЯ</Link>
        <div style={{ width: 1, height: 32, background: 'var(--glass-border, #222)' }}/>
        <div><div style={{ fontSize: '1.45rem', fontWeight: 1000, color: 'var(--text, #fff)' }}>Термінал відновлення ВКЯ</div><div style={{ color: 'var(--text-dim, #64748b)', fontSize: '.75rem', marginTop: 4 }}>Карти внутрішнього відновлення деталей</div></div>
      </div>
      <button onClick={loadCards} disabled={loading} style={{ background: 'var(--card-bg, #111)', border: '1px solid var(--glass-border, #2a2a2a)', color: 'var(--text, #fff)', borderRadius: 12, padding: '11px 15px', cursor: 'pointer' }}><RefreshCw size={17}/></button>
    </header>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
      {[
        ['Очікують', cards.filter(c => c.status === 'new').length, '#f59e0b', Clock3],
        ['В роботі', cards.filter(c => c.status === 'in_progress').length, '#06b6d4', Wrench],
        ['Завершено', cards.filter(c => c.status === 'completed').length, '#10b981', CheckCircle2]
      ].map(([label, value, color, Icon]) => <div key={label} style={{ background: 'var(--card-bg, #0d0d0d)', border: `1px solid ${color}33`, borderTop: `3px solid ${color}`, borderRadius: 18, padding: 18, boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,0.1))' }}><Icon size={19} color={color}/><div style={{ fontSize: '1.8rem', fontWeight: 1000, marginTop: 10, color: 'var(--text, #fff)' }}>{value}</div><div style={{ color: 'var(--text-muted, #64748b)', fontSize: '.72rem', fontWeight: 850 }}>{label}</div></div>)}
    </div>

    {legacyItems.length > 0 && <section style={{ background: 'var(--card-bg, #0d0d0d)', border: '1px solid #f59e0b44', borderRadius: 20, padding: 20, marginBottom: 24, boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,0.1))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}><div><div style={{ color: '#f59e0b', fontSize: '.7rem', fontWeight: 1000 }}>СТАРИЙ ОБЛІК ВІДНОВЛЕННЯ</div><h2 style={{ margin: '6px 0 3px', fontSize: '1.15rem', color: 'var(--text, #fff)' }}>Нерозподілений залишок</h2><div style={{ color: 'var(--text-muted, #64748b)', fontSize: '.72rem' }}>Виберіть позицію, кількість та етап — система створить звичайну карту.</div></div><div style={{ color: '#f59e0b', fontWeight: 1000 }}>{legacyItems.reduce((sum, item) => sum + Number(item.total_qty || 0), 0)} шт</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{legacyItems.map(item => <button key={item.id} onClick={() => { setLegacyDraft(item); setLegacyQuantity(''); setLegacyStageId('') }} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', textAlign: 'left', background: 'var(--card-bg, #111)', color: 'var(--text, #fff)', border: '1px solid var(--glass-border, #252525)', borderRadius: 13, padding: '13px 15px', cursor: 'pointer' }}><span style={{ fontWeight: 850, overflowWrap: 'anywhere', color: 'var(--text, #fff)' }}>{item.name}</span><span style={{ color: '#f59e0b', fontWeight: 1000, whiteSpace: 'nowrap' }}>{item.total_qty} {item.unit || 'шт'}</span></button>)}</div>
    </section>}

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {[
        ['active', 'АКТИВНІ КАРТИ', cards.filter(c => c.status !== 'completed').length],
        ['awaiting_action', 'ОЧІКУЮТЬ РІШЕННЯ', cards.filter(c => c.status === 'completed' && !c.shop2_card_id && !c.route_card_id && Number(c.completed_quantity) > 0).length],
        ['completed', 'ЗАВЕРШЕНІ', cards.filter(c => c.status === 'completed' && (Boolean(c.shop2_card_id) || Boolean(c.route_card_id) || Number(c.completed_quantity) === 0)).length]
      ].map(([value, label, count]) => (
        <button
          key={value}
          onClick={() => setTab(value)}
          style={{
            background: tab === value ? '#06b6d4' : 'var(--card-bg, #111)',
            color: tab === value ? '#001014' : 'var(--text-muted, #aaa)',
            border: '1px solid var(--glass-border, #222)',
            padding: '10px 18px',
            borderRadius: 11,
            fontWeight: 950,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>{label}</span>
          <span style={{
            background: tab === value ? 'rgba(0,16,20,0.2)' : 'var(--bg-subtle, #222)',
            color: tab === value ? '#001014' : '#06b6d4',
            fontSize: '.75rem',
            padding: '2px 8px',
            borderRadius: 99,
            fontWeight: 900
          }}>
            {count}
          </span>
        </button>
      ))}
      <label style={{ flex: 1, minWidth: 230, display: 'flex', alignItems: 'center', gap: 9, background: 'var(--card-bg, #0d0d0d)', border: '1px solid var(--glass-border, #222)', borderRadius: 11, padding: '0 13px' }}>
        <Search size={16} color="var(--text-dim, #666)"/>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук за деталлю, етапом або картою" style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--text, #fff)', padding: '11px 0' }}/>
      </label>
    </div>

    {error && <div style={{ background: '#ef444418', border: '1px solid #ef444455', color: '#fca5a5', borderRadius: 12, padding: 14, marginBottom: 16 }}>Помилка: {error}</div>}
    {!loading && visibleCards.length === 0 && <div style={{ border: '2px dashed var(--glass-border, #222)', borderRadius: 22, padding: 55, textAlign: 'center', color: 'var(--text-dim, #555)' }}>У цій черзі карт немає</div>}

    {visibleCards.length > 0 && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14, padding: '10px 16px', background: 'var(--card-bg, #0a0a0a)', border: '1px solid var(--glass-border, #1c1c1c)', borderRadius: 13 }}>
        <div style={{ color: 'var(--text-muted, #888)', fontSize: '.8rem', fontWeight: 850 }}>
          Показано <strong style={{ color: 'var(--text, #fff)' }}>{Math.min((currentPage - 1) * PAGE_SIZE + 1, visibleCards.length)}–{Math.min(currentPage * PAGE_SIZE, visibleCards.length)}</strong> з <strong style={{ color: '#06b6d4' }}>{visibleCards.length}</strong> карт
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ background: 'var(--card-bg, #141414)', border: '1px solid var(--glass-border, #282828)', color: currentPage === 1 ? 'var(--text-dim, #444)' : 'var(--text, #fff)', borderRadius: 8, padding: '6px 12px', cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.8rem', fontWeight: 900 }}
            >
              <ChevronLeft size={15}/> Назад
            </button>
            <span style={{ fontSize: '.82rem', fontWeight: 900, color: 'var(--text-muted, #aaa)' }}>
              <strong style={{ color: 'var(--text, #fff)' }}>{currentPage}</strong> / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ background: 'var(--card-bg, #141414)', border: '1px solid var(--glass-border, #282828)', color: currentPage === totalPages ? 'var(--text-dim, #444)' : 'var(--text, #fff)', borderRadius: 8, padding: '6px 12px', cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.8rem', fontWeight: 900 }}
            >
              Вперед <ChevronRight size={15}/>
            </button>
          </div>
        )}
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {paginatedCards.map(card => {
        const meta = STATUS[card.status] || STATUS.new;
        const canOpen = card.status !== 'completed' || (!card.shop2_card_id && !card.route_card_id);
        return (
          <button
            key={card.id}
            onClick={() => canOpen && openCard(card)}
            style={{
              textAlign: 'left',
              background: 'var(--card-bg, #101010)',
              color: 'var(--text, #fff)',
              border: '1px solid var(--glass-border, #202020)',
              borderRadius: 18,
              padding: 20,
              cursor: canOpen ? 'pointer' : 'default',
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 1fr) minmax(140px, .5fr) auto',
              gap: 20,
              alignItems: 'center',
              boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,0.1))'
            }}
          >
            <div>
              <div style={{ color: '#06b6d4', fontSize: '.72rem', fontWeight: 950, letterSpacing: '0.02em' }}>КАРТА ВІДНОВЛЕННЯ №{card.card_number}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 950, marginTop: 6, overflowWrap: 'anywhere', color: 'var(--text, #fff)' }}>{card.nomenclature_name}</div>
              <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '.72rem', marginTop: 5 }}>Створено {new Date(card.created_at).toLocaleString('uk-UA')}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim, #777)', fontSize: '.68rem', fontWeight: 900, textTransform: 'uppercase' }}>ЕТАП ВІДНОВЛЕННЯ</div>
              <div style={{ fontWeight: 900, marginTop: 5, color: 'var(--text, #fff)', fontSize: '0.98rem' }}>{card.restoration_stage}</div>
              {card.operator_name && <div style={{ color: 'var(--text-muted, #888)', fontSize: '.75rem', marginTop: 5 }}>👤 {card.operator_name}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: meta.color, fontSize: '.72rem', fontWeight: 1000, letterSpacing: '0.02em' }}>
                {card.route_card_id ? (card.route_card_id === '00000000-0000-0000-0000-000000000000' ? 'ПОВЕРНЕНО НА СКЛАД (БЗ)' : 'ПОВЕРНЕНО В НАРЯД') : card.shop2_card_id ? `ПЕРЕДАНО: ${card.shop2_stage}` : meta.label}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 1000, marginTop: 5, color: 'var(--text, #fff)' }}>
                {card.status === 'completed' ? `${card.completed_quantity} / ` : ''}{card.quantity} <small style={{ fontSize: '.7rem', color: 'var(--text-muted, #888)' }}>{card.unit}</small>
              </div>
              {card.status === 'completed' && !card.shop2_card_id && !card.route_card_id && Number(card.completed_quantity) > 0 && (
                <div style={{ color: '#f59e0b', fontSize: '.65rem', fontWeight: 950, marginTop: 5 }}>
                  {card.source_task_id ? 'ОЧІКУЄ ПОВЕРНЕННЯ В НАРЯД' : 'ОЧІКУЄ РІШЕННЯ'}
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>

    {visibleCards.length > 0 && totalPages > 1 && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 20, padding: '12px 18px', background: 'var(--card-bg, #0a0a0a)', border: '1px solid var(--glass-border, #1c1c1c)', borderRadius: 14 }}>
        <div style={{ color: 'var(--text-muted, #888)', fontSize: '.82rem', fontWeight: 850 }}>
          Показано <strong style={{ color: 'var(--text, #fff)' }}>{Math.min((currentPage - 1) * PAGE_SIZE + 1, visibleCards.length)}–{Math.min(currentPage * PAGE_SIZE, visibleCards.length)}</strong> з <strong style={{ color: '#06b6d4' }}>{visibleCards.length}</strong> карт
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ background: 'var(--card-bg, #141414)', border: '1px solid var(--glass-border, #282828)', color: currentPage === 1 ? 'var(--text-dim, #444)' : 'var(--text, #fff)', borderRadius: 9, padding: '7px 14px', cursor: currentPage === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.82rem', fontWeight: 900 }}
          >
            <ChevronLeft size={16}/> Назад
          </button>
          {Array.from({ length: totalPages }, (_, idx) => idx + 1)
            .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
            .map((page, idx, array) => {
              const prev = array[idx - 1]
              const showEllipsis = prev && page - prev > 1
              return (
                <div key={page} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {showEllipsis && <span style={{ color: 'var(--text-dim, #555)', padding: '0 4px' }}>...</span>}
                  <button
                    onClick={() => setCurrentPage(page)}
                    style={{
                      background: currentPage === page ? '#06b6d4' : 'var(--card-bg, #121212)',
                      color: currentPage === page ? '#001014' : 'var(--text-muted, #aaa)',
                      border: '1px solid var(--glass-border, #222)',
                      borderRadius: 8,
                      width: 34,
                      height: 34,
                      fontWeight: 950,
                      fontSize: '.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    {page}
                  </button>
                </div>
              )
            })}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ background: 'var(--card-bg, #141414)', border: '1px solid var(--glass-border, #282828)', color: currentPage === totalPages ? 'var(--text-dim, #444)' : 'var(--text, #fff)', borderRadius: 9, padding: '7px 14px', cursor: currentPage === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '.82rem', fontWeight: 900 }}
          >
            Вперед <ChevronRight size={16}/>
          </button>
        </div>
      </div>
    )}

    {selectedCard && <div onClick={() => !saving && setSelectedCard(null)} style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(0,0,0,.86)', display: 'grid', placeItems: 'center', padding: 20 }}><div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 510, background: 'var(--card-bg, #0d0d0d)', border: '1px solid var(--glass-border, #292929)', borderRadius: 24, padding: 26, color: 'var(--text, #fff)', boxShadow: 'var(--shadow, 0 25px 50px rgba(0,0,0,0.5))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15 }}><div><div style={{ color: '#06b6d4', fontSize: '.7rem', fontWeight: 950 }}>КАРТА №{selectedCard.card_number}</div><h2 style={{ margin: '8px 0 4px', color: 'var(--text, #fff)' }}>{selectedCard.nomenclature_name}</h2><div style={{ color: 'var(--text-muted, #888)' }}>{selectedCard.restoration_stage} · {selectedCard.quantity} {selectedCard.unit}</div></div><button onClick={() => setSelectedCard(null)} style={{ background: 'transparent', border: 0, color: 'var(--text-muted, #777)', cursor: 'pointer' }}><X/></button></div>
      {selectedCard.status === 'new' && <>
        <label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '.72rem', fontWeight: 900, margin: '25px 0 8px' }}>ПРАЦІВНИК ВКЯ</label>
        <input autoFocus value={operator} onChange={event => setOperator(event.target.value)} placeholder="Вкажіть працівника" style={{ boxSizing: 'border-box', width: '100%', background: 'var(--bg, #050505)', border: '1px solid var(--glass-border, #333)', borderRadius: 12, color: 'var(--text, #fff)', padding: 14 }}/>
        <button onClick={startCard} disabled={saving || !operator.trim()} style={{ width: '100%', marginTop: 20, background: '#06b6d4', border: 0, borderRadius: 13, padding: 14, color: '#001014', fontWeight: 1000, cursor: 'pointer' }}><Play size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ВЗЯТИ В РОБОТУ</button>
      </>}
      {selectedCard.status === 'in_progress' && <>
        <label style={{ display: 'block', color: '#ef4444', fontSize: '.72rem', fontWeight: 1000, margin: '25px 0 8px' }}>СКІЛЬКИ ДЕТАЛЕЙ ПЕРЕВЕСТИ В УТИЛЬ, {selectedCard.unit}</label>
        <input autoFocus type="number" min="0" max={selectedCard.quantity} value={finalScrapQty} onChange={event => {
          setFinalScrapQty(event.target.value)
          const scrap = Number(event.target.value)
          setCompletedQty(Number.isFinite(scrap) ? String(Math.max(0, Number(selectedCard.quantity) - scrap)) : '')
        }} style={{ boxSizing: 'border-box', width: '100%', background: 'var(--bg, #160707)', border: '1px solid #ef444466', borderRadius: 12, color: 'var(--text, #fff)', padding: 14, fontSize: '1.15rem', fontWeight: 900 }}/>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 12, background: 'var(--card-bg, #07140f)', border: '1px solid #10b98144', borderRadius: 12, padding: 13 }}><span style={{ color: 'var(--text-muted, #8a9a93)', fontSize: '.75rem', fontWeight: 850 }}>БУДЕ ВІДНОВЛЕНО</span><strong style={{ color: '#10b981' }}>{completedQty || 0} {selectedCard.unit}</strong></div>
        <div style={{ color: 'var(--text-muted, #777)', fontSize: '.7rem', marginTop: 10 }}>Уся кількість карти має бути розподілена між відновленими деталями та остаточним утилем.</div>
        <button onClick={completeCard} disabled={saving || finalScrapQty === '' || !Number.isInteger(Number(finalScrapQty)) || Number(finalScrapQty) < 0 || Number(finalScrapQty) > Number(selectedCard.quantity)} style={{ width: '100%', marginTop: 20, background: '#10b981', border: 0, borderRadius: 13, padding: 14, color: '#00150e', fontWeight: 1000, cursor: 'pointer' }}><ShieldCheck size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ЗАВЕРШИТИ КАРТУ</button>
      </>}
      {selectedCard.status === 'completed' && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 15 }}>
          {selectedCard.source_history_id && selectedCard.source_task_id ? (
            <div style={{ background: '#10b98112', border: '1px solid #10b98144', borderRadius: 14, padding: 15 }}>
              <div style={{ color: '#10b981', fontSize: '.72rem', fontWeight: 1000 }}>ПОВЕРНЕННЯ У БУФЕР ЦЕХУ №2</div>
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '.7rem', marginTop: 7 }}>Відновлені деталі надійдуть у Буфер Цеху №2 початкового наряду. Начальник Цеху №2 зможе направити їх на потрібний етап (Пресування, Фарбування тощо).</div>
              <button onClick={returnToSourceRoute} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ width: '100%', marginTop: 14, background: '#10b981', border: 0, borderRadius: 12, padding: 14, color: '#00150e', fontWeight: 1000, cursor: 'pointer' }}><CornerUpLeft size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ПОВЕРНУТИ В НАРЯД (В БУФЕР ЦЕХУ №2) · {selectedCard.completed_quantity} {selectedCard.unit}</button>
            </div>
          ) : (
            <div style={{ background: '#f59e0b12', border: '1px solid #f59e0b44', borderRadius: 14, padding: 15 }}>
              <div style={{ color: '#f59e0b', fontSize: '.72rem', fontWeight: 1000 }}>ПОВЕРНЕННЯ НА СКЛАД (В БАЗОВИЙ ЗАЛИШОК)</div>
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '.7rem', marginTop: 7 }}>Ця карта створена зі старого обліку і не має зв'язку з активним нарядом. Відновлені деталі будуть зараховані безпосередньо в Базовий залишок (БЗ) на склад.</div>
              <button onClick={returnLegacyToBZ} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ width: '100%', marginTop: 14, background: '#f59e0b', border: 0, borderRadius: 12, padding: 14, color: '#170d00', fontWeight: 1000, cursor: 'pointer' }}><CornerUpLeft size={17} style={{ verticalAlign: 'middle', marginRight: 7 }}/>ПОВЕРНУТИ НА СКЛАД (БЗ) · {selectedCard.completed_quantity} {selectedCard.unit}</button>
            </div>
          )}

          <div style={{ background: '#06b6d412', border: '1px solid #06b6d444', borderRadius: 14, padding: 15 }}>
            <div style={{ color: '#06b6d4', fontSize: '.72rem', fontWeight: 1000 }}>ПЕРЕДАЧА В ЦЕХ №2</div>
            <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '.7rem', marginTop: 7 }}>Ви можете передати ці відновлені деталі як нове завдання у Цех №2 для проходження додаткової обробки.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button onClick={() => dispatchToShop2('Пресування')} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ background: '#06b6d4', border: 0, borderRadius: 12, padding: 12, color: '#001014', fontWeight: 1000, cursor: 'pointer', fontSize: '.78rem' }}>🛠️ ПРЕСУВАННЯ</button>
              <button onClick={() => dispatchToShop2('Фарбування')} disabled={saving || Number(selectedCard.completed_quantity) <= 0} style={{ background: '#06b6d4', border: 0, borderRadius: 12, padding: 12, color: '#001014', fontWeight: 1000, cursor: 'pointer', fontSize: '.78rem' }}>🎨 ФАРБУВАННЯ</button>
            </div>
          </div>
        </div>
      )}
    </div></div>}
    {legacyDraft && <div onClick={() => !saving && setLegacyDraft(null)} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(0,0,0,.88)', display: 'grid', placeItems: 'center', padding: 20 }}><div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'var(--card-bg, #0d0d0d)', border: '1px solid #f59e0b55', borderRadius: 22, padding: 25, color: 'var(--text, #fff)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><div><div style={{ color: '#f59e0b', fontSize: '.68rem', fontWeight: 1000 }}>РОЗПОДІЛИТИ У КАРТУ</div><h2 style={{ margin: '7px 0 3px', overflowWrap: 'anywhere', color: 'var(--text, #fff)' }}>{legacyDraft.name}</h2><div style={{ color: 'var(--text-muted, #777)' }}>Доступно: {legacyDraft.total_qty} {legacyDraft.unit || 'шт'}</div></div><button onClick={() => setLegacyDraft(null)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 0, color: 'var(--text-muted, #777)', cursor: 'pointer' }}><X/></button></div><label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '.7rem', fontWeight: 950, margin: '22px 0 7px' }}>КІЛЬКІСТЬ</label><input autoFocus type="number" min="1" max={legacyDraft.total_qty} value={legacyQuantity} onChange={event => setLegacyQuantity(event.target.value)} style={{ boxSizing: 'border-box', width: '100%', background: 'var(--bg, #050505)', border: '1px solid var(--glass-border, #333)', borderRadius: 11, color: 'var(--text, #fff)', padding: 13 }}/><label style={{ display: 'block', color: 'var(--text-muted, #888)', fontSize: '.7rem', fontWeight: 950, margin: '17px 0 7px' }}>ЕТАП ВІДНОВЛЕННЯ</label><select value={legacyStageId} onChange={event => setLegacyStageId(event.target.value)} style={{ boxSizing: 'border-box', width: '100%', background: 'var(--bg, #050505)', border: '1px solid var(--glass-border, #333)', borderRadius: 11, color: 'var(--text, #fff)', padding: 13 }}><option value="">Оберіть етап</option>{restorationStages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select><button onClick={assignLegacyItem} disabled={saving || !legacyStageId || !Number.isInteger(Number(legacyQuantity)) || Number(legacyQuantity) <= 0 || Number(legacyQuantity) > Number(legacyDraft.total_qty)} style={{ width: '100%', marginTop: 21, background: '#f59e0b', color: '#170d00', border: 0, borderRadius: 12, padding: 14, fontWeight: 1000, cursor: 'pointer' }}>{saving ? 'СТВОРЕННЯ...' : 'СТВОРИТИ КАРТУ'}</button></div></div>}
  </div>
}
