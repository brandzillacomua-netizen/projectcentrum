const fs = require('fs');

// 1. Add classes to App.jsx elements
let appContent = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');

appContent = appContent.replace(
  `<div style={{ padding: '24px 20px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>`,
  `<div className="sidebar-header-bar" style={{ padding: '24px 20px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>`
);

appContent = appContent.replace(
  `<div style={{
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.01)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>`,
  `<div className="user-profile-bar" style={{
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.01)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>`
);

fs.writeFileSync('a:/centrum/src/App.jsx', appContent, 'utf8');
console.log('Successfully updated App.jsx classes!');

// 2. Write the new comprehensive light.css
const lightCssContent = `.light-theme {
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

/* Override inline text colors that are hardcoded to dark gray/light gray */
.light-theme .text-white,
.light-theme span[style*="color: '#fff'"],
.light-theme span[style*="color: '#ccc'"],
.light-theme span[style*="color: '#eee'"],
.light-theme div[style*="color: '#fff'"],
.light-theme div[style*="color: '#ccc'"],
.light-theme div[style*="color: '#eee'"] {
  color: var(--text) !important;
}

.light-theme span[style*="color: '#888'"],
.light-theme span[style*="color: '#555'"],
.light-theme span[style*="color: '#666'"],
.light-theme div[style*="color: '#888'"],
.light-theme div[style*="color: '#555'"],
.light-theme div[style*="color: '#666'"] {
  color: var(--text-muted) !important;
}

/* Links and navigation controls */
.light-theme .back-link {
  color: var(--text-muted) !important;
}
.light-theme .back-link:hover {
  color: var(--primary) !important;
}

/* Tab buttons and headers */
.light-theme button[style*="background: '#111'"] {
  background: #f1f5f9 !important;
  color: var(--text) !important;
  border-color: #cbd5e1 !important;
}

.light-theme .details-panel {
  background: #ffffff !important;
  border-color: #e2e8f0 !important;
}
`;

fs.writeFileSync('a:/centrum/src/light.css', lightCssContent, 'utf8');
console.log('Successfully wrote new light.css override file!');
