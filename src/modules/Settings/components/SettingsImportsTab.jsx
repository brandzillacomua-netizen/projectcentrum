import React from 'react'
import { Upload, Layers, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

export function SettingsImportsTab({
  bzFile,
  bzDelimiter,
  bzRecordMode,
  setBzRecordMode,
  bzUploadStatus,
  setBzUploadStatus,
  bzUploadLog,
  bzActivePreviewTab,
  setBzActivePreviewTab,
  bzAssembledKits,
  bzLeftovers,
  bzUnrecognized,
  handleBzFileChange,
  executeBzUpload,
  sheetsFile,
  sheetsDelimiter,
  sheetsRecordMode,
  setSheetsRecordMode,
  sheetsUploadStatus,
  setSheetsUploadStatus,
  sheetsUploadLog,
  sheetsActivePreviewTab,
  setSheetsActivePreviewTab,
  sheetsPreviewList,
  handleSheetsFileChange,
  executeSheetsUpload,
  cuttersFile,
  cuttersRecordMode,
  setCuttersRecordMode,
  cuttersUploadStatus,
  setCuttersUploadStatus,
  cuttersUploadLog,
  cuttersPreviewList,
  handleCuttersFileChange,
  executeCuttersUpload,
  fastenersFile,
  fastenersRecordMode,
  setFastenersRecordMode,
  fastenersUploadStatus,
  setFastenersUploadStatus,
  fastenersUploadLog,
  fastenersPreviewList,
  handleFastenersFileChange,
  executeFastenersUpload
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
      
      {/* BZ Remnants Upload */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ БЗ
        </h3>
        <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Завантажте CSV-файл із залишками незавершеного виробництва (БЗ). Система автоматично підбере з яких деталей можна зібрати готові комплекти → переведе їх на СГП, а решту залишить на БЗ.
        </p>

        {bzUploadStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}>
              <input id="bz-file-input" type="file" accept=".csv" onChange={handleBzFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
              <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>Очікуваний формат: колонка «Номенклатура» та колонка «Склад» (кількість)</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: 'add', label: '+ Додати до наявного' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                  <button key={opt.v} onClick={() => setBzRecordMode(opt.v)} type="button" style={{
                    background: bzRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent', border: bzRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)', color: bzRecordMode === opt.v ? '#ff9000' : '#888', padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {bzUploadStatus === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[{ label: 'Комплектів на СГП', val: bzAssembledKits.length, color: '#10b981' }, { label: 'Залишків на БЗ', val: bzLeftovers.length, color: '#60a5fa' }, { label: 'Не розпізнано', val: bzUnrecognized.length, color: '#ef4444' }].map(s => (
                <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '5px', borderRadius: '14px', gap: '4px', alignSelf: 'flex-start' }}>
              {[{ id: 'kits', label: `🏭 Комплекти СГП (${bzAssembledKits.length})` }, { id: 'leftovers', label: `📦 Залишки БЗ (${bzLeftovers.length})` }, { id: 'unrecognized', label: `⚠️ Не розпізнано (${bzUnrecognized.length})` }].map(t => (
                <button key={t.id} onClick={() => setBzActivePreviewTab(t.id)} type="button" className={`tab-btn-v2 ${bzActivePreviewTab === t.id ? 'active' : ''}`}>{t.label}</button>
              ))}
            </div>

            {bzActivePreviewTab === 'kits' && (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                      <th style={{ padding: '10px 16px' }}>Виріб (СГП)</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>К-сть комплектів</th>
                      <th style={{ padding: '10px 16px' }}>Деталі що увійшли</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bzAssembledKits.map((kit, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 800, color: '#10b981' }}>{kit.product.name}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, color: '#fff' }}>{kit.qty}</td>
                        <td style={{ padding: '10px 16px', color: '#888', fontSize: '0.68rem', lineHeight: '1.6' }}>
                          {kit.consumed.map((c, ci) => <span key={ci} style={{ display: 'inline-block', marginRight: '8px' }}>{c.name} ×{c.qty}</span>)}
                        </td>
                      </tr>
                    ))}
                    {bzAssembledKits.length === 0 && <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Жодного комплекту зібрати не вдалося</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {bzActivePreviewTab === 'leftovers' && (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                      <th style={{ padding: '10px 16px' }}>Номенклатура</th>
                      <th style={{ padding: '10px 16px' }}>Тип</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Кількість (шт)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bzLeftovers.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#60a5fa' }}>{l.name}</td>
                        <td style={{ padding: '10px 16px', color: '#888' }}>{l.type || '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{l.qty}</td>
                      </tr>
                    ))}
                    {bzLeftovers.length === 0 && <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Залишків немає</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {bzActivePreviewTab === 'unrecognized' && (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                      <th style={{ padding: '10px 16px' }}>Назва у файлі</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Рядок</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>К-сть</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bzUnrecognized.map((u, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px 16px', color: '#ef4444', fontWeight: 700 }}>{u.name}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', color: '#666' }}>{u.rowNum}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{u.qty}</td>
                      </tr>
                    ))}
                    {bzUnrecognized.length === 0 && <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Всі позиції розпізнано ✅</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => { setBzUploadStatus('idle'); setBzFile(null); setBzAssembledKits([]); setBzLeftovers([]); setBzUnrecognized([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
                <button type="button" onClick={executeBzUpload} disabled={bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0} style={{ background: '#ff9000', border: 'none', color: '#000', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ
                </button>
              </div>
            </div>
          </div>
        )}

        {bzUploadStatus === 'uploading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
            <RefreshCw className="anim-spin" size={32} color="#ff9000" />
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto' }}>{bzUploadLog}</pre>
          </div>
        )}

        {bzUploadStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto' }}>{bzUploadLog}</pre>
            <button type="button" onClick={() => { setBzUploadStatus('idle'); setBzFile(null); setBzAssembledKits([]); setBzLeftovers([]); setBzUnrecognized([]) }} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ</button>
          </div>
        )}
      </section>

      {/* Sheets Remnants Upload */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ СО (ПІДГОТОВЛЕНІ ЛИСТИ)
        </h3>
        <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Завантажте CSV-файл із залишками підготовлених листів на складі СО.
        </p>

        {sheetsUploadStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}>
              <input id="sheets-file-input" type="file" accept=".csv" onChange={handleSheetsFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
              <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
            </div>
          </div>
        )}

        {sheetsUploadStatus === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                    <th style={{ padding: '10px 16px' }}>Номенклатура у файлі</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Рядок</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Кількість (шт)</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetsPreviewList.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: l.isNew ? '#ff9000' : '#60a5fa' }}>{l.name}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: '#666' }}>{l.rowNum}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{l.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => { setSheetsUploadStatus('idle'); setSheetsPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
              <button type="button" onClick={executeSheetsUpload} style={{ background: '#ff9000', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer' }}>ЗАПИСАТИ В СИСТЕМУ</button>
            </div>
          </div>
        )}

        {sheetsUploadStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
            <button type="button" onClick={() => { setSheetsUploadStatus('idle'); setSheetsPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ</button>
          </div>
        )}
      </section>

      {/* Cutters Stock Upload */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ ФРЕЗ (СКЛАД)
        </h3>
        <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Завантажте CSV-файл залишків фрез зі складу.
        </p>

        {cuttersUploadStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}>
              <input id="cutters-file-input" type="file" accept=".csv" onChange={handleCuttersFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
              <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
            </div>
          </div>
        )}

        {cuttersUploadStatus === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                    <th style={{ padding: '10px 16px' }}>Назва фрези</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Діаметр</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Кількість (шт)</th>
                  </tr>
                </thead>
                <tbody>
                  {cuttersPreviewList.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#eee' }}>{item.name}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: '#60a5fa' }}>{item.diameter} мм</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, color: '#10b981' }}>{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => { setCuttersUploadStatus('idle'); setCuttersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
              <button type="button" onClick={executeCuttersUpload} style={{ background: '#ff9000', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer' }}>ЗАПИСАТИ В СИСТЕМУ</button>
            </div>
          </div>
        )}

        {cuttersUploadStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
            <button type="button" onClick={() => { setCuttersUploadStatus('idle'); setCuttersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ</button>
          </div>
        )}
      </section>

      {/* Fasteners Stock Upload */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ МЕТИЗІВ (СВ)
        </h3>
        <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Завантажте CSV-файл залишків метизів для Складу Виробництва (СВ).
        </p>

        {fastenersUploadStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}>
              <input id="fasteners-file-input" type="file" accept=".csv" onChange={handleFastenersFileChange} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
              <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
            </div>
          </div>
        )}

        {fastenersUploadStatus === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                    <th style={{ padding: '10px 16px' }}>Назва метизу</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Залишок (шт)</th>
                  </tr>
                </thead>
                <tbody>
                  {fastenersPreviewList.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#eee' }}>{item.name}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, color: '#10b981' }}>{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => { setFastenersUploadStatus('idle'); setFastenersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
              <button type="button" onClick={executeFastenersUpload} style={{ background: '#ff9000', color: '#000', border: 'none', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer' }}>ЗАПИСАТИ В СИСТЕМУ</button>
            </div>
          </div>
        )}

        {fastenersUploadStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
            <button type="button" onClick={() => { setFastenersUploadStatus('idle'); setFastenersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ</button>
          </div>
        )}
      </section>

    </div>
  )
}
