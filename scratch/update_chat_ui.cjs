const fs = require('fs');

let code = fs.readFileSync('src/modules/ChatModule.jsx', 'utf8');

// 1. Fix sidebar header spacing
code = code.replace(
  /justify-content: flex-start;/g,
  'justify-content: space-between;'
);

// 2. Add 'Users' icon for groups in thread list
const threadTitleRegex = /<div className="thread-title">\{displayTitle\}<\/div>/;
const newThreadTitle = `
                    <div className="thread-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {rows.length > 2 && <Users size={12} style={{ opacity: 0.6 }} title="Груповий чат" />}
                      {displayTitle}
                    </div>
`;
code = code.replace(threadTitleRegex, newThreadTitle);

// 3. Update the New Chat modal
// First, add a state for newChatType
const stateRegex = /const \[showNewChat, setShowNewChat\] = useState\(false\)\n  const \[newTitle, setNewTitle\] = useState\(''\)/;
if (code.match(stateRegex)) {
  code = code.replace(
    stateRegex,
    `const [showNewChat, setShowNewChat] = useState(false)\n  const [newChatType, setNewChatType] = useState('private')\n  const [newTitle, setNewTitle] = useState('')`
  );
}

// Ensure `Users` icon is imported
if (!code.includes('Users,')) {
  code = code.replace("import { Search,", "import { Search, Users,");
}

// 4. Update the actual Modal UI
const modalRegex = /\{showNewChat && \([\s\S]*?<div className="modal-head">\s*<h3>Новий чат<\/h3>\s*<button className="icon-btn" onClick=\{\(\) => setShowNewChat\(false\)\}>\s*<X size=\{18\} \/>\s*<\/button>\s*<\/div>\s*<div className="modal-body">\s*<div className="field">\s*<label>Назва чату \(необов'язково\)<\/label>\s*<input\s*value=\{newTitle\}\s*onChange=\{e => setNewTitle\(e\.target\.value\)\}\s*placeholder="Наприклад: Обговорення проекту"\s*\/>\s*<\/div>\s*<div className="field">\s*<label>Оберіть учасників<\/label>[\s\S]*?<div className="modal-footer">\s*<button className="primary-btn" onClick=\{handleCreateDirectChat\} disabled=\{sending \|\| selectedUserIds\.length === 0\}>\s*\{sending \? 'Створення\.\.\.' : 'Створити чат'\}\s*<\/button>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/;

const match = code.match(modalRegex);
if (match) {
  const newModal = `{showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-content new-chat-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Новий чат</h3>
              <button className="icon-btn" onClick={() => setShowNewChat(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
                <button 
                  onClick={() => { setNewChatType('private'); setSelectedUserIds([]); setNewTitle(''); }}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', background: newChatType === 'private' ? 'rgba(255,144,0,0.2)' : 'transparent', color: newChatType === 'private' ? '#ff9000' : '#888', fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s' }}>
                  Особистий
                </button>
                <button 
                  onClick={() => { setNewChatType('group'); setSelectedUserIds([]); }}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', background: newChatType === 'group' ? 'rgba(255,144,0,0.2)' : 'transparent', color: newChatType === 'group' ? '#ff9000' : '#888', fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s' }}>
                  Група
                </button>
              </div>

              {newChatType === 'group' && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Назва групи</label>
                  <input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Введіть назву групи..."
                  />
                </div>
              )}

              <div className="field">
                <label>{newChatType === 'private' ? 'Оберіть співрозмовника' : 'Оберіть учасників'}</label>
                <div className="search-box">
                  <Search size={16} />
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Пошук працівників..." />
                </div>
                <div className="users-list-scroll">
                  {users.filter(u => formatUserName(u).toLowerCase().includes(userSearch.toLowerCase())).map(u => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        className={\`user-list-item \${isSelected ? 'selected' : ''}\`}
                        onClick={() => {
                          if (newChatType === 'private') {
                            setSelectedUserIds([u.id]);
                          } else {
                            setSelectedUserIds(prev =>
                              prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                            );
                          }
                        }}
                      >
                        <ChatAvatar src={u.avatar} label={formatUserName(u)} size="small" />
                        <div className="uli-info">
                          <span className="uli-name">{formatUserName(u)}</span>
                          <span className="uli-role">{u.position || u.role}</span>
                        </div>
                        {isSelected && <Check size={16} color="#ff9000" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="primary-btn" 
                onClick={handleCreateDirectChat} 
                disabled={sending || selectedUserIds.length === 0 || (newChatType === 'group' && !newTitle.trim())}
                style={{ width: '100%' }}
              >
                {sending ? 'Створення...' : newChatType === 'private' ? 'Почати спілкування' : 'Створити групу'}
              </button>
            </div>
          </div>
        </div>
      )}`;
  code = code.replace(modalRegex, newModal);
} else {
  console.log('Failed to match modal');
}

fs.writeFileSync('src/modules/ChatModule.jsx', code);
console.log('Update successful');
