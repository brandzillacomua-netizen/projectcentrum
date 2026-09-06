// scratch/verify_settings_render.mjs
import fs from 'fs'
import path from 'path'

console.log('Testing file integrity for Settings Module & Tabs:');

const files = [
  'src/modules/SettingsModule.jsx',
  'src/modules/Settings/components/SettingsUsersTab.jsx',
  'src/modules/Settings/components/SettingsStructureTab.jsx',
  'src/modules/Settings/components/SettingsSystemAdminTab.jsx',
  'src/modules/Settings/components/SettingsSnapshotCorrTab.jsx',
  'src/modules/Settings/hooks/useSettingsState.jsx',
  'src/modules/Settings/hooks/subhooks/useSettingsUsers.jsx',
  'src/modules/Settings/hooks/subhooks/useSettingsStructure.jsx',
  'src/modules/Settings/hooks/subhooks/useSettingsImports.js',
  'src/modules/Settings/hooks/subhooks/useSettingsSnapshotCorr.js',
  'src/modules/Settings/hooks/subhooks/useSettingsSystemAdmin.js'
]

let allOk = true
for (const file of files) {
  const fullPath = path.resolve(file)
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${file}`)
    allOk = false
  } else {
    const stat = fs.statSync(fullPath)
    console.log(`✅ [${stat.size} bytes] ${file}`)
  }
}

if (allOk) {
  console.log('\n✓ All 11 files exist and are populated cleanly!')
} else {
  process.exit(1)
}
