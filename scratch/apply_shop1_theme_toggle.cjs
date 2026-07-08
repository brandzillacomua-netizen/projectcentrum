const fs = require('fs');
const filePath = 'a:/centrum/src/modules/Shop1Terminal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Sun, Moon to imports
content = content.replace(
  `import { ArrowLeft, Camera, X, ChevronRight, Package, AlertTriangle, ClipboardList, Menu, ArrowRight, Layers, RefreshCw, Eye, Search, QrCode } from 'lucide-react'`,
  `import { ArrowLeft, Camera, X, ChevronRight, Package, AlertTriangle, ClipboardList, Menu, ArrowRight, Layers, RefreshCw, Eye, Search, QrCode, Sun, Moon } from 'lucide-react'`
);

// 2. Add theme, toggleTheme to useMES destructuring
content = content.replace(
  `const { workCards, setWorkCards, nomenclatures, operators, getFilteredOperators, getFilteredManagers, managers, workCardHistory, inventory, fetchData, createWorkCard, orders, bomItems, tasks, currentUser, machines, systemUsers, machineOperations, formatUserName, requests } = useMES()`,
  `const { workCards, setWorkCards, nomenclatures, operators, getFilteredOperators, getFilteredManagers, managers, workCardHistory, inventory, fetchData, createWorkCard, orders, bomItems, tasks, currentUser, machines, systemUsers, machineOperations, formatUserName, requests, theme, toggleTheme } = useMES()`
);

// 3. Add toggleTheme inside desktop sidebar header
content = content.replace(
  `            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 900, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ClipboardList size={16} /> ЧЕРГА КАРТ ({queueCards.length})
            </div>`,
  `            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 900, color: '#555', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ClipboardList size={16} /> ЧЕРГА КАРТ ({queueCards.length})
              </div>
              <button onClick={toggleTheme} className="burger-btn" style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
            </div>`
);

// 4. Add toggleTheme inside mobile drawer header
content = content.replace(
  `            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#eab308' }}>ЧЕРГА (ОБЕРІТЬ КАРТУ)</span>
              <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
            </div>`,
  `            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#eab308' }}>ЧЕРГА (ОБЕРІТЬ КАРТУ)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={toggleTheme} className="burger-btn" style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                </button>
                <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
              </div>
            </div>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully applied theme toggle to Shop1Terminal!');
