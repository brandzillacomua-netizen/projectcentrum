const fs = require('fs')
const path = 'a:/centrum/src/modules/Foreman/hooks/useForemanHandlers.js'
let content = fs.readFileSync(path, 'utf8')

// The file currently has duplicate functions inserted at the start (between the function signature
// and the real code). The real functions start at "const handleResolveCall" which appears TWICE.
// We need to remove the duplicate block that appears before the properly structured code.

// The bad block starts right after line 61 "}) {" and ends before the second occurrence
// of "const handleResolveCall". We detect this by finding the two occurrences and removing the first one.

const marker = '  const handleResolveCall'
const first = content.indexOf(marker)
const second = content.indexOf(marker, first + marker.length)

if (first === -1 || second === -1) {
  console.log('Could not find duplicate markers. First:', first, 'Second:', second)
  process.exit(1)
}

// The bad block starts right after the closing of the hook signature "}) {\n\n"
const hookBodyStart = content.indexOf('}) {\n\n', 0)
if (hookBodyStart === -1) {
  // try \r\n style
  const hookBodyStartCRLF = content.indexOf('}) {\r\n\r\n', 0)
  console.log('hookBodyStart (CRLF):', hookBodyStartCRLF)
}
console.log('hookBodyStart:', hookBodyStart, 'first marker:', first, 'second marker:', second)

// Remove content between hookBodyStart+4 (after "}) {\n\n") and the start of second occurrence
// so that we keep: "}) {\n\n" + everything from second occurrence onwards
const prefix = content.slice(0, hookBodyStart + 4)  // include "}) {\n\n"
const suffix = content.slice(second)
const fixed = prefix + '\r\n' + suffix

fs.writeFileSync(path, fixed, 'utf8')
console.log('Done! Removed', second - (hookBodyStart + 4), 'bytes of duplicate code')
console.log('New file size:', fixed.length, 'bytes')
