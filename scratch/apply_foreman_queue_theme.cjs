const fs = require('fs');
const filePath = 'a:/centrum/src/modules/Foreman/components/ForemanTaskQueue.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Sun, Moon to imports and import useMES
content = content.replace(
  `import { X, ArrowRight, CheckCircle2, AlertTriangle, Clock, Layers } from 'lucide-react'`,
  `import { X, ArrowRight, CheckCircle2, AlertTriangle, Clock, Layers, Sun, Moon } from 'lucide-react'
import { useMES } from '../../../MESContext'`
);

// 2. Destructure theme, toggleTheme from useMES at the top of the component
content = content.replace(
  `export default function ForemanTaskQueue({`,
  `export default function ForemanTaskQueue({`
);

// Actually we need to call useMES inside the component:
content = content.replace(
  `  taskCardsCountMap,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  isDrawerOpen,
  setIsDrawerOpen,
  onSelectTask
}) {`,
  `  taskCardsCountMap,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  isDrawerOpen,
  setIsDrawerOpen,
  onSelectTask
}) {
  const { theme, toggleTheme } = useMES()`
);

// 3. Add the theme toggle button next to X button in header
content = content.replace(
  `      <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        ЧЕРГА НАРЯДІВ ({relevantTasks.length})
        {isDrawerOpen && (
          <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}>
            <X size={18} />
          </button>
        )}
      </div>`,
  `      <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>ЧЕРГА НАРЯДІВ ({relevantTasks.length})</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={toggleTheme} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          {isDrawerOpen && (
            <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully applied theme toggle to ForemanTaskQueue!');
