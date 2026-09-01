import fs from 'fs'

const files = [
  'b:/kylutsya/src/modules/EngineerModule.jsx',
  'b:/kylutsya/src/modules/EngineerV2Module.jsx'
]

files.forEach(targetPath => {
  if (!fs.existsSync(targetPath)) return
  let code = fs.readFileSync(targetPath, 'utf8')

  // Clean duplicate border / color in background: '#fee2e2'
  code = code.replace(/background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', border: 'none', color: '#fff'/g, "background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5'")
  code = code.replace(/background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',/g, "background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',")
  
  // Clean duplicate boxShadow in catalog items
  code = code.replace(/boxShadow: isEmpty \? '0 0 15px rgba\(239, 68, 68, 0\.15\)' : 'none',\s*boxShadow: isEmpty \? '0 4px 16px rgba\(239, 68, 68, 0\.08\)' : '0 2px 10px rgba\(0,0,0,0\.03\)'/g, "boxShadow: isEmpty ? '0 4px 16px rgba(239, 68, 68, 0.08)' : '0 2px 10px rgba(0,0,0,0.03)'")

  fs.writeFileSync(targetPath, code, 'utf8')
})
console.log('Cleaned duplicate style properties successfully!')
