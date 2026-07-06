const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Add class to the nav element
content = content.replace(
  `<nav className="module-nav" style={{ flexShrink: 0, padding: '0 25px', height: '80px', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>`,
  `<nav className="module-nav module-nav-container" style={{ flexShrink: 0, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>`
);

// 2. Add classes to navigation title elements
content = content.replace(
  `            <h1 style={{ fontSize: '0.95rem', fontWeight: 950, margin: 0, letterSpacing: '0.5px', lineHeight: 1.1 }}>ВІДДІЛ ПАКУВАННЯ</h1>`,
  `            <h1 className="nav-title" style={{ fontSize: '0.95rem', fontWeight: 950, margin: 0, letterSpacing: '0.5px', lineHeight: 1.1 }}>ВІДДІЛ ПАКУВАННЯ</h1>`
);
content = content.replace(
  `            <div style={{ fontSize: '0.58rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginTop: '3px', letterSpacing: '0.3px', lineHeight: 1 }}>Контроль комплектування партій</div>`,
  `            <div className="nav-subtitle" style={{ fontSize: '0.58rem', color: '#444', fontWeight: 900, textTransform: 'uppercase', marginTop: '3px', letterSpacing: '0.3px', lineHeight: 1 }}>Контроль комплектування партій</div>`
);

// 3. Inject CSS overrides
const cssTarget = `        .module-content-container {
          padding: 30px !important;
        }
        .details-panel {
          padding: 40px !important;
          border-radius: 32px !important;
        }
        .detail-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          flex-shrink: 0;
        }`;

const cssReplacement = `        .module-nav-container {
          padding: 0 25px !important;
          height: 80px !important;
        }
        .module-content-container {
          padding: 30px !important;
        }
        .details-panel {
          padding: 40px !important;
          border-radius: 32px !important;
        }
        .detail-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          flex-shrink: 0;
        }
        @media screen and (max-width: 768px) {
          .module-nav-container {
            padding: 0 12px !important;
            height: 54px !important;
          }
          .nav-title {
            font-size: 0.8rem !important;
          }
          .nav-subtitle {
            display: none !important;
          }
          .module-nav-container svg {
            width: 14px !important;
            height: 14px !important;
          }
          .burger-btn-labeled {
            padding: 4px 8px !important;
            font-size: 0.7rem !important;
          }
          .burger-btn-labeled span {
            font-size: 0.7rem !important;
          }
        }`;

if (content.includes(cssTarget)) {
  content = content.replace(cssTarget, cssReplacement);
  console.log('SUCCESS: CSS updated.');
} else {
  console.error('ERROR: CSS target not found!');
}

fs.writeFileSync(path, content, 'utf8');
console.log('SUCCESS: Nav styles completed!');
