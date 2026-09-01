import fs from 'fs'

const files = [
  'b:/kylutsya/src/modules/EngineerModule.jsx',
  'b:/kylutsya/src/modules/EngineerV2Module.jsx'
]

files.forEach(targetPath => {
  if (!fs.existsSync(targetPath)) return
  let code = fs.readFileSync(targetPath, 'utf8')

  // Replace isCollapsed logic to be collapsed by default
  code = code.replace(
    /const isCollapsed = !!collapsedFolders\[folder\.key\]/g,
    "const isCollapsed = catalogFolder === 'all' ? collapsedFolders[folder.key] !== false : collapsedFolders[folder.key] === true"
  )

  // Replace onClick toggle logic
  code = code.replace(
    /onClick=\{\(\) => setCollapsedFolders\(prev => \(\{ \.\.\.prev, \[folder\.key\]: !prev\[folder\.key\] \}\)\)\}/g,
    "onClick={() => setCollapsedFolders(prev => ({ ...prev, [folder.key]: isCollapsed ? false : true }))}"
  )

  fs.writeFileSync(targetPath, code, 'utf8')
  console.log(`Updated folders to be collapsed by default in ${targetPath}!`)
})
