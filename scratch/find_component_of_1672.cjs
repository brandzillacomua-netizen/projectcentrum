const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/App.jsx', 'utf8');
const lines = content.split('\n');

// Search upwards from 1672 for 'function' or 'const'
for (let i = 1672; i > 0; i--) {
  const line = lines[i - 1];
  if (line.includes('function') || line.includes('=>') && (line.includes('const') || line.includes('let'))) {
    console.log(`Component defined at line ${i}: ${line.trim()}`);
    break;
  }
}
