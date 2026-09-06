import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { renderAvatar } from './NavAvatar.jsx';

const NOTIF_CONFIG = [
  { key: 'new_order', title: '📦 Нові замовлення', desc: 'Надсилати при створенні менеджером нового замовлення (очікує на створення наряду)' },
  { key: 'material_request', title: '📋 Запити матеріалів (ТМЦ)', desc: 'Надсилати при створенні майстром запиту на сировину чи матеріали зі складу' },
  { key: 'packaging_request', title: '📦 Комплектування та Пакування', desc: 'Надсилати при появі нових запитів на комплектування деталей для пакування замовлень' },
  { key: 'ready_to_ship', title: '🚚 Готовність до відвантаження', desc: 'Надсилати, коли партія повністю запакована і очікує логістичного відвантаження' },
  { key: 'supply_request', title: '🛒 Запити на закупівлю (Постачання)', desc: 'Надсилати при потребі закупівлі відсутніх матеріалів постачальниками' },
  { key: 'machine_call', title: '⚠️ Виклики персоналу', desc: 'Надсилати при терміновому виклику оператором допомоги (майстра, інженера, ВКЯ) до верстату' },
  { key: 'shortage', title: '🚨 Нестачі та довипуски', desc: 'Надсилати при виявленні браку та необхідності довипуску деталей для замовлення' },
  { key: 'kanban', title: '📋 Задачі Kanban', desc: 'Надсилати при призначенні вам нових завдань або оновленні задач на дошці Kanban' },
  { key: 'task_completed', title: '✅ Виконання нарядів та етапів', desc: 'Надсилати, коли всі карти розкрою завершені та наряд готовий до закриття у цеху' }
];

export function NavSettingsPanel({
  isOpen,
  onBack,
  currentUser,
  notifSettings,
  onUpdateNotifSetting,
  upsertUser
}) {
  const [settingsTab, setSettingsTab] = useState('notif'); // 'notif' or 'profile'
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const wasOpenedRef = useRef(false);
  useEffect(() => {
    if (isOpen) {
      if (!wasOpenedRef.current && currentUser) {
        setProfileFirstName(currentUser.first_name || '');
        setProfileLastName(currentUser.last_name || '');
        setProfilePassword(currentUser.password || '');
        setProfileAvatar(currentUser.avatar || currentUser.notification_settings?.avatar || '');
        setSettingsTab('notif');
        wasOpenedRef.current = true;
      }
    } else {
      wasOpenedRef.current = false;
    }
  }, [isOpen, currentUser]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 128, 128);

        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        setProfileAvatar(base64);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!profileFirstName.trim() || !profileLastName.trim()) {
      alert("Ім'я та Прізвище не можуть бути порожніми!");
      return;
    }
    setIsSavingProfile(true);
    try {
      const updatedSettings = {
        ...currentUser?.notification_settings,
        ...notifSettings,
        avatar: profileAvatar
      };

      const payload = {
        ...currentUser,
        first_name: profileFirstName.trim(),
        last_name: profileLastName.trim(),
        password: profilePassword,
        avatar: profileAvatar,
        notification_settings: updatedSettings
      };
      delete payload.token; // Clear token to prevent schema cache error in Supabase

      if (typeof upsertUser === 'function') {
        const { data, error } = await upsertUser(payload);
        if (error) {
          alert(`Помилка збереження: ${error.message}`);
        } else {
          localStorage.setItem('MES_SESSION_USER', JSON.stringify(data || payload));
          alert('Профіль успішно оновлено!');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Не вдалося зберегти зміни профілю.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(8, 8, 8, 0.98)',
      backdropFilter: 'blur(25px)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      pointerEvents: isOpen ? 'auto' : 'none'
    }}>
      {/* Header section with Back */}
      <div style={{
        padding: '24px 20px 20px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ff9000',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 800,
            padding: '6px 0'
          }}
        >
          <ArrowLeft size={16} /> Назад
        </button>
        <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff' }}>
          Налаштування
        </span>
      </div>

      {/* Tab Selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '0 20px' }}>
        <button
          onClick={() => setSettingsTab('notif')}
          style={{
            flex: 1,
            padding: '12px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: settingsTab === 'notif' ? '2.5px solid #ff9000' : '2.5px solid transparent',
            color: settingsTab === 'notif' ? '#fff' : '#555',
            fontWeight: 850,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
        >
          Сповіщення
        </button>
        <button
          onClick={() => setSettingsTab('profile')}
          style={{
            flex: 1,
            padding: '12px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: settingsTab === 'profile' ? '2.5px solid #ff9000' : '2.5px solid transparent',
            color: settingsTab === 'profile' ? '#fff' : '#555',
            fontWeight: 850,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
        >
          Профіль
        </button>
      </div>

      {/* Settings List */}
      <div className="sidebar-links-container" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {settingsTab === 'notif' ? (
          <>
            <div style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '15px' }}>
              Керування типами сповіщень
            </div>

            {NOTIF_CONFIG.map(cfg => {
              const isEnabled = notifSettings[cfg.key] !== false;
              return (
                <div key={cfg.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingRight: '12px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>{cfg.title}</span>
                    <span style={{ fontSize: '0.68rem', color: '#555', lineHeight: '1.2' }}>
                      {cfg.desc}
                    </span>
                  </div>
                  <div
                    onClick={() => onUpdateNotifSetting(cfg.key, !isEnabled)}
                    style={{
                      width: '40px',
                      height: '22px',
                      borderRadius: '11px',
                      background: isEnabled ? '#ff9000' : '#222',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: '2px',
                      left: isEnabled ? '20px' : '2px',
                      transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                    }} />
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          /* Profile tab content */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Avatar section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
              <div style={{ position: 'relative' }}>
                {renderAvatar(
                  profileAvatar,
                  (profileFirstName?.[0] || '') + (profileLastName?.[0] || ''),
                  '80px',
                  '1.8rem'
                )}
                <label
                  htmlFor="avatar-upload-input"
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    background: '#ff9000',
                    color: '#000',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    border: '2px solid #080808'
                  }}
                  title="Завантажити фото"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </label>
                <input
                  type="file"
                  id="avatar-upload-input"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: '#666' }}>Натисніть на іконку для завантаження фото</span>

              {/* Preset Gradients Selection */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                {['orange', 'purple', 'blue', 'emerald', 'ruby'].map(g => (
                  <button
                    key={g}
                    onClick={() => setProfileAvatar(g)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      border: profileAvatar === g ? '2px solid #fff' : '2.5px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      background: g === 'orange' ? 'linear-gradient(135deg, #ff9000, #ff5500)' :
                        g === 'purple' ? 'linear-gradient(135deg, #a855f7, #6366f1)' :
                          g === 'blue' ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' :
                            g === 'emerald' ? 'linear-gradient(135deg, #10b981, #059669)' :
                              'linear-gradient(135deg, #f43f5e, #be123c)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      transition: 'all 0.1s ease'
                    }}
                    title={`Пресет: ${g}`}
                  />
                ))}
              </div>
            </div>

            {/* Form fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800, textTransform: 'uppercase' }}>Ім'я</label>
                <input
                  type="text"
                  value={profileFirstName}
                  onChange={e => setProfileFirstName(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    width: '100%'
                  }}
                  onFocus={e => e.target.style.borderColor = '#ff9000'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800, textTransform: 'uppercase' }}>Прізвище</label>
                <input
                  type="text"
                  value={profileLastName}
                  onChange={e => setProfileLastName(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    width: '100%'
                  }}
                  onFocus={e => e.target.style.borderColor = '#ff9000'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.72rem', color: '#666', fontWeight: 800, textTransform: 'uppercase' }}>Новий пароль</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={profilePassword}
                    onChange={e => setProfilePassword(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      padding: '10px 40px 10px 14px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      width: '100%',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#ff9000'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#555',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
              style={{
                background: '#ff9000',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontWeight: 900,
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                opacity: isSavingProfile ? 0.6 : 1,
                width: '100%'
              }}
              onMouseEnter={e => { if (!isSavingProfile) e.currentTarget.style.background = '#e07e00'; }}
              onMouseLeave={e => { if (!isSavingProfile) e.currentTarget.style.background = '#ff9000'; }}
            >
              {isSavingProfile ? (
                <div style={{ width: '16px', height: '16px', border: '2.5px solid #000', borderTop: '2.5px solid transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {isSavingProfile ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
