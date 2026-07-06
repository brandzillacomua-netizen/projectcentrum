const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Change input width from 80px to 120px
content = content.replace("width: '80px',", "width: '120px',");

// 2. Change module-content padding to be responsive
content = content.replace(
  `<div className="module-content" style={{ padding: '30px', flex: 1, overflowY: 'auto' }}>`,
  `<div className="module-content module-content-container" style={{ flex: 1, overflowY: 'auto' }}>`
);

// 3. Change glass-panel details area padding to be responsive
content = content.replace(
  `              <div className="glass-panel" style={{ background: '#0a0a0a', padding: '40px', borderRadius: '32px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>`,
  `              <div className="glass-panel details-panel" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>`
);

// 4. Inject responsive styles to the <style> tag at the end of the file
const cssTarget = `        .master-grid {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 30px;
        }`;

const cssReplacement = `        .module-content-container {
          padding: 30px !important;
        }
        .details-panel {
          padding: 40px !important;
          border-radius: 32px !important;
        }
        @media screen and (max-width: 768px) {
          .module-content-container {
            padding: 10px !important;
          }
          .details-panel {
            padding: 15px !important;
            border-radius: 20px !important;
          }
          /* Adjust flex buttons on mobile to not squeeze */
          .order-details-area button {
            padding: 14px !important;
            font-size: 0.8rem !important;
          }
          .bom-required-list {
            grid-template-columns: 1fr !important;
          }
        }
        .master-grid {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 30px;
        }`;

if (content.includes(cssTarget)) {
  content = content.replace(cssTarget, cssReplacement);
  console.log('SUCCESS: CSS injected.');
} else {
  console.error('ERROR: CSS target not found!');
}

fs.writeFileSync(path, content, 'utf8');
console.log('SUCCESS: File saved!');
