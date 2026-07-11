const fs = require('fs');

let code = fs.readFileSync('src/modules/ChatModule.jsx', 'utf8');
let lines = code.split(/\\r?\\n/);

// Add hooks
let navigateIndex = -1;
let showNewChatIndex = -1;
let activeParticipantsIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("import { useNavigate } from 'react-router-dom'")) {
    lines[i] = "import { useNavigate, useSearchParams } from 'react-router-dom'";
  }
  if (lines[i].includes("import { Search,")) {
    lines[i] = "import { Search, Users,";
  }
  if (lines[i].includes("const navigate = useNavigate()")) {
    navigateIndex = i;
  }
  if (lines[i].includes("const [showNewChat, setShowNewChat] = useState(false)")) {
    showNewChatIndex = i;
  }
  if (lines[i].includes("const activeParticipants = useMemo(() => {")) {
    activeParticipantsIndex = i;
  }
}

let spliceOffset = 0;

if (navigateIndex !== -1) {
  lines.splice(navigateIndex + 1 + spliceOffset, 0, "  const [searchParams, setSearchParams] = useSearchParams()");
  spliceOffset++;
}

if (showNewChatIndex !== -1) {
  lines.splice(showNewChatIndex + 1 + spliceOffset, 0, "  const [newChatType, setNewChatType] = useState('private')");
  spliceOffset++;
}

if (activeParticipantsIndex !== -1) {
  const supportEffect = [
    "  useEffect(() => {",
    "    if (searchParams.get('support') === 'true' && systemUsers && systemUsers.length > 0) {",
    "      const targetUser = systemUsers.find(u => {",
    "        const fullName = u.last_name ? `${u.first_name} ${u.last_name}` : (u.first_name || '');",
    "        const fullNameUpper = fullName.trim().toUpperCase();",
    "        return fullNameUpper === 'ADMIN SYSTEM' || ",
    "               fullNameUpper === 'SYSTEM ADMIN' ||",
    "               u.login === 'ADMIN SYSTEM' ||",
    "               u.first_name?.toUpperCase() === 'ADMIN' ||",
    "               u.login === 'admin' || ",
    "               u.role === 'admin' || ",
    "               String(u.id) === '00000000-0000-0000-0000-000000000000' || ",
    "               u.is_admin;",
    "      });",
    "      if (targetUser && targetUser.id !== me.id) {",
    "        const existingThread = threads.find(t => {",
    "          const pRows = participants.filter(p => p.thread_id === t.id);",
    "          return pRows.length === 2 && pRows.some(p => p.user_id === targetUser.id) && pRows.some(p => p.user_id === me.id);",
    "        });",
    "        if (existingThread) {",
    "          setActiveThreadId(existingThread.id);",
    "        } else {",
    "          const createSupportThread = async () => {",
    "            try {",
    "              const { data: threadRows, error: threadError } = await supabase",
    "                .from('chat_threads')",
    "                .insert([{",
    "                  title: 'Технічна підтримка',",
    "                  thread_type: 'group',",
    "                  created_by: me.id || null,",
    "                  created_by_login: me.login,",
    "                  created_by_name: me.name,",
    "                  last_message: 'Чат створено',",
    "                  last_message_at: new Date().toISOString()",
    "                }])",
    "                .select();",
    "              if (!threadError && threadRows && threadRows.length > 0) {",
    "                const newThread = threadRows[0];",
    "                const rows = [me.id, targetUser.id].map(uid => {",
    "                  const u = systemUsers.find(x => x.id === uid);",
    "                  return {",
    "                    thread_id: newThread.id,",
    "                    user_id: uid,",
    "                    user_login: u?.login || '',",
    "                    user_name: u ? (u.last_name ? `${u.last_name} ${u.first_name}`.trim() : u.first_name) : ''",
    "                  };",
    "                });",
    "                await supabase.from('chat_participants').insert(rows);",
    "                setActiveThreadId(newThread.id);",
    "              }",
    "            } catch (err) {",
    "              console.error('Error creating support chat:', err);",
    "            }",
    "          };",
    "          createSupportThread();",
    "        }",
    "      }",
    "      setSearchParams({}, { replace: true });",
    "    }",
    "  }, [searchParams, systemUsers, threads, participants, me, supabase, setSearchParams]);",
    ""
  ];
  lines.splice(activeParticipantsIndex + spliceOffset, 0, ...supportEffect);
  spliceOffset += supportEffect.length;
}

code = lines.join('\\n');

// Update sidebar spacing
code = code.replace(/justify-content: flex-start;/g, 'justify-content: space-between;');

// Add group icon to thread list
code = code.replace(
  /<div className="thread-title">\{displayTitle\}<\/div>/,
  \`<div className="thread-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>\n                      {rows.length > 2 && <Users size={12} style={{ opacity: 0.6 }} title="Груповий чат" />}\n                      {displayTitle}\n                    </div>\`
);

// Update Modal
const modalRegex = /\{showNewChat && \([\s\S]*?<div className="modal-backdrop">[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;

const modalCode = \`{showNewChat && (
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
                    className={\\\`user-pick \${selected ? 'selected' : ''}\\\`}
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
              {newChatType === 'group' ? \\\`Створити групу (\${selectedUserIds.length})\\\` : 'Почати чат'}
            </button>
          </div>
        </div>
      )}\`;

code = code.replace(modalRegex, modalCode);

fs.writeFileSync('src/modules/ChatModule.jsx', code);
console.log('Update UI script v3 done');
