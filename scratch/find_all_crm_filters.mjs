import fs from 'fs'
import path from 'path'

function searchDir(dir, pattern) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchDir(fullPath, pattern)
      }
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          console.log(`${fullPath}:${idx + 1}: ${line.trim()}`)
        }
      })
    }
  }
}

console.log('=== SEARCHING FOR pillar === "crm" or CRM filtering ===')
searchDir('a:/centrum/src', /crm/i)
