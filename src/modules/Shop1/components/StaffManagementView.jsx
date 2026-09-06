import React from 'react'
import { Plus, RefreshCw, RotateCcw } from 'lucide-react'

export const StaffManagementView = ({
  userForm,
  setUserForm,
  handleSaveUser,
  isProcessing,
  resolvedShop1Positions,
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
          {userForm.id ? '✏️ РЕДАГУВАННЯ СПІВРОБІТНИКА' : '➕ ДОДАТИ НОВОГО СПІВРОБІТНИКА'}
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
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Логін / Позивний</label>
              <input
                type="text"
                value={userForm.login || ''}
                onChange={e => setUserForm({ ...userForm, login: e.target.value })}
                placeholder="ivanov"
                className="form-input"
                required
                disabled={!!userForm.id}
              />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Пароль</label>
              <input
                type="password"
                value={userForm.password || ''}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                placeholder={userForm.id ? '••••••••' : 'Пароль'}
                className="form-input"
                required={!userForm.id}
                disabled={!!userForm.id}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label className="field-label" style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Посада</label>
              <select
                value={userForm.position || 'Оператор розкрою'}
                onChange={e => setUserForm({ ...userForm, position: e.target.value })}
                className="form-input"
              >
                {resolvedShop1Positions.map(pos => (
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

          {/* Access rights options */}
          <div className="access-rights-box" style={{ padding: '15px', borderRadius: '14px', marginTop: '5px' }}>
            <span style={{ fontSize: '0.65rem', color: '#eab308', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Права доступу до терміналів Цеху №1:</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.75rem', fontWeight: 700 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!userForm.access_rights?.operator}
                  onChange={e => setUserForm({
                    ...userForm,
                    access_rights: { ...userForm.access_rights, operator: e.target.checked }
                  })}
                />
                Оператор розкрою
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!userForm.access_rights?.tumbling_terminal}
                  onChange={e => setUserForm({
                    ...userForm,
                    access_rights: { ...userForm.access_rights, tumbling_terminal: e.target.checked }
                  })}
                />
                Галтовка
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!userForm.access_rights?.reception_terminal}
                  onChange={e => setUserForm({
                    ...userForm,
                    access_rights: { ...userForm.access_rights, reception_terminal: e.target.checked }
                  })}
                />
                Прийомка
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!userForm.access_rights?.sorting_terminal}
                  onChange={e => setUserForm({
                    ...userForm,
                    access_rights: { ...userForm.access_rights, sorting_terminal: e.target.checked }
                  })}
                />
                Сортування
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button
              type="submit"
              disabled={isProcessing}
              style={{
                flex: 1,
                background: '#eab308',
                color: '#000',
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
              {isProcessing ? <RefreshCw size={16} className="spin" /> : userForm.id ? <Plus size={16} /> : <Plus size={16} />}
              {userForm.id ? 'Зберегти зміни' : 'Створити акаунт'}
            </button>
            {userForm.id && (
              <button
                type="button"
                onClick={() => setUserForm({
                  id: null, login: '', password: '', first_name: '', last_name: '', position: 'Оператор розкрою', department: 'Цех №1', shift: 'Зміна 1', access_rights: { operator: true, shop1: true, tumbling_terminal: true, reception_terminal: true, sorting_terminal: true }
                })}
                style={{ background: '#222', color: '#aaa', border: 'none', padding: '14px 20px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Скасувати
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right Column: Shop 1 Staff Registry */}
      <div className="staff-list-card" style={{ borderRadius: '24px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h2 className="card-heading" style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>
            📋 СПИСОК ПЕРСОНАЛУ ({filteredUsers.length})
          </h2>
          <input
            type="text"
            placeholder="Пошук по прізвищу / логіну..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="form-input staff-search-input"
            style={{ width: '220px', marginTop: 0 }}
          />
        </div>

        <div style={{ overflowY: 'auto', maxHeight: '550px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredUsers.map(user => {
            const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?'
            const isMaster = ['начальник', 'майстер', 'мастер', 'керівник'].some(kw => String(user.position || '').toLowerCase().includes(kw))

            return (
              <div key={user.id} className={`staff-user-card ${isMaster ? 'master' : ''}`} style={{
                borderRadius: '16px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: isMaster ? 'linear-gradient(135deg, #ff9000, #ff5500)' : 'linear-gradient(135deg, #eab308, #ca8a04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontWeight: 900,
                    fontSize: '0.85rem'
                  }}>
                    {initials}
                  </div>
                  <div>
                    <div className="staff-name" style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                      {formatUserName(user)} <span className="staff-login" style={{ fontSize: '0.7rem', fontWeight: 600 }}>@{user.login}</span>
                    </div>
                    <div className="staff-meta" style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                      {user.position} | <span style={{ color: '#eab308', fontWeight: 700 }}>{user.shift || 'Без зміни'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => editUser(user)}
                    className="edit-user-btn"
                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Редагувати
                  </button>
                  <button
                    onClick={() => handleResetPassword(user)}
                    title="Скинути пароль"
                    className="reset-pass-btn"
                    style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>
            )
          })}

          {filteredUsers.length === 0 && (
            <div style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              Співробітників не знайдено
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
