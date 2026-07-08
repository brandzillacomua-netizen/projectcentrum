const fs = require('fs');
const filePath = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Sun, Moon to lucide-react imports
content = content.replace(
  `import { ArrowLeft, ArrowRight, Factory, ListTodo, Loader2, X, Printer, LayoutDashboard, Layers, User, Clock, Package, Scan, CheckCircle2, AlertTriangle, Camera, Tablet, Menu, Shuffle, RefreshCw } from 'lucide-react'`,
  `import { ArrowLeft, ArrowRight, Factory, ListTodo, Loader2, X, Printer, LayoutDashboard, Layers, User, Clock, Package, Scan, CheckCircle2, AlertTriangle, Camera, Tablet, Menu, Shuffle, RefreshCw, Sun, Moon } from 'lucide-react'`
);

// 2. Destructure theme, toggleTheme from useMES
content = content.replace(
  `const { tasks, orders, workCards, createWorkCard, createWorkCardsBatch, inventory, completeTaskByMaster, nomenclatures, bomItems, machines, machineOperations, workCardHistory, confirmBuffer, fetchData, reserveBZForTask, fetchTaskArchiveCards, fetchModuleData, fetchTaskPlanSnapshot, machineCalls, currentUser, createDovyпускMaterialRequests, requests: materialRequests } = useMES()`,
  `const { tasks, orders, workCards, createWorkCard, createWorkCardsBatch, inventory, completeTaskByMaster, nomenclatures, bomItems, machines, machineOperations, workCardHistory, confirmBuffer, fetchData, reserveBZForTask, fetchTaskArchiveCards, fetchModuleData, fetchTaskPlanSnapshot, machineCalls, currentUser, createDovyпускMaterialRequests, requests: materialRequests, theme, toggleTheme } = useMES()`
);

// 3. Add toggleTheme button inside navbar's left side div
content = content.replace(
  `          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>`,
  `          </button>
          <button onClick={toggleTheme} className="burger-btn" style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', borderRadius: '50%', transition: '0.2s' }}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully applied theme toggle to ForemanWorkplace!');
