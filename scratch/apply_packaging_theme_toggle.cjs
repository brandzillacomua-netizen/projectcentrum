const fs = require('fs');
const filePath = 'a:/centrum/src/modules/PackagingModule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Sun, Moon to lucide-react imports
content = content.replace(
  `import { Package, ArrowLeft, ClipboardList, CheckCircle2, Box, Send, AlertCircle, Wrench, FileArchive, Layers, Clock, Scan, Loader2, Hash, Save, Eye, X, Menu, Plus, Search, Trash2 } from 'lucide-react'`,
  `import { Package, ArrowLeft, ClipboardList, CheckCircle2, Box, Send, AlertCircle, Wrench, FileArchive, Layers, Clock, Scan, Loader2, Hash, Save, Eye, X, Menu, Plus, Search, Trash2, Sun, Moon } from 'lucide-react'`
);

// 2. Destructure theme, toggleTheme from useMES
content = content.replace(
  `    orders, tasks, nomenclatures, bomItems,
    submitPickingRequest, requests, supabase,
    fetchData, completePackaging, systemUsers,
    inventory
  } = useMES()`,
  `    orders, tasks, nomenclatures, bomItems,
    submitPickingRequest, requests, supabase,
    fetchData, completePackaging, systemUsers,
    inventory, theme, toggleTheme
  } = useMES()`
);

// 3. Add the theme toggle button inside navbar's left side div
content = content.replace(
  `          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>`,
  `          </button>
          <button onClick={toggleTheme} className="burger-btn" style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', borderRadius: '50%', transition: '0.2s' }}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully applied theme toggle to PackagingModule!');
