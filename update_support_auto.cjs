const fs = require('fs');
let code = fs.readFileSync('src/modules/ChatModule.jsx', 'utf8');

const supportEffectRegex = /useEffect\(\(\) => \{\n    if \(searchParams\.get\('support'\) === 'true'[\s\S]*?setSearchParams\(\{\}, \{ replace: true \}\);\n    \}\n  \}, \[searchParams, systemUsers, threads, participants, me\.id, setSearchParams\]\);\n/;

const newSupportEffect = `
  useEffect(() => {
    if (searchParams.get('support') === 'true' && systemUsers && systemUsers.length > 0 && threads.length > 0) {
      const targetUser = systemUsers.find(u => 
        (u.first_name + ' ' + u.last_name).trim().toUpperCase() === 'ADMIN SYSTEM' || 
        u.login === 'ADMIN SYSTEM' ||
        u.first_name?.toUpperCase() === 'ADMIN' ||
        u.login === 'admin' || 
        u.role === 'admin' || 
        String(u.id) === '00000000-0000-0000-0000-000000000000' || 
        u.is_admin
      );
      
      if (targetUser && targetUser.id !== me.id) {
        const existingThread = threads.find(t => {
          const pRows = participants.filter(p => p.thread_id === t.id);
          return pRows.length === 2 && pRows.some(p => p.user_id === targetUser.id) && pRows.some(p => p.user_id === me.id);
        });
        
        if (existingThread) {
          setActiveThreadId(existingThread.id);
        } else {
          // Automatically create a new thread with ADMIN SYSTEM
          const createSupportThread = async () => {
            try {
              const { data: threadRows, error: threadError } = await supabase
                .from('chat_threads')
                .insert([{
                  title: 'Технічна підтримка',
                  thread_type: 'group',
                  created_by: me.id || null,
                  created_by_login: me.login,
                  created_by_name: me.name,
                  last_message: 'Чат створено',
                  last_message_at: new Date().toISOString()
                }])
                .select();
                
              if (!threadError && threadRows && threadRows.length > 0) {
                const newThread = threadRows[0];
                const rows = [me.id, targetUser.id].map(uid => {
                  const u = systemUsers.find(x => x.id === uid);
                  return {
                    thread_id: newThread.id,
                    user_id: uid,
                    user_login: u?.login || '',
                    user_name: u ? (u.last_name ? \`\${u.last_name} \${u.first_name}\`.trim() : u.first_name) : ''
                  };
                });
                await supabase.from('chat_participants').insert(rows);
                setActiveThreadId(newThread.id);
              }
            } catch (err) {
              console.error('Error creating support chat:', err);
            }
          };
          createSupportThread();
        }
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, systemUsers, threads, participants, me, supabase, setSearchParams]);
`;

code = code.replace(supportEffectRegex, newSupportEffect);
fs.writeFileSync('src/modules/ChatModule.jsx', code);
console.log('Done replacing effect');
