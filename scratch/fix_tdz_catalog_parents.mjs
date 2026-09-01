import fs from 'fs'

const files = [
  'b:/kylutsya/src/modules/EngineerModule.jsx',
  'b:/kylutsya/src/modules/EngineerV2Module.jsx'
]

files.forEach(targetPath => {
  if (!fs.existsSync(targetPath)) return
  let code = fs.readFileSync(targetPath, 'utf8')

  // Find position of getItemFolderKey block
  const folderKeyIdx = code.indexOf('const getItemFolderKey =')
  const catalogParentsIdx = code.indexOf('const catalogParents = useMemo(() => {')

  if (folderKeyIdx !== -1 && catalogParentsIdx !== -1 && folderKeyIdx < catalogParentsIdx) {
    // Extract folder logic
    const folderLogicStart = folderKeyIdx
    const catalogParentsEnd = code.indexOf('}, [bomItems, nomenclatures, catalogSearch])') + '}, [bomItems, nomenclatures, catalogSearch])'.length

    const folderBlock = code.substring(folderLogicStart, catalogParentsIdx)
    const catalogParentsBlock = code.substring(catalogParentsIdx, catalogParentsEnd)

    code = code.substring(0, folderLogicStart) + catalogParentsBlock + '\n\n' + folderBlock + code.substring(catalogParentsEnd)
    fs.writeFileSync(targetPath, code, 'utf8')
    console.log(`Fixed catalogParents initialization order in ${targetPath}!`)
  } else {
    console.log(`Order already correct in ${targetPath}`)
  }
})
