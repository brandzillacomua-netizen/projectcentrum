const fs = require('fs');

const filePath = 'a:/centrum/src/modules/ForemanDashboardModule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `          th.wip-col-sum {
            z-index: 40 !important;
          }`;

const replacement = `          th.wip-col-sum {
            z-index: 40 !important;
          }

          /* Compact orange sum badge sizing to fit the sum column bounds on mobile */
          .wip-sum-badge {
            font-size: 0.5rem !important;
            padding: 1px 3px !important;
            letter-spacing: -0.2px !important;
          }`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Shop2Module / ForemanDashboardModule sum badge padding corrected successfully!');
} else {
  console.log('❌ Could not find targetStr inside ForemanDashboardModule!');
}
