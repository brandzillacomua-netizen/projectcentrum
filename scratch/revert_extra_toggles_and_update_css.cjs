const fs = require('fs');

// 1. Revert PackagingModule.jsx
let packContent = fs.readFileSync('a:/centrum/src/modules/PackagingModule.jsx', 'utf8');
packContent = packContent.replace(
  `              <button onClick={toggleTheme} className="burger-btn" style={{ marginLeft: 'auto', padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', borderRadius: '50%' }}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              {isDrawerOpen && (
                <button onClick={() => setIsDrawerOpen(false)} style={{ marginLeft: '10px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              )}`,
  `              {isDrawerOpen && (
                <button onClick={() => setIsDrawerOpen(false)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              )}`
);
fs.writeFileSync('a:/centrum/src/modules/PackagingModule.jsx', packContent, 'utf8');
console.log('Successfully reverted extra toggles in PackagingModule.jsx!');

// 2. Revert ForemanTaskQueue.jsx
let queueContent = fs.readFileSync('a:/centrum/src/modules/Foreman/components/ForemanTaskQueue.jsx', 'utf8');
queueContent = queueContent.replace(
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
      </div>`,
  `      <div style={{ padding: '20px', color: '#444', fontWeight: 800, fontSize: '0.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        ЧЕРГА НАРЯДІВ ({relevantTasks.length})
        {isDrawerOpen && (
          <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}>
            <X size={18} />
          </button>
        )}
      </div>`
);
fs.writeFileSync('a:/centrum/src/modules/Foreman/components/ForemanTaskQueue.jsx', queueContent, 'utf8');
console.log('Successfully reverted extra toggles in ForemanTaskQueue.jsx!');

// 3. Revert Shop1Terminal.jsx
let shop1Content = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', 'utf8');
shop1Content = shop1Content.replace(
  `            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 900, color: '#555', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ClipboardList size={16} /> ЧЕРГА КАРТ ({queueCards.length})
              </div>
              <button onClick={toggleTheme} className="burger-btn" style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
            </div>`,
  `            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 900, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ClipboardList size={16} /> ЧЕРГА КАРТ ({queueCards.length})
            </div>`
);
shop1Content = shop1Content.replace(
  `            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#eab308' }}>ЧЕРГА (ОБЕРІТЬ КАРТУ)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={toggleTheme} className="burger-btn" style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                </button>
                <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
              </div>
            </div>`,
  `            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#eab308' }}>ЧЕРГА (ОБЕРІТЬ КАРТУ)</span>
              <button onClick={() => setIsDrawerOpen(false)} className="burger-btn"><X size={20} /></button>
            </div>`
);
fs.writeFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', shop1Content, 'utf8');
console.log('Successfully reverted extra toggles in Shop1Terminal.jsx!');

// 4. Update light.css with comprehensive normalizations
const advancedLightCss = `.light-theme {
  --bg: #f4f4f7;
  --card-bg: #ffffff;
  --glass-border: #e2e8f0;
  --text: #0f172a;
  --text-muted: #64748b;
  --secondary: #e2e8f0;
  --shadow: 0 10px 30px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.01);
}

body.light-theme {
  background-color: var(--bg) !important;
  color: var(--text) !important;
}

/* Global resets for light theme */
.light-theme h1, 
.light-theme h2, 
.light-theme h3, 
.light-theme h4, 
.light-theme h5, 
.light-theme h6 {
  color: var(--text) !important;
}

.light-theme .content-card,
.light-theme .glass-panel {
  background: var(--card-bg) !important;
  border-color: var(--glass-border) !important;
  color: var(--text) !important;
  box-shadow: var(--shadow) !important;
}

.light-theme .form-group input, 
.light-theme .form-group select, 
.light-theme .form-group textarea,
.light-theme input[type="text"],
.light-theme input[type="number"] {
  background: #ffffff !important;
  border-color: #cbd5e1 !important;
  color: #0f172a !important;
}

.light-theme .form-group input:focus, 
.light-theme .form-group select:focus,
.light-theme input[type="text"]:focus,
.light-theme input[type="number"]:focus {
  border-color: var(--primary) !important;
  box-shadow: 0 0 10px rgba(255, 144, 0, 0.15) !important;
}

.light-theme .order-item {
  background: #ffffff !important;
  border-color: #e2e8f0 !important;
}

.light-theme .order-customer {
  color: var(--text) !important;
}

.light-theme .side-panel {
  background: #ffffff !important;
  border-right-color: #e2e8f0 !important;
}

.light-theme .content-panel {
  background: #f8fafc !important;
}

.light-theme .module-nav,
.light-theme .module-nav-container {
  background: #ffffff !important;
  border-bottom-color: #e2e8f0 !important;
}

.light-theme .burger-btn {
  color: var(--text) !important;
}

.light-theme .burger-btn:hover {
  background: rgba(0,0,0,0.05) !important;
}

.light-theme .burger-btn-labeled {
  background: rgba(0, 0, 0, 0.04) !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
  color: var(--text) !important;
}

.light-theme .burger-btn-labeled:hover {
  background: rgba(0, 0, 0, 0.08) !important;
}

.light-theme .side-drawer {
  background: rgba(255, 255, 255, 0.98) !important;
  border-right-color: #e2e8f0 !important;
}

.light-theme .drawer-header {
  border-bottom-color: #e2e8f0 !important;
}

/* Packaging Module Specific overrides */
.light-theme .bom-container {
  background: #f8fafc !important;
  border-color: #e2e8f0 !important;
}

.light-theme .pack-order-card {
  border-color: #e2e8f0 !important;
}

.light-theme .pack-order-card:not(.ready-pulse) {
  background: #ffffff !important;
}

.light-theme .pack-order-card.ready-pulse {
  background: rgba(16, 185, 129, 0.05) !important;
  border-color: #10b981 !important;
}

.light-theme .volume-box {
  background: #ffffff !important;
  border-color: #e2e8f0 !important;
}

/* App Main Navigation Drawer Overrides */
.light-theme .sidebar-drawer {
  background: #ffffff !important;
  border-right: 1px solid #e2e8f0 !important;
  box-shadow: 25px 0 80px rgba(0, 0, 0, 0.06) !important;
}

.light-theme .sidebar-header-bar {
  border-bottom: 1px solid #e2e8f0 !important;
}

.light-theme .sidebar-header-bar span,
.light-theme .sidebar-header-bar h1 {
  color: var(--text) !important;
}

.light-theme .user-profile-bar {
  background: #f8fafc !important;
  border-bottom: 1px solid #e2e8f0 !important;
}

.light-theme .user-profile-bar span {
  color: var(--text) !important;
}

.light-theme .sidebar-link {
  color: #475569 !important;
}

.light-theme .sidebar-link:hover {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}

.light-theme .sidebar-link.active {
  background: rgba(255, 144, 0, 0.08) !important;
  color: #ff9000 !important;
  border-color: rgba(255, 144, 0, 0.18) !important;
}

.light-theme .support-banner {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  color: var(--text) !important;
}

.light-theme .support-banner span,
.light-theme .support-banner div {
  color: var(--text) !important;
}

/* App Portal Main Page Overrides */
.light-theme .portal-container-v2 {
  background: var(--bg) !important;
  color: var(--text) !important;
}

.light-theme .portal-header-v2 h1 {
  color: var(--text) !important;
}

.light-theme .portal-header-v2 p {
  color: #64748b !important;
}

.light-theme .portal-card-v2 {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01) !important;
}

.light-theme .portal-card-v2:hover {
  background: #f8fafc !important;
  border-color: #cbd5e1 !important;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05) !important;
}

.light-theme .card-icon-v2 {
  background: #f1f5f9 !important;
}

.light-theme .card-info-v2 h3 {
  color: var(--text) !important;
}

.light-theme .card-info-v2 p {
  color: var(--text-muted) !important;
}

.light-theme .arrow-v2 {
  color: #cbd5e1 !important;
}

.light-theme .portal-card-v2:hover .arrow-v2 {
  color: #ff9000 !important;
}

/* ─────────────────────────────────────────────────────────────
   ADVANCED OVERRIDES FOR INLINE BACKGROUNDS AND TEXT COLORS
   ───────────────────────────────────────────────────────────── */

/* Target common inline colors used in React style attributes */
.light-theme [style*="color: rgb(255, 255, 255)"],
.light-theme [style*="color: rgb(238, 238, 238)"],
.light-theme [style*="color: rgb(234, 234, 234)"],
.light-theme [style*="color: rgb(204, 204, 204)"],
.light-theme [style*="color: rgb(221, 221, 221)"],
.light-theme [style*="color: rgb(170, 170, 170)"],
.light-theme [style*="color: #fff"],
.light-theme [style*="color: #ffffff"],
.light-theme [style*="color: #eaeaea"],
.light-theme [style*="color: #eee"],
.light-theme [style*="color: #ccc"],
.light-theme [style*="color: #ddd"],
.light-theme [style*="color: #aaa"],
.light-theme [style*="color: white"] {
  color: var(--text) !important;
}

.light-theme [style*="color: rgb(136, 136, 136)"],
.light-theme [style*="color: rgb(119, 119, 119)"],
.light-theme [style*="color: rgb(85, 85, 85)"],
.light-theme [style*="color: rgb(102, 102, 102)"],
.light-theme [style*="color: rgb(68, 68, 68)"],
.light-theme [style*="color: #888"],
.light-theme [style*="color: #777"],
.light-theme [style*="color: #555"],
.light-theme [style*="color: #666"],
.light-theme [style*="color: #444"] {
  color: var(--text-muted) !important;
}

/* Override dark inline backgrounds to light card background */
.light-theme [style*="background: rgb(10, 10, 10)"],
.light-theme [style*="background-color: rgb(10, 10, 10)"],
.light-theme [style*="background: rgb(17, 17, 17)"],
.light-theme [style*="background-color: rgb(17, 17, 17)"],
.light-theme [style*="background: rgb(24, 24, 28)"],
.light-theme [style*="background-color: rgb(24, 24, 28)"],
.light-theme [style*="background: rgb(26, 26, 26)"],
.light-theme [style*="background-color: rgb(26, 26, 26)"],
.light-theme [style*="background: rgb(13, 13, 13)"],
.light-theme [style*="background-color: rgb(13, 13, 13)"],
.light-theme [style*="background: rgb(14, 14, 16)"],
.light-theme [style*="background-color: rgb(14, 14, 16)"],
.light-theme [style*="background: rgb(8, 8, 8)"],
.light-theme [style*="background-color: rgb(8, 8, 8)"],
.light-theme [style*="background: rgb(15, 15, 18)"],
.light-theme [style*="background-color: rgb(15, 15, 18)"],
.light-theme [style*="background: rgb(5, 5, 5)"],
.light-theme [style*="background-color: rgb(5, 5, 5)"],
.light-theme [style*="background: #111"],
.light-theme [style*="background-color: #111"],
.light-theme [style*="background: #0a0a0a"],
.light-theme [style*="background-color: #0a0a0a"],
.light-theme [style*="background: #18181c"],
.light-theme [style*="background-color: #18181c"],
.light-theme [style*="background: #1a1a1a"],
.light-theme [style*="background-color: #1a1a1a"],
.light-theme [style*="background: #0d0d0d"],
.light-theme [style*="background-color: #0d0d0d"],
.light-theme [style*="background: #0e0e10"],
.light-theme [style*="background-color: #0e0e10"],
.light-theme [style*="background: #080808"],
.light-theme [style*="background-color: #080808"],
.light-theme [style*="background: #0f0f12"],
.light-theme [style*="background-color: #0f0f12"] {
  background-color: var(--card-bg) !important;
  background: var(--card-bg) !important;
}

/* Force dark wrapper containers to use main light background */
.light-theme [style*="background: rgb(5, 5, 5)"],
.light-theme [style*="background-color: rgb(5, 5, 5)"],
.light-theme [style*="background: rgb(10, 10, 10)"],
.light-theme [style*="background-color: rgb(10, 10, 10)"],
.light-theme [style*="background: #050505"],
.light-theme [style*="background-color: #050505"],
.light-theme [style*="background: #0a0a0a"],
.light-theme [style*="background-color: #0a0a0a"],
.light-theme .foreman-module,
.light-theme .packaging-module,
.light-theme .operator-terminal,
.light-theme .shop1-terminal,
.light-theme .shop2-terminal,
.light-theme .preparation-terminal,
.light-theme .reception-terminal,
.light-theme .sorting-terminal,
.light-theme .tumbling-terminal,
.light-theme .module-page {
  background-color: var(--bg) !important;
  background: var(--bg) !important;
}
`;

fs.writeFileSync('a:/centrum/src/light.css', advancedLightCss, 'utf8');
console.log('Successfully updated light.css advanced overrides!');
