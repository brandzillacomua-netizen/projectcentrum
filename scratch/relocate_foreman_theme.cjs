const fs = require('fs');
const filePath = 'a:/centrum/src/modules/ForemanWorkplace.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Remove theme button from nav
content = content.replace(
  `          </button>
          <button onClick={toggleTheme} className="burger-btn" style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', borderRadius: '50%', transition: '0.2s' }}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>`,
  `          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully removed theme toggle from ForemanWorkplace navbar!');
