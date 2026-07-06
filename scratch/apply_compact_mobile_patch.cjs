const fs = require('fs');
const path = 'a:/centrum/src/modules/PackagingModule.jsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Replace headers and container style attributes with class names
content = content.replace(
  `                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexShrink: 0 }}>`,
  `                <div className="detail-header-row">`
);

content = content.replace(
  `                      <h2 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 1000, color: '#fff', letterSpacing: '-1px' }}>`,
  `                      <h2 className="order-detail-title" style={{ margin: 0, fontWeight: 1000, color: '#fff', letterSpacing: '-1px' }}>`
);

content = content.replace(
  `                    <div style={{ textAlign: 'right', background: '#111', padding: '12px 20px', borderRadius: '16px', border: '1px solid #1a1a1a' }}>`,
  `                    <div className="volume-box" style={{ border: '1px solid #1a1a1a' }}>`
);

content = content.replace(
  `                <div style={{ display: 'flex', gap: '15px', flexShrink: 0 }}>`,
  `                <div className="action-buttons-row">`
);

// 2. Inject updated responsive CSS styles at the bottom
const cssTarget = `        .module-content-container {
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

const cssReplacement = `        .module-content-container {
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
        .order-detail-title {
          font-size: 2.2rem !important;
        }
        .volume-box {
          text-align: right;
          background: #111;
          padding: 12px 20px;
          border-radius: 16px;
        }
        .action-buttons-row {
          display: flex;
          gap: 15px;
          flex-shrink: 0;
        }
        
        @media screen and (max-width: 768px) {
          .module-content-container {
            padding: 8px !important;
          }
          .details-panel {
            padding: 12px !important;
            border-radius: 16px !important;
            gap: 10px !important; /* Decrease gap inside main container */
          }
          .detail-header-row {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 8px !important;
          }
          .order-detail-title {
            font-size: 1.2rem !important; /* Make title much smaller */
          }
          .volume-box {
            padding: 4px 8px !important;
            border-radius: 8px !important;
          }
          .volume-box div:first-child {
            font-size: 0.5rem !important;
          }
          .volume-box div:last-child {
            font-size: 1rem !important;
          }
          
          /* Make buttons compact and smaller */
          .action-buttons-row {
            gap: 8px !important;
            margin-top: 5px !important;
          }
          .action-buttons-row button, .action-buttons-row div button {
            padding: 10px 10px !important; /* Much smaller button height */
            border-radius: 10px !important;
            font-size: 0.72rem !important;
          }
          .action-buttons-row svg, .action-buttons-row div svg {
            width: 14px !important;
            height: 14px !important;
          }
          .bom-required-list {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }
          .bom-required-list > div {
            padding: 10px !important;
            border-radius: 12px !important;
          }
        }
        .master-grid {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 30px;
        }`;

if (content.includes(cssTarget)) {
  content = content.replace(cssTarget, cssReplacement);
  console.log('SUCCESS: CSS replaced.');
} else {
  console.error('ERROR: CSS target not found!');
}

fs.writeFileSync(path, content, 'utf8');
console.log('SUCCESS: Mobile compact style applied!');
Object.keys(require.cache).forEach(key => delete require.cache[key]); // clear node cache just in case
