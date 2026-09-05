import fs from 'fs'

const buf = fs.readFileSync('a:/centrum/src/modules/Shop1Terminal.jsx')
console.log('Length:', buf.length)
console.log('First 10 bytes:', buf.slice(0, 10))
console.log('Includes null byte?', buf.includes(0))
