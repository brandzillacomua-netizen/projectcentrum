import fs from 'fs'

const content = fs.readFileSync('b:/kylutsya/src/modules/Shop2Terminal.jsx', 'utf8')
const lines = content.split('\n')
console.log(lines.slice(985, 1025).map((l, i) => `${986 + i}: ${JSON.stringify(l)}`).join('\n'))
