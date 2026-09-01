import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Shop2Module.jsx'
let content = fs.readFileSync(filePath, 'utf8')

content = content.replace('{totalInProcess > 0 && (', '{totalInWork > 0 && (')
fs.writeFileSync(filePath, content, 'utf8')
console.log('Updated totalInWork check in Shop2Module.jsx!')
