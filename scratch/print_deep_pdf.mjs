import { execSync } from 'child_process';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const inputHtml = 'B:\\centrumV2\\scratch\\deep_audit_report.html';
const outputPdf = 'B:\\centrumV2\\CENTRUM_MES_DEEP_ENTERPRISE_AUDIT_2026.pdf';
const artifactDest = 'C:\\Users\\REBRAND STUDIO\\.gemini\\antigravity-ide\\brain\\83849441-8725-4cd8-92d5-8475e7e3934a\\CENTRUM_MES_DEEP_ENTERPRISE_AUDIT_2026.pdf';

console.log('Generating Deep Audit PDF via Chrome...');
const cmd = `"${chromePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${outputPdf}" "${inputHtml}"`;
execSync(cmd, { stdio: 'inherit' });

if (fs.existsSync(outputPdf)) {
  const size = fs.statSync(outputPdf).size;
  console.log(`Generated PDF successfully! Size: ${(size / 1024).toFixed(1)} KB`);
  fs.copyFileSync(outputPdf, artifactDest);
  console.log(`Copied to artifacts directory successfully!`);
} else {
  console.error('Failed to generate PDF');
  process.exit(1);
}
