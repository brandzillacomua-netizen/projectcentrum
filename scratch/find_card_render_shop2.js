import fs from 'fs'

const s2Module = fs.readFileSync('a:/centrum/src/modules/Shop2Module.jsx', 'utf8')
const lines1 = s2Module.split('\n')

console.log("--- Searching Shop2Module.jsx for card ID slice or display ---")
lines1.forEach((line, index) => {
  if (line.includes('card.id') || line.includes('cardId') || line.includes('slice(') && line.includes('id')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})

const s2Terminal = fs.readFileSync('a:/centrum/src/modules/Shop2Terminal.jsx', 'utf8')
const lines2 = s2Terminal.split('\n')

console.log("--- Searching Shop2Terminal.jsx for card ID slice or display ---")
lines2.forEach((line, index) => {
  if (line.includes('card.id') || line.includes('cardId') || line.includes('slice(') && line.includes('id')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
