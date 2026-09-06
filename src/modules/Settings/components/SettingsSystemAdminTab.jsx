import React from 'react'
import { 
  Cpu, AlertCircle, Sliders, Layers, Upload, CheckCircle2, RefreshCw 
} from 'lucide-react'
import { TelegramAlertsConfig } from './TelegramAlertsConfig'

export function SettingsSystemAdminTab(props) {
  const {
    tempFortnetUrl,
    setTempFortnetUrl,
    updateFortnetUrl,
    accessLogs,
    maintenanceCheckEnabled,
    updateMaintenanceCheckEnabled,
    npApiKeyInput,
    setNpApiKeyInput,
    handleTestAndSaveNpKey,
    npTesting,
    npTestResult,
    sqlErrorPosition,
    setSqlErrorPosition,
    companyPositions,
    savingPosId,
    setSavingPosId,
    upsertCompanyPosition,
    startPageModules,
    bzUploadStatus,
    setBzUploadStatus,
    handleBzFileChange,
    bzRecordMode,
    setBzRecordMode,
    bzAssembledKits,
    setBzAssembledKits,
    bzLeftovers,
    setBzLeftovers,
    bzUnrecognized,
    setBzUnrecognized,
    bzActivePreviewTab,
    setBzActivePreviewTab,
    executeBzUpload,
    bzUploadLog,
    setBzUploadLog,
    setBzFile,
    sheetsUploadStatus,
    setSheetsUploadStatus,
    handleSheetsFileChange,
    sheetsRecordMode,
    setSheetsRecordMode,
    sheetsPreviewList,
    setSheetsPreviewList,
    sheetsActivePreviewTab,
    setSheetsActivePreviewTab,
    executeSheetsUpload,
    sheetsUploadLog,
    setSheetsUploadLog,
    setSheetsFile,
    cuttersUploadStatus,
    setCuttersUploadStatus,
    handleCuttersFileChange,
    cuttersRecordMode,
    setCuttersRecordMode,
    cuttersPreviewList,
    setCuttersPreviewList,
    executeCuttersUpload,
    cuttersUploadLog,
    setCuttersUploadLog,
    setCuttersFile,
    fastenersUploadStatus,
    setFastenersUploadStatus,
    handleFastenersFileChange,
    fastenersRecordMode,
    setFastenersRecordMode,
    fastenersPreviewList,
    setFastenersPreviewList,
    executeFastenersUpload,
    fastenersUploadLog,
    setFastenersUploadLog,
    setFastenersFile
  } = props

  const inputStyle = { width: '100%', background: '#000', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, outline: 'none' }

  return (
    <div className="system-settings-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '30px', alignItems: 'start' }}>
      
      {/* Left Panel: Fortnet & API settings */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Cpu size={20} /> КОНФІГУРАЦІЯ СИСТЕМИ & FORTNET
        </h3>
        
        <div style={{ marginBottom: '30px' }}>
          <label className="form-label">АДРЕСА СЕРВЕРА FORTNET (API / СИНХРОНІЗАЦІЯ)</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <input 
              style={inputStyle} 
              value={tempFortnetUrl} 
              onChange={e => setTempFortnetUrl(e.target.value)} 
              placeholder="http://192.168.1.100:8090" 
            />
            <button 
              onClick={() => {
                updateFortnetUrl(tempFortnetUrl)
                alert('Адресу Fortnet успішно оновлено!')
              }}
              style={{ 
                background: '#ff9000', 
                color: '#000', 
                border: 'none', 
                padding: '0 24px', 
                borderRadius: '12px', 
                fontWeight: 900, 
                cursor: 'pointer',
                transition: '0.2s'
              }}
              className="primary-btn"
            >
              ЗБЕРЕГТИ
            </button>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#555', marginTop: '10px', lineHeight: '1.4' }}>
            Ця адреса локального API сервера Fortnet використовується для реального зчитування подій зчитувачів та прохідних карток співробітників цехів.
          </p>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '24px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#888', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>СТАТУС ПОДІЙ ПРОХОДУ</h4>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
              Останніх подій у базі логів проходів: <strong style={{ color: '#fff' }}>{(accessLogs || []).length}</strong>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '24px', marginTop: '24px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#888', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ТЕХНОЛОГІЧНЕ ОБСЛУГОВУВАННЯ</h4>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Контроль чистки стола верстата</span>
              <span style={{ fontSize: '0.7rem', color: '#555' }}>Блокування запуску після 5-ї виконаної карти розкрою</span>
            </div>
            
            <div 
              onClick={() => updateMaintenanceCheckEnabled(!maintenanceCheckEnabled)}
              style={{
                width: '50px',
                height: '26px',
                borderRadius: '13px',
                background: maintenanceCheckEnabled ? 'linear-gradient(135deg, #ff9000, #ff6a00)' : '#222',
                padding: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: maintenanceCheckEnabled ? 'flex-end' : 'flex-start',
                transition: 'all 0.2s ease',
                boxShadow: maintenanceCheckEnabled ? '0 0 12px rgba(255,144,0,0.3)' : 'none'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: maintenanceCheckEnabled ? '#000' : '#888',
                transition: 'all 0.2s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Nova Poshta API Key Section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '24px', marginTop: '24px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#888', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>API КЛЮЧ НОВОЇ ПОШТИ</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              style={inputStyle}
              type="password"
              value={npApiKeyInput}
              onChange={e => setNpApiKeyInput(e.target.value)}
              placeholder="Ключ API з кабінету НП..."
            />
            <button
              onClick={handleTestAndSaveNpKey}
              disabled={npTesting || !npApiKeyInput.trim()}
              style={{
                background: npTesting ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)',
                color: npTesting ? '#555' : '#000',
                border: 'none',
                padding: '0 20px',
                borderRadius: '12px',
                fontWeight: 900,
                cursor: npTesting ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '0.78rem'
              }}
            >
              {npTesting ? 'ПЕРЕВІРКА...' : 'ЗБЕРЕГТИ І ПЕРЕВІРИТИ'}
            </button>
          </div>
          {npTestResult && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: npTestResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: npTestResult.success ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
              color: npTestResult.success ? '#34d399' : '#f87171'
            }}>
              {npTestResult.message}
            </div>
          )}
        </div>

        {/* Telegram Crash Alerts & Diagnostics */}
        <TelegramAlertsConfig />
      </section>

      {/* Right Panel: Start Pages by Position */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Sliders size={20} /> СТАРТОВІ СТОРІНКИ ДЛЯ ПОСАД
        </h3>
        
        {sqlErrorPosition && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '20px',
            fontSize: '0.78rem',
            lineHeight: '1.5'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 800, marginBottom: '6px' }}>
              <AlertCircle size={16} /> УВАГА: ПОТРІБНО ДОДАТИ КОЛОНКУ В БД
            </div>
            <div style={{ color: '#aaa', marginBottom: '10px' }}>
              Таблиця <code>company_positions</code> не містить колонку <code>start_page</code>. Налаштування збережено тимчасово в пам'яті. Для постійного збереження виконайте SQL-запит у Supabase SQL Editor:
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <pre style={{
                margin: 0,
                background: '#000',
                padding: '8px 12px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#00ff66',
                flex: 1,
                overflowX: 'auto'
              }}>
                ALTER TABLE company_positions ADD COLUMN IF NOT EXISTS start_page TEXT;
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('ALTER TABLE company_positions ADD COLUMN IF NOT EXISTS start_page TEXT;')
                  alert('SQL-запит скопійовано в буфер обміну!')
                }}
                style={{
                  background: 'rgba(255, 144, 0, 0.1)',
                  border: '1px solid rgba(255, 144, 0, 0.2)',
                  color: '#ff9000',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
                type="button"
              >
                Копіювати
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(companyPositions || []).map(pos => {
            const isSaving = savingPosId === pos.id;
            return (
              <div 
                key={pos.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '12px 18px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.03)',
                  gap: '12px'
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{pos.name}</div>
                  <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>
                    ID: {pos.id}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {isSaving && (
                    <div className="spinner-mes" style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                  )}
                  <select
                    style={{
                      background: '#000',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '10px',
                      padding: '6px 12px',
                      color: '#aaa',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer',
                      maxWidth: '220px'
                    }}
                    value={pos.start_page || ''}
                    onChange={async (e) => {
                      const newStartPage = e.target.value || null;
                      setSavingPosId(pos.id);
                      
                      const payload = {
                        id: pos.id,
                        name: pos.name,
                        department_id: pos.department_id || null,
                        start_page: newStartPage
                      };
                      
                      const { error } = await upsertCompanyPosition(payload);
                      
                      setSavingPosId(null);
                      if (error) {
                        if (error.message === 'MISSING_START_PAGE_COLUMN') {
                          setSqlErrorPosition(true);
                        } else {
                          alert(`Помилка збереження: ${error.message}`);
                        }
                      } else {
                        setSqlErrorPosition(false);
                      }
                    }}
                  >
                    <option value="">За замовчуванням (перший доступний)</option>
                    {(startPageModules || []).map(mod => (
                      <option key={mod.path} value={mod.path}>
                        {mod.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* BZ Remnants Upload — full-width row */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ БЗ
        </h3>
        <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Завантажте CSV-файл із залишками незавершеного виробництва (БЗ). Система автоматично підбере з яких деталей можна зібрати готові комплекти → переведе їх на <strong style={{ color: '#ff9000' }}>СГП (склад готової продукції)</strong>, а решту залишить на <strong style={{ color: '#60a5fa' }}>БЗ</strong>.
        </p>

        {bzUploadStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              border: '2px dashed rgba(255,144,0,0.3)',
              borderRadius: '18px',
              padding: '36px 20px',
              textAlign: 'center',
              background: 'rgba(255,144,0,0.01)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              maxWidth: '520px'
            }}
            >
              <input
                id="bz-file-input"
                type="file"
                accept=".csv"
                onChange={handleBzFileChange}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
              <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>Очікуваний формат: колонка «Номенклатура» та колонка «Склад» (кількість)</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: 'add', label: '+ Додати до наявного' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                  <button key={opt.v} onClick={() => setBzRecordMode(opt.v)} type="button" style={{
                    background: bzRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                    border: bzRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                    color: bzRecordMode === opt.v ? '#ff9000' : '#888',
                    padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {bzUploadStatus === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { label: 'Комплектів на СГП', val: bzAssembledKits.length, color: '#10b981' },
                { label: 'Залишків на БЗ', val: bzLeftovers.length, color: '#60a5fa' },
                { label: 'Не розпізнано', val: bzUnrecognized.length, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '5px', borderRadius: '14px', gap: '4px' }}>
              {[
                { id: 'kits', label: `🏭 Комплекти СГП (${bzAssembledKits.length})` },
                { id: 'leftovers', label: `📦 Залишки БЗ (${bzLeftovers.length})` },
                { id: 'unrecognized', label: `⚠️ Не розпізнано (${bzUnrecognized.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setBzActivePreviewTab(t.id)} type="button" className={`tab-btn-v2 ${bzActivePreviewTab === t.id ? 'active' : ''}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {bzActivePreviewTab === 'kits' && (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
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
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, fontSize: '1.0rem', color: '#fff' }}>{kit.qty}</td>
                        <td style={{ padding: '10px 16px', color: '#888', fontSize: '0.68rem', lineHeight: '1.6' }}>
                          {kit.consumed.map((c, ci) => <span key={ci} style={{ display: 'inline-block', marginRight: '8px' }}>{c.name} ×{c.qty}</span>)}
                        </td>
                      </tr>
                    ))}
                    {bzAssembledKits.length === 0 && (
                      <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>Жодного комплекту зібрати не вдалося</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {bzActivePreviewTab === 'leftovers' && (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
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
                        <td style={{ padding: '10px 16px', color: '#888', fontSize: '0.68rem' }}>{l.type || '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{l.qty}</td>
                      </tr>
                    ))}
                    {bzLeftovers.length === 0 && (
                      <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>Залишків немає</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {bzActivePreviewTab === 'unrecognized' && (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
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
                    {bzUnrecognized.length === 0 && (
                      <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>Всі позиції розпізнано ✅</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ v: 'add', label: '+ Додати' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                    <button key={opt.v} onClick={() => setBzRecordMode(opt.v)} type="button" style={{
                      background: bzRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                      border: bzRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                      color: bzRecordMode === opt.v ? '#ff9000' : '#888',
                      padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setBzUploadStatus('idle'); setBzFile(null); setBzAssembledKits([]); setBzLeftovers([]); setBzUnrecognized([]) }}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >← НАЗАД</button>
                <button
                  type="button"
                  onClick={executeBzUpload}
                  disabled={bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0}
                  style={{
                    background: (bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0) ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)',
                    border: 'none', color: (bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0) ? '#555' : '#000',
                    padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900,
                    cursor: (bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({bzAssembledKits.length + bzLeftovers.length + bzUnrecognized.filter(u => u.qty > 0).length} позицій)
                </button>
              </div>
            </div>
          </div>
        )}

        {bzUploadStatus === 'uploading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
            <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис даних у базу...</div>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{bzUploadLog}</pre>
          </div>
        )}

        {bzUploadStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Склад оновлено: комплекти передано на СГП, залишки оприбутковано на БЗ.</p>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{bzUploadLog}</pre>
            <button type="button" onClick={() => { setBzUploadStatus('idle'); setBzFile(null); setBzAssembledKits([]); setBzLeftovers([]); setBzUnrecognized([]); setBzUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
              ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
            </button>
          </div>
        )}

        {bzUploadStatus === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <AlertCircle size={52} color="#ef4444" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
            <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{bzUploadLog}</pre>
            <button type="button" onClick={() => { setBzUploadStatus('preview') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
              ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
            </button>
          </div>
        )}
      </section>

      {/* Prepared Sheets Remnants Upload — full-width row */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ СО (ПІДГОТОВЛЕНІ ЛИСТИ)
        </h3>
        <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Завантажте CSV-файл із залишками підготовлених листів на складі СО. Нові номенклатури будуть створені автоматично як сировина (тип <code>raw</code>), а кількості будуть записані на <strong style={{ color: '#ff9000' }}>СО склад</strong>.
        </p>

        {sheetsUploadStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              border: '2px dashed rgba(255,144,0,0.3)',
              borderRadius: '18px',
              padding: '36px 20px',
              textAlign: 'center',
              background: 'rgba(255,144,0,0.01)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              maxWidth: '520px'
            }}
            >
              <input
                id="sheets-file-input"
                type="file"
                accept=".csv"
                onChange={handleSheetsFileChange}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
              <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>Очікуваний формат: колонка «Номенклатура» та колонка «Склад» (кількість)</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: 'add', label: '+ Додати до наявного' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                  <button key={opt.v} onClick={() => setSheetsRecordMode(opt.v)} type="button" style={{
                    background: sheetsRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                    border: sheetsRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                    color: sheetsRecordMode === opt.v ? '#ff9000' : '#888',
                    padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {sheetsUploadStatus === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { label: 'Усього позицій', val: sheetsPreviewList.length, color: '#60a5fa' },
                { label: 'Буде створено номенклатур', val: sheetsPreviewList.filter(s => s.isNew).length, color: '#ff9000' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '5px', borderRadius: '14px', gap: '4px' }}>
              {[
                { id: 'all', label: `📋 Всі позиції (${sheetsPreviewList.length})` },
                { id: 'new', label: `✨ Будуть створені (${sheetsPreviewList.filter(s => s.isNew).length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setSheetsActivePreviewTab(t.id)} type="button" className={`tab-btn-v2 ${sheetsActivePreviewTab === t.id ? 'active' : ''}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                    <th style={{ padding: '10px 16px' }}>Номенклатура у файлі</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Рядок</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Кількість (шт)</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center' }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetsPreviewList
                    .filter(item => sheetsActivePreviewTab === 'all' || (sheetsActivePreviewTab === 'new' && item.isNew))
                    .map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: l.isNew ? '#ff9000' : '#60a5fa' }}>{l.name}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', color: '#666' }}>{l.rowNum}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{l.qty}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          {l.isNew ? (
                            <span style={{ fontSize: '0.62rem', fontWeight: 850, padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.2)' }}>[БУДЕ СТВОРЕНО]</span>
                          ) : (
                            <span style={{ fontSize: '0.62rem', fontWeight: 850, padding: '3px 8px', borderRadius: '6px', background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>Розпізнано</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  {sheetsPreviewList.filter(item => sheetsActivePreviewTab === 'all' || (sheetsActivePreviewTab === 'new' && item.isNew)).length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>Немає позицій для відображення</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ v: 'add', label: '+ Додати' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                    <button key={opt.v} onClick={() => setSheetsRecordMode(opt.v)} type="button" style={{
                      background: sheetsRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                      border: sheetsRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                      color: sheetsRecordMode === opt.v ? '#ff9000' : '#888',
                      padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setSheetsUploadStatus('idle'); setSheetsFile(null); setSheetsPreviewList([]) }}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >← НАЗАД</button>
                <button
                  type="button"
                  onClick={executeSheetsUpload}
                  disabled={sheetsPreviewList.length === 0}
                  style={{
                    background: sheetsPreviewList.length === 0 ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)',
                    border: 'none', color: sheetsPreviewList.length === 0 ? '#555' : '#000',
                    padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900,
                    cursor: sheetsPreviewList.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({sheetsPreviewList.length} позицій)
                </button>
              </div>
            </div>
          </div>
        )}

        {sheetsUploadStatus === 'uploading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
            <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис залишків СО у базу...</div>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{sheetsUploadLog}</pre>
          </div>
        )}

        {sheetsUploadStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Склад СО оновлено: підготовлені листи успішно оприбутковано.</p>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{sheetsUploadLog}</pre>
            <button type="button" onClick={() => { setSheetsUploadStatus('idle'); setSheetsFile(null); setSheetsPreviewList([]); setSheetsUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
              ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
            </button>
          </div>
        )}

        {sheetsUploadStatus === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <AlertCircle size={52} color="#ef4444" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
            <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{sheetsUploadLog}</pre>
            <button type="button" onClick={() => { setSheetsUploadStatus('preview') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
              ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
            </button>
          </div>
        )}
      </section>

      {/* ── ЗАВАНТАЖЕННЯ ЗАЛИШКІВ ФРЕЗ (СКЛАД) ── */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ ФРЕЗ (СКЛАД)
        </h3>
        <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Завантажте CSV-файл залишків фрез зі складу. Колонки: <strong style={{ color: '#ff9000' }}>«Номенклатура»</strong>, <strong style={{ color: '#60a5fa' }}>«Діаметр ріжучої частини»</strong>, <strong style={{ color: '#10b981' }}>«Залишок на складі»</strong>. Сортуються автоматично за діаметром.
        </p>

        {cuttersUploadStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}
            >
              <input 
                id="cutters-file-input" 
                type="file" 
                accept=".csv" 
                onChange={handleCuttersFileChange} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
              />
              <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>«Номенклатура» | «Діаметр ріжучої частини» | «Залишок на складі»</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: 'overwrite', label: '✎ Перезаписати (рекомендовано)' }, { v: 'add', label: '+ Додати до наявного' }].map(opt => (
                  <button key={opt.v} onClick={() => setCuttersRecordMode(opt.v)} type="button" style={{
                    background: cuttersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                    border: cuttersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                    color: cuttersRecordMode === opt.v ? '#ff9000' : '#888',
                    padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {cuttersUploadStatus === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { label: 'Всього фрез', val: cuttersPreviewList.length, color: '#ff9000' },
                { label: 'Унікальних діаметрів', val: new Set(cuttersPreviewList.map(i => i.diameter)).size, color: '#60a5fa' },
                { label: 'Загальна кількість', val: cuttersPreviewList.reduce((s, i) => s + i.qty, 0), color: '#10b981' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                    <th style={{ padding: '10px 16px' }}>Назва фрези</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', color: '#60a5fa' }}>Ø Діаметр (мм)</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', color: '#10b981' }}>Залишок (шт)</th>
                  </tr>
                </thead>
                <tbody>
                  {cuttersPreviewList.map((item, i) => {
                    const prevDiam = i > 0 ? cuttersPreviewList[i - 1].diameter : null
                    const isNewGroup = prevDiam !== item.diameter
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: isNewGroup && i > 0 ? 'rgba(255,144,0,0.02)' : 'transparent' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#eee' }}>{item.name}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', color: '#60a5fa', fontWeight: 900 }}>
                          {isNewGroup && <span style={{ display: 'inline-block', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', padding: '2px 10px' }}>Ø {item.diameter}</span>}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, color: '#10b981', fontSize: '1rem' }}>{item.qty}</td>
                      </tr>
                    )
                  })}
                  {cuttersPreviewList.length === 0 && <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Жодної фрези не знайдено</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ v: 'overwrite', label: '✎ Перезаписати' }, { v: 'add', label: '+ Додати' }].map(opt => (
                    <button key={opt.v} onClick={() => setCuttersRecordMode(opt.v)} type="button" style={{
                      background: cuttersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                      border: cuttersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                      color: cuttersRecordMode === opt.v ? '#ff9000' : '#888',
                      padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => { setCuttersUploadStatus('idle'); setCuttersFile(null); setCuttersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
                <button type="button" onClick={executeCuttersUpload} disabled={cuttersPreviewList.length === 0} style={{ background: cuttersPreviewList.length === 0 ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)', border: 'none', color: cuttersPreviewList.length === 0 ? '#555' : '#000', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: cuttersPreviewList.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({cuttersPreviewList.length} фрез)
                </button>
              </div>
            </div>
          </div>
        )}

        {cuttersUploadStatus === 'uploading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
            <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис залишків фрез у базу...</div>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
          </div>
        )}

        {cuttersUploadStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Залишки фрез оновлено. Нач. цеху може обрати фрезу зі складу при формуванні наряду.</p>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
            <button type="button" onClick={() => { setCuttersUploadStatus('idle'); setCuttersFile(null); setCuttersPreviewList([]); setCuttersUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
              ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
            </button>
          </div>
        )}

        {cuttersUploadStatus === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <AlertCircle size={52} color="#ef4444" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
            <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
            <button type="button" onClick={() => setCuttersUploadStatus('preview')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
              ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
            </button>
          </div>
        )}

      </section>

      {/* ── ЗАВАНТАЖЕННЯ ЗАЛИШКІВ МЕТИЗІВ (СВ) ── */}
      <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
          <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ МЕТИЗІВ (СВ)
        </h3>
        <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
          Завантажте CSV-файл залишків метизів для Складу Виробництва (СВ). Колонки: <strong style={{ color: '#ff9000' }}>«Номенклатура»</strong>, <strong style={{ color: '#10b981' }}>«Залишок на складі»</strong>.
        </p>

        {fastenersUploadStatus === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}
            >
              <input 
                id="fasteners-file-input" 
                type="file" 
                accept=".csv" 
                onChange={handleFastenersFileChange} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
              />
              <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>«Номенклатура» | «Залишок на складі»</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v: 'overwrite', label: '✎ Перезаписати (рекомендовано)' }, { v: 'add', label: '+ Додати до наявного' }].map(opt => (
                  <button key={opt.v} onClick={() => setFastenersRecordMode(opt.v)} type="button" style={{
                    background: fastenersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                    border: fastenersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                    color: fastenersRecordMode === opt.v ? '#ff9000' : '#888',
                    padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {fastenersUploadStatus === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { label: 'Всього метизів', val: fastenersPreviewList.length, color: '#ff9000' },
                { label: 'Загальна кількість', val: fastenersPreviewList.reduce((s, i) => s + i.qty, 0), color: '#10b981' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                    <th style={{ padding: '10px 16px' }}>Назва метизу</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', color: '#10b981' }}>Залишок (шт)</th>
                  </tr>
                </thead>
                <tbody>
                  {fastenersPreviewList.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#eee' }}>{item.name}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, color: '#10b981', fontSize: '1rem' }}>{item.qty}</td>
                    </tr>
                  ))}
                  {fastenersPreviewList.length === 0 && <tr><td colSpan={2} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Жодних метизів не знайдено</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ v: 'overwrite', label: '✎ Перезаписати' }, { v: 'add', label: '+ Додати' }].map(opt => (
                    <button key={opt.v} onClick={() => setFastenersRecordMode(opt.v)} type="button" style={{
                      background: fastenersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                      border: fastenersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                      color: fastenersRecordMode === opt.v ? '#ff9000' : '#888',
                      padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                    }}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => { setFastenersUploadStatus('idle'); setFastenersFile(null); setFastenersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
                <button type="button" onClick={executeFastenersUpload} disabled={fastenersPreviewList.length === 0} style={{ background: fastenersPreviewList.length === 0 ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)', border: 'none', color: fastenersPreviewList.length === 0 ? '#555' : '#000', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: fastenersPreviewList.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({fastenersPreviewList.length} метизів)
                </button>
              </div>
            </div>
          </div>
        )}

        {fastenersUploadStatus === 'uploading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
            <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис залишків метизів у базу...</div>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{fastenersUploadLog}</pre>
          </div>
        )}

        {fastenersUploadStatus === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <CheckCircle2 size={52} color="#10b981" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Залишки метизів на складі СВ оновлено.</p>
            <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{fastenersUploadLog}</pre>
            <button type="button" onClick={() => { setFastenersUploadStatus('idle'); setFastenersFile(null); setFastenersPreviewList([]); setFastenersUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
              ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
            </button>
          </div>
        )}

        {fastenersUploadStatus === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <AlertCircle size={52} color="#ef4444" />
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
            <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{fastenersUploadLog}</pre>
            <button type="button" onClick={() => setFastenersUploadStatus('preview')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
              ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
            </button>
          </div>
        )}

      </section>

    </div>
  )
}
