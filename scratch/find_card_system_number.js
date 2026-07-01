import fs from 'fs'

const shop1 = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx', 'utf8')
const lines1 = shop1.split('\n')

console.log("--- Searching Shop1Terminal.jsx ---")
lines1.forEach((line, index) => {
  if (line.includes('slice(-8)') || line.includes('slice(') && line.includes('id') || line.includes('barcode') || line.includes('scan') || line.includes('search') || line.includes('Search') || line.includes('input') || line.includes('Input')) {
    if (line.includes('slice') || line.includes('search') || line.includes('find') || line.includes('filter')) {
      console.log(`${index + 1}: ${line.trim()}`)
    }
  }
})

console.log("\n--- Searching Shop2Terminal.jsx ---")
const shop2 = fs.readFileSync('a:/centrum/src/modules/Shop2Terminal.jsx', 'utf8')
const lines2 = shop2.split('\n')
lines2.forEach((line, index) => {
  if (line.includes('search') || line.includes('Search') || line.includes('input') || line.includes('Input') || line.includes('filter')) {
    console.log(`${index + 1}: ${line.trim()}`)
  }
})
