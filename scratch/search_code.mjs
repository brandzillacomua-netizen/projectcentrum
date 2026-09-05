import fs from 'fs'

function searchFile(filePath, query) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const results = []
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
      results.push({ line: idx + 1, text: line.trim() })
    }
  })
  return results
}

const file = process.argv[2]
const q = process.argv[3]
const res = searchFile(file, q)
console.log(`Found ${res.length} matches for "${q}" in ${file}:`)
res.slice(0, 30).forEach(r => console.log(`L${r.line}: ${r.text}`))
