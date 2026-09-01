import fs from 'fs'

const appPath = 'b:/kylutsya/src/App.jsx'
let code = fs.readFileSync(appPath, 'utf8')

// 1. Add LayoutGrid and Box to lucide-react imports
if (!code.includes('LayoutGrid,')) {
  code = code.replace("  LayoutDashboard,", "  LayoutDashboard,\n  LayoutGrid,\n  Box,")
}

// 2. Replace mobile navigation structure in App.jsx
const oldBlockMarker = `{/* Floating Mobile Trigger Button */}`
const catalogStartIdx = code.indexOf(oldBlockMarker)

if (catalogStartIdx !== -1) {
  const replacement = `{/* Mobile Sticky Top Header Bar */}
      <header className="mobile-top-bar">
        <Link to="/" onClick={() => setIsMobileOpen(false)} className="mobile-brand-logo">
          <img src="/kulytsya.png" alt="Logo" style={{ height: '30px', filter: 'drop-shadow(0 0 8px rgba(255,144,0,0.4))' }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 950, color: 'var(--text-main, #ffffff)', letterSpacing: '-0.3px' }}>
            CENTRUM <span style={{ color: '#ff9000' }}>3-IN-1</span>
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={toggleTheme} className="mobile-header-icon-btn" title="Перемикання теми">
            {theme === 'light' ? <Sun size={17} color="#eab308" /> : <Moon size={17} color="#a78bfa" />}
          </button>
          <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="mobile-header-menu-btn" title="Меню навігації">
            {isMobileOpen ? <X size={20} color="#ff9000" /> : <Menu size={20} color="#ff9000" />}
          </button>
        </div>
      </header>

      {/* Mobile Floating Glass Bottom Dock */}
      <nav className="mobile-bottom-dock">
        <Link to="/" onClick={() => setIsMobileOpen(false)} className={\`dock-item \${location.pathname === '/' ? 'active' : ''}\`}>
          <LayoutGrid size={18} />
          <span>Головна</span>
        </Link>
        <Link to="/crm" onClick={() => setIsMobileOpen(false)} className={\`dock-item \${location.pathname.startsWith('/crm') || location.pathname.startsWith('/clients') ? 'active crm' : ''}\`}>
          <Briefcase size={18} />
          <span>CRM</span>
        </Link>
        <Link to="/nomenclature-v2" onClick={() => setIsMobileOpen(false)} className={\`dock-item \${location.pathname.startsWith('/nomenclature') || location.pathname.startsWith('/warehouse') ? 'active erp' : ''}\`}>
          <Box size={18} />
          <span>ERP</span>
        </Link>
        <Link to="/foreman-dashboard" onClick={() => setIsMobileOpen(false)} className={\`dock-item \${location.pathname.startsWith('/foreman') || location.pathname.startsWith('/engineer') ? 'active mes' : ''}\`}>
          <Cpu size={18} />
          <span>MES</span>
        </Link>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className={\`dock-item \${isMobileOpen ? 'active' : ''}\`}>
          <Menu size={18} color="#ff9000" />
          <span style={{ color: '#ff9000', fontWeight: 800 }}>Меню</span>
        </button>
      </nav>`

  const endSearch = `<aside className={`
  const endIdx = code.indexOf(endSearch, catalogStartIdx)

  if (endIdx !== -1) {
    code = code.substring(0, catalogStartIdx) + replacement + '\n\n      ' + code.substring(endIdx)
    fs.writeFileSync(appPath, code, 'utf8')
    console.log('Successfully updated mobile header and bottom dock in App.jsx!')
  }
}
