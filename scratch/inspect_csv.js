import fs from 'fs'
import path from 'path'

const dir = 'a:/centrum'
const files = fs.readdirSync(dir)

console.log("CSV files in " + dir + ":")
files.filter(f => f.endsWith('.csv')).forEach(f => {
  console.log("- " + f)
  const fullPath = path.join(dir, f)
  const text = fs.readFileSync(fullPath, 'utf8')
  const lines = text.split('\n')
  console.log("  First 5 lines:")
  lines.slice(0, 5).forEach((line, idx) => {
    console.log(`    [${idx + 1}]: ${line.trim()}`)
  })
})
