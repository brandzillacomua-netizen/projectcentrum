const fs = require('fs');
const filePath = 'a:/centrum/src/modules/PackagingModule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Change inline minmax from 300px to 260px
content = content.replace(
  `gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'`,
  `gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))'`
);

// 2. Update .bom-required-list override in max-width: 768px media query
content = content.replace(
  `          .bom-required-list {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }`,
  `          .bom-required-list {
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important;
            gap: 8px !important;
          }`
);

// 3. Add max-width: 480px media query to force 1 column on narrow phones
content = content.replace(
  `        @media screen and (max-width: 1024px) {`,
  `        @media screen and (max-width: 480px) {
          .bom-required-list {
            grid-template-columns: 1fr !important;
          }
        }
        @media screen and (max-width: 1024px) {`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully optimized BOM item grid layout!');
