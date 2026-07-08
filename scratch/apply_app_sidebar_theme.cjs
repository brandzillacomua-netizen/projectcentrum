const fs = require('fs');
const filePath = 'a:/centrum/src/App.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Sun, Moon to lucide-react imports
content = content.replace(
  `  ClipboardList,
  BellOff,
  ArrowLeft
} from 'lucide-react'`,
  `  ClipboardList,
  BellOff,
  ArrowLeft,
  Sun,
  Moon
} from 'lucide-react'`
);

// 2. Add theme, toggleTheme to useMES destructuring at line 251
content = content.replace(
  `const { currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines, tasks, orders, bomItems, workCardHistory, supabase, upsertUser } = useMES();`,
  `const { currentUser, managementTasks, requests, workCards, purchaseRequests, receptionDocs, nomenclatures, machineCalls, machines, tasks, orders, bomItems, workCardHistory, supabase, upsertUser, theme, toggleTheme } = useMES();`
);

// 3. Add the theme toggle button next to Settings button in user profile
content = content.replace(
  `            <button
              onClick={() => setActiveSubPanel('notif_settings')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#555',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#ff9000'}
              onMouseLeave={e => e.currentTarget.style.color = '#555'}
              title="Налаштування сповіщень"
            >
              <Settings size={18} />
            </button>`,
  `            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                onClick={toggleTheme}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme === 'light' ? '#eab308' : '#a78bfa',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                title="Перемикання теми"
              >
                {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={() => setActiveSubPanel('notif_settings')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#555',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ff9000'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}
                title="Налаштування сповіщень"
              >
                <Settings size={18} />
              </button>
            </div>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added theme toggle to main app sidebar drawer!');
