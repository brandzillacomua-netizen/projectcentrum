import fs from 'fs'

const filePath = 'a:/centrum/src/modules/SettingsModule.jsx'
const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split(/\r?\n/)

const targetIndex = lines.findIndex((line, idx) => {
  return idx > 260 && idx < 550 && line.includes("refreshTable('work_cards')")
})

if (targetIndex !== -1) {
  lines.splice(targetIndex + 1, 0, "      refreshTable('inventory')")
  fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8')
  console.log("Successfully added refreshTable('inventory')!")
} else {
  console.error("Could not find refreshTable('work_cards') inside handleSaveCorrection.")
}
