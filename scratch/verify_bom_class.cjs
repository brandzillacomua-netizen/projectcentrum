const fs = require('fs');
const content = fs.readFileSync('a:/centrum/src/modules/PackagingModule.jsx', 'utf8');
if (content.includes('className="bom-container"')) {
  console.log('Class bom-container is present!');
} else {
  console.log('Class bom-container is NOT present!');
}
