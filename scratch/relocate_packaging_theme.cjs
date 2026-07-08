const fs = require('fs');
const filePath = 'a:/centrum/src/modules/PackagingModule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove theme button from nav
content = content.replace(
  `          </button>
          <button onClick={toggleTheme} className="burger-btn" style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', borderRadius: '50%', transition: '0.2s' }}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>`,
  `          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>`
);

// 2. Add theme button inside sidebar header
content = content.replace(
  `            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
              <ClipboardList size={22} color="#f43f5e" />
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase' }}>Черга нарядів</h3>
              <span style={{ background: '#f43f5e22', color: '#f43f5e', padding: '4px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 950 }}>{batchList.length}</span>
              {isDrawerOpen && (
                <button onClick={() => setIsDrawerOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              )}
            </div>`,
  `            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
              <ClipboardList size={22} color="#f43f5e" />
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase' }}>Черга нарядів</h3>
              <span style={{ background: '#f43f5e22', color: '#f43f5e', padding: '4px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 950 }}>{batchList.length}</span>
              <button onClick={toggleTheme} className="burger-btn" style={{ marginLeft: 'auto', padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', borderRadius: '50%' }}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              {isDrawerOpen && (
                <button onClick={() => setIsDrawerOpen(false)} style={{ marginLeft: '10px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              )}
            </div>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully relocated theme toggle in PackagingModule!');
