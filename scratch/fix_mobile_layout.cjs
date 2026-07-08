const fs = require('fs');
const filePath = 'a:/centrum/src/modules/PackagingModule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add className="bom-container" to the BOM scroll container
content = content.replace(
  `                {/* BOM / BOX SUMMARY */}
                <div style={{ background: '#070707', borderRadius: '28px', padding: '25px', flex: 1, border: '1px solid #151515', marginBottom: '20px', overflowY: 'auto' }}>`,
  `                {/* BOM / BOX SUMMARY */}
                <div className="bom-container" style={{ background: '#070707', borderRadius: '28px', padding: '25px', flex: 1, border: '1px solid #151515', marginBottom: '20px', overflowY: 'auto' }}>`
);

// 2. Update media query to set height: auto !important on key wrappers and make font sizing premium
const oldMediaQuery = `@media screen and (max-width: 768px) {
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
        }`;

const newMediaQuery = `@media screen and (max-width: 768px) {
          .module-content-container {
            padding: 8px !important;
          }
          .master-grid {
            height: auto !important;
          }
          .order-details-area {
            height: auto !important;
          }
          .details-panel {
            padding: 12px !important;
            border-radius: 16px !important;
            gap: 10px !important; /* Decrease gap inside main container */
            height: auto !important;
            overflow: visible !important;
          }
          .bom-container {
            overflow-y: visible !important;
            padding: 15px !important;
            border-radius: 16px !important;
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
            flex-direction: column !important;
          }
          .action-buttons-row button, .action-buttons-row div button {
            padding: 14px 10px !important; /* Much smaller button height */
            border-radius: 10px !important;
            font-size: 0.8rem !important;
          }
          .action-buttons-row svg, .action-buttons-row div svg {
            width: 16px !important;
            height: 16px !important;
          }
          .bom-required-list {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }
          .bom-required-list > div {
            padding: 10px !important;
            border-radius: 12px !important;
          }
        }`;

// Normalize line endings to do matching
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOldQuery = oldMediaQuery.replace(/\r\n/g, '\n');
const normalizedNewQuery = newMediaQuery.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedOldQuery)) {
  const updatedContent = normalizedContent.replace(normalizedOldQuery, normalizedNewQuery);
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('Successfully updated PackagingModule.jsx mobile styles!');
} else {
  console.log('Target query block not found in PackagingModule.jsx!');
}
