const fs = require('fs');
let code = fs.readFileSync('src/modules/ChatModule.jsx', 'utf8');

if (!code.includes('useSearchParams')) {
  code = code.replace("import { useNavigate } from 'react-router-dom'", "import { useNavigate, useSearchParams } from 'react-router-dom'");
}

const cmStartRegex = /const ChatModule = \(\) => \{\n  const \{ currentUser, systemUsers, supabase, pushEnabled \} = useMES\(\)\n  const navigate = useNavigate\(\)\n/;

const match = code.match(cmStartRegex);
if (match) {
  const newStart = match[0] + `  const [searchParams, setSearchParams] = useSearchParams()\n`;
  code = code.replace(cmStartRegex, newStart);
}

// Find a good place to put the support-ticket effect. 
// A good place is after activeParticipants (line ~350).
// We'll put it right before `return (` which is around line 1050, or just near the end of hooks.
// Let's just insert it before `const getThreadAvatar =` (line ~368 in my previous logs, wait, ~338 in original).
const getThreadAvatarRegex = /  const getThreadAvatar = \(thread\) => \{/;
const avatarMatch = code.match(getThreadAvatarRegex);
if (avatarMatch) {
  const supportEffect = `
  useEffect(() => {
    if (searchParams.get('support') === 'true' && systemUsers && systemUsers.length > 0 && threads.length > 0) {
      const adminUser = systemUsers.find(u => u.login === 'admin' || u.role === 'admin' || String(u.id) === '00000000-0000-0000-0000-000000000000' || u.is_admin);
      
      // Try to find Роман Пілецький if no obvious admin is found
      const targetUser = adminUser || systemUsers.find(u => u.first_name === 'Роман' && u.last_name === 'Пілецький') || systemUsers[0];
      
      if (targetUser && targetUser.id !== me.id) {
        const existingThread = threads.find(t => {
          const pRows = participants.filter(p => p.thread_id === t.id);
          return pRows.length === 2 && pRows.some(p => p.user_id === targetUser.id) && pRows.some(p => p.user_id === me.id);
        });
        
        if (existingThread) {
          setActiveThreadId(existingThread.id);
        } else {
          setCreateOpen(true);
          setSelectedUserIds([targetUser.id]);
          setNewTitle('Технічна підтримка');
        }
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, systemUsers, threads, participants, me.id, setSearchParams]);

`;
  code = code.replace(getThreadAvatarRegex, supportEffect + avatarMatch[0]);
  fs.writeFileSync('src/modules/ChatModule.jsx', code);
  console.log('Successfully updated ChatModule.jsx');
} else {
  console.log('Failed to match getThreadAvatar');
}
