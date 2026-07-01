import fs from 'fs'
import path from 'path'

function searchDir(dir, query) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'scratch') {
        searchDir(fullPath, query)
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      if (content.includes(query)) {
        console.log(`Found query in: ${fullPath}`)
      }
    }
  }
}

searchDir('a:/centrum', 'placeholder="Логін"')
searchDir('a:/centrum', 'placeholder="Введіть логін"')
searchDir('a:/centrum', 'type="password"')
