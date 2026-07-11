const fs = require('fs');
let code = fs.readFileSync('src/modules/ChatModule.jsx', 'utf8');

// 1. Add newChatType state
if (!code.includes("const [newChatType, setNewChatType] = useState('private')")) {
  code = code.replace(
    "const [showNewChat, setShowNewChat] = useState(false)\n  const [newTitle, setNewTitle] = useState('')",
    "const [showNewChat, setShowNewChat] = useState(false)\n  const [newChatType, setNewChatType] = useState('private')\n  const [newTitle, setNewTitle] = useState('')"
  );
}

// 2. Add Users icon import
if (!code.includes("import { Search, Users,")) {
  code = code.replace("import { Search,", "import { Search, Users,");
}

// 3. Update the modal UI
const modalRegex = /\{showNewChat && \([\s\S]*?<div className="modal-backdrop">[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;

const modalCode = `{showNewChat && (
        <div className="modal-backdrop" onClick={() => setShowNewChat(false)}>
          <div className="new-chat-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div>
                <div className="eyebrow"><Users size={14} /> Нова бесіда</div>
                <h3>Створити чат</h3>
              </div>
              <button
                className="icon-btn"
                onClick={() => {
                  setShowNewChat(false)
                  setUserSearch('')
                }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', padding: '0 16px', marginTop: '12px', marginBottom: '8px' }}>
              <button
                onClick={() => { setNewChatType('private'); setSelectedUserIds([]); setNewTitle(''); }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px',
                  background: newChatType === 'private' ? 'rgba(255,144,0,0.15)' : 'transparent',
                  color: newChatType === 'private' ? '#ff9000' : '#888',
                  border: newChatType === 'private' ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                }}
              >Особистий</button>
              <button
                onClick={() => { setNewChatType('group'); setSelectedUserIds([]); }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px',
                  background: newChatType === 'group' ? 'rgba(255,144,0,0.15)' : 'transparent',
                  color: newChatType === 'group' ? '#ff9000' : '#888',
                  border: newChatType === 'group' ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s'
                }}
              >Група</button>
            </div>

            {newChatType === 'group' && (
              <input
                className="title-input"
                style={{ margin: '8px 16px', width: 'calc(100% - 32px)' }}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Введіть назву групи..."
              />
            )}

            <div className="member-search" style={{ marginTop: newChatType === 'group' ? 0 : '12px' }}>
              <Search size={16} />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder={newChatType === 'private' ? "Пошук співрозмовника..." : "Пошук учасників групи..."}
                autoFocus
              />
              {userSearch && (
                <button className="mini-clear" onClick={() => setUserSearch('')} title="Очистити пошук">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="users-picker">
              {filteredUsers.length === 0 ? (
                <div className="empty-state compact">Нікого не знайдено</div>
              ) : filteredUsers.map(user => {
                const selected = selectedUserIds.includes(user.id)
                return (
                  <button
                    key={user.id}
                    className={\`user-pick \${selected ? 'selected' : ''}\`}
                    onClick={() => {
                      if (newChatType === 'private') {
                        setSelectedUserIds([user.id])
                      } else {
                        toggleSelectedUser(user.id)
                      }
                    }}
                  >
                    <span className="user-pick-main">
                      <b>{formatUserName(user)}</b>
                      <small>{[user.position, user.department, user.login].filter(Boolean).join(' · ')}</small>
                    </span>
                    {selected ? <Check size={16} /> : <Plus size={15} />}
                  </button>
                )
              })}
            </div>
            <button 
              className="create-btn" 
              onClick={createThread} 
              disabled={sending || selectedUserIds.length === 0 || (newChatType === 'group' && selectedUserIds.length < 2)}
            >
              {sending ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
              {newChatType === 'group' ? \`Створити групу (\${selectedUserIds.length})\` : 'Почати чат'}
            </button>
          </div>
        </div>
      )}`;

if (code.match(modalRegex)) {
  code = code.replace(modalRegex, modalCode);
} else {
  console.log('modalRegex did not match!');
}

fs.writeFileSync('src/modules/ChatModule.jsx', code);
console.log('Update UI script done');
