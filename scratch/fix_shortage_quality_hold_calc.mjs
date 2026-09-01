import fs from 'fs'

const filePath = 'b:/kylutsya/src/modules/Foreman2/features/shortage/shortageCalculations.js'
let content = fs.readFileSync(filePath, 'utf8')

const oldCode = `    qualityHold: Math.max(0, observedScrap - scrap - returnedVkya),`

const newCode = `    qualityHold: hasFinalScrapProjection ? 0 : Math.max(0, observedScrap - scrap - returnedVkya),`

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Successfully updated shortageCalculations.js so qualityHold is 0 when scrap has been fully projected!')
} else {
  console.error('Target line not found in shortageCalculations.js')
}
