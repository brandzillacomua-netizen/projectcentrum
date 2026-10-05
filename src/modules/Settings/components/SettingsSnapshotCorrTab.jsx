import React from 'react'
import { Sliders, Search } from 'lucide-react'

export function SettingsSnapshotCorrTab(props) {
  const {
    corrSearchQuery,
    setCorrSearchQuery,
    handleSearchTasks,
    corrSearchLoading,
    corrFoundTasks,
    corrSelectedTask,
    setCorrSelectedTask,
    handleSelectTask,
    corrSnapshotParts,
    handlePartStockChange,
    handlePartSheetsChange,
    handleSaveCorrection,
    corrIsSaving
  } = props

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Sliders size={20} /> Адмін-корекція запусків та БЗ снапшотів
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Тут ви можете скоригувати зафіксовані в нарядах дані по БЗ (Буферній Зоні). Система автоматично перерахує кількість деталей до випуску та необхідні листи, а також оновить відповідні запити матеріалів на складі й робочі картки БЗ.
        </p>
        
        <div style={{ display: 'flex', gap: '12px', maxWidth: '600px', marginBottom: '24px' }}>
          <input
            style={{
              width: '100%',
              background: 'var(--surface-black)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-strong)',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'border-color 0.2s',
              fontFamily: 'inherit'
            }}
            value={corrSearchQuery}
            onChange={e => setCorrSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearchTasks()}
            placeholder="Введіть номер наряду (напр: 30062026-01)"
          />
          <button
            onClick={handleSearchTasks}
            disabled={corrSearchLoading}
            style={{
              background: 'linear-gradient(135deg, #ff9000, #ff6a00)',
              color: '#000',
              border: 'none',
              padding: '0 24px',
              borderRadius: '12px',
              fontWeight: 900,
              cursor: corrSearchLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Search size={16} /> Пошук
          </button>
        </div>

        {corrSearchLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
            <div className="spinner-mes" style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Пошук нарядів...</span>
          </div>
        )}

        {corrFoundTasks.length > 0 && !corrSelectedTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Знайдені наряди:</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
              {corrFoundTasks.map(t => (
                <div
                  key={t.id}
                  onClick={() => handleSelectTask(t)}
                  style={{
                    background: 'var(--fill-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '16px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: '0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,144,0,0.3)'; e.currentTarget.style.background = 'rgba(255,144,0,0.02)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-strong)' }}>№ {t.order_num}{t.batch_index ? `/${t.batch_index}` : ''}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Клієнт: {t.customer}</div>
                  <div style={{ fontSize: '0.7rem', color: '#ff9000', marginTop: '8px', fontWeight: 700 }}>Етап: {t.step} | Стан: {t.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {corrFoundTasks.length === 0 && corrSearchQuery && !corrSearchLoading && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', padding: '10px 0' }}>Нарядів не знайдено. Спробуйте інший пошуковий запит.</div>
        )}
      </section>

      {corrSelectedTask && (
        <section className="glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, color: 'var(--text-strong)' }}>
                Редагування наряду № {corrSelectedTask.order_num}{corrSelectedTask.batch_index ? `/${corrSelectedTask.batch_index}` : ''}
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Клієнт: {corrSelectedTask.customer} | Поточний крок: <strong style={{ color: '#ff9000' }}>{corrSelectedTask.step}</strong>
              </div>
            </div>
            <button
              onClick={() => setCorrSelectedTask(null)}
              style={{
                background: 'var(--fill-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-strong)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Назад до списку
            </button>
          </div>

          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '16px', background: 'rgba(0,0,0,0.12)', overflowX: 'auto', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--fill-subtle)', borderBottom: '1px solid var(--border-subtle)', color: '#666' }}>
                  <th style={{ padding: '12px 16px' }}>Деталь / Код</th>
                  <th style={{ padding: '12px 16px' }}>Матеріал</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Потреба</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ff9000' }}>Взято з БЗ (Запас)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>План до виготовлення</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>В листі (шт)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#60a5fa' }}>Листів</th>
                </tr>
              </thead>
              <tbody>
                {corrSnapshotParts.map(p => (
                  <tr key={p.nomenclature_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-strong)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#444', marginTop: '2px' }}>{p.code}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{p.material}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{p.need}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="number"
                        value={p.stock}
                        onChange={e => handlePartStockChange(p.nomenclature_id, e.target.value)}
                        style={{
                          background: 'var(--surface-black)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: '#ff9000',
                          padding: '6px 10px',
                          width: '100px',
                          textAlign: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: 'var(--text-muted)' }}>{p.plan}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>{p.units_per_sheet}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <input
                        type="number"
                        value={p.sheets}
                        onChange={e => handlePartSheetsChange(p.nomenclature_id, e.target.value)}
                        style={{
                          background: 'var(--surface-black)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          color: '#60a5fa',
                          padding: '6px 10px',
                          width: '80px',
                          textAlign: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              onClick={() => handleSelectTask(corrSelectedTask)}
              style={{
                background: 'var(--fill-subtle)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Скинути зміни
            </button>
            <button
              onClick={handleSaveCorrection}
              disabled={corrIsSaving}
              style={{
                background: 'linear-gradient(135deg, #ff9000, #ff6a00)',
                color: '#000',
                border: 'none',
                padding: '12px 30px',
                borderRadius: '12px',
                fontWeight: 900,
                cursor: corrIsSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {corrIsSaving ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
