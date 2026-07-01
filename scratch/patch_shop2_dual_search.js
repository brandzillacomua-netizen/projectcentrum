import fs from 'fs'

const filePath = 'a:/centrum/src/modules/Shop2Terminal.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// Replace the first occurrence of finding the card
content = content.replace(
  `    let card = workCards.find(c => \n      c.card_info?.includes('[ЦЕХ №2]') && (\n        String(c.id).trim() === cleanInput || \n        String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())\n      )\n    )`,
  `    let card = workCards.find(c => \n      c.card_info?.includes('[ЦЕХ №2]') && (\n        String(c.id).trim() === cleanInput || \n        String(c.id).toUpperCase().startsWith(cleanInput.toUpperCase()) ||\n        String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())\n      )\n    )`
)

// Replace the second occurrence (after fetching data)
content = content.replace(
  `      card = workCards.find(c => \n        c.card_info?.includes('[ЦЕХ №2]') && (\n          String(c.id).trim() === cleanInput || \n          String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())\n        )\n      )`,
  `      card = workCards.find(c => \n        c.card_info?.includes('[ЦЕХ №2]') && (\n          String(c.id).trim() === cleanInput || \n          String(c.id).toUpperCase().startsWith(cleanInput.toUpperCase()) ||\n          String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())\n        )\n      )`
)

fs.writeFileSync(filePath, content, 'utf8')
console.log("Successfully patched Shop2Terminal.jsx for dual (startsWith/endsWith) card search!")
