import fs from 'fs'

const content = fs.readFileSync('a:/centrum/src/modules/SettingsModule.jsx', 'utf8')
const lines = content.split('\n')

lines.forEach((line, index) => {
  if (line.includes('const handleSaveCorrection') || line.includes('await Promise.all(dbWrites)')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
