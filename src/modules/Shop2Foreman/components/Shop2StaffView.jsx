import React from 'react'
import { Plus, RefreshCw, RotateCcw } from 'lucide-react'

const SHOP2_ACCESS_OPTIONS = [
  { key: 'shop2_terminal', label: 'Термінал Цеху №2' },
  { key: 'pressing_terminal', label: 'Термінал Пресування' },
  { key: 'painting_terminal', label: 'Термінал Фарбування' },
  { key: 'rework_terminal', label: 'Термінал Доопрацювання' },
  { key: 'shop2_foreman', label: 'Кабінет Нач. Цеху №2' }
]

export const Shop2StaffView = ({
  userForm,
  setUserForm,
  handleSaveUser,
  isProcessing,
  resolvedShop2Positions,
  userSearch,
  setUserSearch,
  filteredUsers,
  editUser,
  handleResetPassword,
  formatUserName
}) => {
  return (
    <div className="staff-management-view" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '25px' }}>
      {/* Left Column: Create/Edit User Form */}
      <div className="staff-form-card" style={{ borderRadius: '24px', padding: '25px' }}>
        <h2 className="card-heading" style={{ fontSize: '1.1rem', fontWeight: 900, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {userForm.id ? '✏️ РЕДАГУВАННЯ СПІВРОБІТНИКА' : '➕ ДОДАТИ СПІВРОБІТНИКА ЦЕХУ №2'}
        </h2>

        <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Ім'я</label>
              <input
                type="text"
                value={userForm.first_name || ''}
                onChange={e => setUserForm({ ...userForm, first_name: e.target.value })}
                placeholder="Іван"
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Прізвище</label>
              <input
                type="text"
                value={userForm.last_name || ''}
                onChange={e => setUserForm({ ...userForm, last_name: e.target.value })}
                placeholder="Іванов"
                className="form-input"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Логін (ID)</label>
              <input
                type="text"
                value={userForm.login || ''}
                onChange={e => setUserForm({ ...userForm, login: e.target.value })}
                placeholder="ivanov_s2"
                className="form-input"
                required
                disabled={!!userForm.id}
              />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
                {userForm.id ? 'Новий пароль (необов\'язково)' : 'Пароль'}
              </label>
              <input
                type="password"
                value={userForm.password || ''}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="••••••"
                className="form-input"
                required={!userForm.id}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Посада (Роль)</label>
              <select
                value={userForm.position || 'Фарбувальник'}
                onChange={e => setUserForm({ ...userForm, position: e.target.value })}
                className="form-input"
              >
                {resolvedShop2Positions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Зміна</label>
              <select
                value={userForm.shift || 'Зміна 1'}
                onChange={e => setUserForm({ ...userForm, shift: e.target.value })}
                className="form-input"
              >
                <option value="Зміна 1">Зміна 1</option>
                <option value="Зміна 2">Зміна 2</option>
                <option value="Зміна 3">Зміна 3</option>
                <option value="Зміна 4">Зміна 4</option>
                <option value="Без зміни">Без зміни</option>
              </select>
            </div>
          </div>

          <div className="access-rights-box" style={{ padding: '15px', borderRadius: '14px', marginTop: '5px' }}>
            <span style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
              Права доступу до модулів Цеху №2:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
              {SHOP2_ACCESS_OPTIONS.map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!userForm.access_rights?.[opt.key]}
                    onChange={e => setUserForm({
                      ...userForm,
                      access_rights: { ...userForm.access_rights, [opt.key]: e.target.checked }
                    })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="submit"
              disabled={isProcessing}
              style={{
                flex: 1,
                background: '#8b5cf6',
                color: '#fff',
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isProcessing ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />}
              {userForm.id ? 'Зберегти зміни' : 'Створити акаунт'}
            </button>

            {userForm.id && (
              <button
                type="button"
                onClick={() => setUserForm({
                  id: null,
                  login: '',
                  password: '',
                  first_name: '',
                  last_name: '',
                  position: 'Фарбувальник',
                  department: 'Цех №2',
                  shift: 'Зміна 1',
                  access_rights: {
                    shop2_terminal: true,
                    pressing_terminal: true,
                    painting_terminal: true,
                    rework_terminal: false,
                    shop2_foreman: false
                  }
                })}
                style={{
                  background: 'var(--fill-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-strong)',
                  padding: '0 20px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Скасувати
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right Column: Staff Directory */}
      <div className="staff-list-card" style={{ borderRadius: '24px', padding: '25px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '15px', flexWrap: 'wrap' }}>
          <h2 className="card-heading" style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>
            👥 ПЕРСОНАЛ ЦЕХУ №2 ({filteredUsers.length})
          </h2>
          <input
            type="text"
            placeholder="Пошук ПІБ, посада, логін..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="form-input"
            style={{ width: '220px', padding: '8px 14px', fontSize: '0.78rem' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto' }}>
          {filteredUsers.map(u => (
            <div key={u.id} style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--text-strong)' }}>{formatUserName(u)}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {u.position || 'Працівник'} · {u.shift || 'Без зміни'} · @{u.login}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => editUser(u)}
                  style={{
                    background: 'var(--fill-subtle)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-strong)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Редаг.
                </button>
                <button
                  onClick={() => handleResetPassword(u)}
                  title="Скинути пароль"
                  style={{
                    background: 'var(--fill-subtle)',
                    border: '1px solid var(--border-subtle)',
                    color: '#eab308',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Не знайдено жодного співробітника з відділом «Цех 2» / «Цех №2»
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

