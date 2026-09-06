import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const mdPath = 'C:\\Users\\REBRAND STUDIO\\.gemini\\antigravity-ide\\brain\\83849441-8725-4cd8-92d5-8475e7e3934a\\enterprise_readiness_final_audit.md';
const outputHtml = 'B:\\centrumV2\\scratch\\audit_report.html';
const outputPdf = 'B:\\centrumV2\\CENTRUM_MES_ENTERPRISE_AUDIT_2026.pdf';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const mdContent = fs.readFileSync(mdPath, 'utf8');

// Basic markdown to clean executive HTML converter
function mdToHtml(md) {
  let html = md
    // Headers
    .replace(/^# (.*$)/gim, '<h1 class="doc-title">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="section-title">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="subsection-title">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4 class="item-title">$1</h4>')
    // Quotes / callouts
    .replace(/^> (.*$)/gim, '<div class="callout">$1</div>')
    // Bold / Italic
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Code blocks
    .replace(/```sql([\s\S]*?)```/gim, '<pre class="code-block"><code>$1</code></pre>')
    .replace(/```mermaid([\s\S]*?)```/gim, '')
    .replace(/```[\s\S]*?```/gim, '')
    // Inline code
    .replace(/`([^`]+)`/gim, '<code class="inline-code">$1</code>')
    // Unordered lists
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>')
    // Fix nested ULs
    .replace(/<\/ul>\s*<ul>/gim, '')
    // Horizontal rule
    .replace(/^---$/gim, '<hr class="divider"/>');

  // Convert markdown tables
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (line.includes(':-:') || line.includes('---')) {
        continue; // delimiter row
      }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (!inTable) {
        inTable = true;
        tableHtml = '<table class="audit-table"><thead><tr>';
        cells.forEach(c => { tableHtml += `<th>${c}</th>`; });
        tableHtml += '</tr></thead><tbody>';
      } else {
        tableHtml += '<tr>';
        cells.forEach(c => { tableHtml += `<td>${c}</td>`; });
        tableHtml += '</tr>';
      }
    } else {
      if (inTable) {
        tableHtml += '</tbody></table>';
        processedLines.push(tableHtml);
        inTable = false;
        tableHtml = '';
      }
      processedLines.push(line);
    }
  }
  if (inTable) {
    tableHtml += '</tbody></table>';
    processedLines.push(tableHtml);
  }

  return processedLines.join('\n');
}

const bodyContent = mdToHtml(mdContent);

const htmlTemplate = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <title>CENTRUM MES: Enterprise Readiness Audit 2026</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: counter(page);
      }
    }
    *, *:before, *:after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #1a202c;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header-banner {
      border-bottom: 3px solid #2b6cb0;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-brand {
      font-size: 16pt;
      font-weight: 900;
      color: #1a365d;
      letter-spacing: -0.5px;
    }
    .header-meta {
      font-size: 8.5pt;
      color: #718096;
      text-align: right;
    }
    .doc-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0d233a;
      margin: 0 0 10px 0;
      line-height: 1.2;
    }
    .section-title {
      font-size: 13pt;
      font-weight: 700;
      color: #2b6cb0;
      margin-top: 24px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #e2e8f0;
      page-break-after: avoid;
    }
    .subsection-title {
      font-size: 11pt;
      font-weight: 700;
      color: #2d3748;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    .item-title {
      font-size: 10pt;
      font-weight: 700;
      color: #3182ce;
      margin: 10px 0 4px 0;
    }
    .callout {
      background: #ebf8ff;
      border-left: 4px solid #3182ce;
      padding: 8px 12px;
      border-radius: 4px;
      margin: 6px 0;
      font-size: 9.5pt;
      color: #2c5282;
    }
    .divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 18px 0;
    }
    ul {
      margin: 4px 0 8px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 3px;
    }
    .inline-code {
      background: #edf2f7;
      color: #c53030;
      padding: 1px 5px;
      border-radius: 3px;
      font-family: "Consolas", monospace;
      font-size: 9pt;
    }
    .code-block {
      background: #2d3748;
      color: #f7fafc;
      padding: 10px 14px;
      border-radius: 6px;
      font-family: "Consolas", monospace;
      font-size: 8.5pt;
      overflow-x: auto;
      margin: 8px 0;
    }
    .audit-table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    .audit-table th {
      background: #2b6cb0;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 7px 9px;
      border: 1px solid #2b6cb0;
    }
    .audit-table td {
      padding: 6px 9px;
      border: 1px solid #cbd5e0;
      vertical-align: middle;
    }
    .audit-table tr:nth-child(even) td {
      background: #f7fafc;
    }
    .badge-enterprise {
      background: #c6f6d5;
      color: #22543d;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
    }
    .badge-score {
      font-size: 14pt;
      font-weight: 800;
      color: #276749;
    }
    .score-card {
      display: flex;
      background: #f0fff4;
      border: 1px solid #9ae6b4;
      border-radius: 8px;
      padding: 14px;
      margin: 14px 0;
      justify-content: space-around;
      text-align: center;
    }
    .score-item-val {
      font-size: 20pt;
      font-weight: 900;
      color: #22543d;
    }
    .score-item-lbl {
      font-size: 8pt;
      text-transform: uppercase;
      color: #4a5568;
      font-weight: 700;
    }
    .footer-note {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #a0aec0;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <div class="header-brand">CENTRUM MES & ERP</div>
      <div style="font-size: 8.5pt; color: #4a5568; font-weight: 600;">HIGH-LOAD PRODUCTION & FABRIC INFRASTRUCTURE</div>
    </div>
    <div class="header-meta">
      <div><strong>Дата аудиту:</strong> 05 вересня 2026</div>
      <div><strong>Статус:</strong> ENTERPRISE APPROVED 🟢</div>
    </div>
  </div>

  <div class="score-card">
    <div>
      <div class="score-item-val">91.5 / 100</div>
      <div class="score-item-lbl">Корпоративний рівень</div>
    </div>
    <div>
      <div class="score-item-val" style="color: #2f855a;">98 / 100</div>
      <div class="score-item-lbl">Рівень фабрики 50-250 робітників</div>
    </div>
    <div>
      <div class="score-item-val" style="color: #3182ce;">+35.3</div>
      <div class="score-item-lbl">Прогрес оптимізації</div>
    </div>
    <div>
      <div class="score-item-val" style="color: #d69e2e;">160 мс</div>
      <div class="score-item-lbl">Час вибірки (було 5.7 с)</div>
    </div>
  </div>

  ${bodyContent}

  <div class="footer-note">
    <div>Centrum MES Enterprise System Audit | All Rights Reserved 2026</div>
    <div>Конфіденційно для внутрішнього використання</div>
  </div>
</body>
</html>`;

fs.writeFileSync(outputHtml, htmlTemplate, 'utf8');
console.log('Generated executive HTML report at:', outputHtml);

// Run headless Chrome to print PDF
const printCmd = `"${chromePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${outputPdf}" "${outputHtml}"`;
console.log('Executing Chrome PDF generation...');
execSync(printCmd, { stdio: 'inherit' });

if (fs.existsSync(outputPdf)) {
  const stats = fs.statSync(outputPdf);
  console.log(`\n🎉 PDF GENERATION SUCCESSFUL!`);
  console.log(`Path: ${outputPdf}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
} else {
  console.error('❌ PDF file was not created.');
}
