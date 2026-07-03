const fs = require('fs');

const filePath = 'a:/centrum/src/modules/ForemanDashboardModule.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Замінюємо JSX для додавання класів
content = content.replace('<th style={TH_STICKY}>Номенклатура</th>', '<th className="wip-col-nomenclature" style={TH_STICKY}>Номенклатура</th>');
content = content.replace('<th style={TH_SUM}>Сума</th>', '<th className="wip-col-sum" style={TH_SUM}>Сума</th>');

content = content.replace("<td style={{ ...TD_STICKY, paddingLeft: '28px' }}>", "<td className=\"wip-col-nomenclature\" style={{ ...TD_STICKY, paddingLeft: '28px' }}>");
content = content.replace('<td style={TD_SUM}>', '<td className="wip-col-sum" style={TD_SUM}>');

content = content.replace("<td style={{ ...TD_STICKY, fontStyle: 'italic', paddingLeft: '28px', color: '#52525b' }}>Підсумок по виробу:</td>", "<td className=\"wip-col-nomenclature\" style={{ ...TD_STICKY, fontStyle: 'italic', paddingLeft: '28px', color: '#52525b' }}>Підсумок по виробу:</td>");
content = content.replace("<td style={{ ...TD_SUM, background: '#251a12' }}>{renderVal(gt.sum, 'sum')}</td>", "<td className=\"wip-col-sum\" style={{ ...TD_SUM, background: '#251a12' }}>{renderVal(gt.sum, 'sum')}</td>");

content = content.replace("<td style={{ ...TD_STICKY, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.72rem' }}>ЗАГАЛЬНИЙ WIP РАЗОМ:</td>", "<td className=\"wip-col-nomenclature\" style={{ ...TD_STICKY, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.72rem' }}>ЗАГАЛЬНИЙ WIP РАЗОМ:</td>");
content = content.replace("<td style={{ ...TD_SUM, background: '#2e2014', color: '#ff9000' }}>{renderVal(gt.sum, 'sum')}</td>", "<td className=\"wip-col-sum\" style={{ ...TD_SUM, background: '#2e2014', color: '#ff9000' }}>{renderVal(gt.sum, 'sum')}</td>");

// 2. Оновлюємо CSS-стилі в медіазапиті
const cssTarget = `          /* Override sticky offsets & widths for first column (Nomenclature) */
          th[style*="left: 0"], td[style*="left: 0"] {
            min-width: 120px !important;
            max-width: 120px !important;
            width: 120px !important;
            font-size: 0.6rem !important;
          }
          /* Override sticky offsets & widths for second column (Sum) */
          th[style*="left: '200px'"], td[style*="left: '200px'"] {
            left: 120px !important;
            min-width: 75px !important;
            max-width: 75px !important;
            width: 75px !important;
          }`;

const cssReplacement = `          /* Override sticky Nomenclature column on mobile */
          .wip-col-nomenclature {
            position: sticky !important;
            left: 0 !important;
            min-width: 110px !important;
            max-width: 110px !important;
            width: 110px !important;
            font-size: 0.6rem !important;
            z-index: 2 !important;
          }
          th.wip-col-nomenclature {
            z-index: 40 !important;
          }

          /* Override sticky Sum column on mobile */
          .wip-col-sum {
            position: sticky !important;
            left: 110px !important;
            min-width: 70px !important;
            max-width: 70px !important;
            width: 70px !important;
            z-index: 2 !important;
          }
          th.wip-col-sum {
            z-index: 40 !important;
          }`;

if (content.includes(cssTarget)) {
  content = content.replace(cssTarget, cssReplacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ WipTable cell classes and CSS overrides injected successfully!');
} else {
  console.log('❌ CSS target not found!');
}
