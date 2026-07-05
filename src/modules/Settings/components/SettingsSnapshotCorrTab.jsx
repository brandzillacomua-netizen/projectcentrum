import React from 'react'
import { Search, Save, RefreshCw } from 'lucide-react'

export function SettingsSnapshotCorrTab({
  corrSearchQuery,
  setCorrSearchQuery,
  corrSearchLoading,
  handleSearchTasks,
  corrFoundTasks,
  corrSelectedTask,
  handleSelectTask,
  corrSnapshotParts,
  handlePartStockChange,
  handlePartSheetsChange,
  handleSaveCorrection,
  corrIsSaving
}) {
  const inputStyle = { width: '100%', background: '#000', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '30px', alignItems: 'start' }}>
      
      {/* Left Column: Task Search */}
      <section className="glass-panel" style={{ background: '#0e0e11', padding: '24px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#ff9000', marginBottom: '16px' }}>ПОШУК НАРЯДІВ</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            style={inputStyle}
            placeholder="Номер замовлення або ID наряду..."
            value={corrSearchQuery}
            onChange={e => setCorrSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearchTasks()}
          />
          <button
            onClick={handleSearchTasks}
            disabled={corrSearchLoading}
            style={{ background: '#ff9000', color: '#000', border: 'none', borderRadius: '12px', padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {corrSearchLoading ? <RefreshCw className="anim-spin" size={16} /> : <Search size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto' }} className="custom-scroll">
          {corrFoundTasks.map(t => (
            <div
              key={t.id}
              onClick={() => handleSelectTask(t)}
              style={{
                padding: '12px',
                background: corrSelectedTask?.id === t.id ? 'rgba(255,144,0,0.08)' : '#000',
                border: corrSelectedTask?.id === t.id ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.04)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.78rem'
              }}
            >
              <div style={{ fontWeight: 800, color: '#fff' }}>Замовлення: {t.order_num}</div>
              <div style={{ color: '#888', marginTop: '4px' }}>Клієнт: {t.customer}</div>
              <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px', fontFamily: 'monospace' }}>ID: {t.id}</div>
            </div>
          ))}
          {corrFoundTasks.length === 0 && !corrSearchLoading && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#555' }}>Нічого не знайдено</div>
          )}
        </div>
      </section>

      {/* Right Column: Snapshot Edit Form */}
      <section className="glass-panel" style={{ background: '#0e0e11', padding: '28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
        {corrSelectedTask ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>Редагування знімку наряду: {corrSelectedTask.order_num}</h3>
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>Ці зміни синхронізують замовлені листи та списання БЗ</div>
              </div>
              <button
                onClick={handleSaveCorrection}
                disabled={corrIsSaving}
                style={{ background: '#ff9000', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 950, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {corrIsSaving ? <RefreshCw className="anim-spin" size={16} /> : <Save size={16} />}
                ЗБЕРЕГТИ ЗМІНИ
              </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#16161a', color: '#666' }}>
                    <th style={{ padding: '12px 16px' }}>Деталь</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Потреба наряду</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Зі складу БЗ</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Порізати (План)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>К-сть листів</th>
                  </tr>
                </thead>
                <tbody>
                  {corrSnapshotParts.map(p => (
                    <tr key={p.nomenclature_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>{p.name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800 }}>{p.need} шт</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min={0}
                          max={p.need}
                          value={p.stock}
                          onChange={e => handlePartStockChange(p.nomenclature_id, e.target.value)}
                          style={{ width: '80px', background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: '#ff9000', borderRadius: '8px', padding: '6px', textAlign: 'center', fontWeight: 900 }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#60a5fa' }}>{p.plan} шт</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min={0}
                          value={p.sheets}
                          onChange={e => handlePartSheetsChange(p.nomenclature_id, e.target.value)}
                          style={{ width: '80px', background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '6px', textAlign: 'center', fontWeight: 800 }}
                        />
                      </td>
                    </tr>
                  ))}
                  {corrSnapshotParts.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Знімок наряду порожній або не завантажився</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '100px 20px', color: '#444' }}>Оберіть наряд зі списку ліворуч для редагування знімку плану</div>
        )}
      </section>

    </div>
  )
}
