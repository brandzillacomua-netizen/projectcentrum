import fs from 'fs'

const content = fs.readFileSync('a:/centrum/src/modules/SettingsModule.jsx', 'utf8')
const lines = content.split('\n')

let systemStartIndex = -1
lines.forEach((line, index) => {
  if (line.includes("activeTab === 'system' && isAdmin && (")) {
    systemStartIndex = index
  }
})

console.log("System start line index (0-based):", systemStartIndex)

// Let's find where the block closes. The block starts with `(` on line systemStartIndex and ends with `)` followed by `}` or similar.
// Since it is:
// {activeTab === 'system' && isAdmin && (
//   <div ...>
//      ...
//   </div>
// )}
// Let's scan from systemStartIndex and keep track of parentheses and braces or look for the next tab/section start or end of div.
// Let's print 400 lines starting from systemStartIndex to see.
for (let i = systemStartIndex; i < systemStartIndex + 1000 && i < lines.length; i++) {
  const line = lines[i]
  // We are looking for the closing `)` and `}`.
  if (line.trim() === ')}' || line.trim() === ')}' || line.includes('</style>')) {
    console.log(`Line ${i + 1}: ${line}`)
  }
}
