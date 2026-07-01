import fs from 'fs'

const file = fs.readFileSync('a:/centrum/src/modules/SettingsModule.jsx', 'utf8')
const lines = file.split('\n')

// Find CPU button
lines.forEach((line, index) => {
  if (line.includes('activeTab ===') || line.includes('setActiveTab(') || line.includes('Cpu size={16}')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
