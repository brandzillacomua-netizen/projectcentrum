const fs = require('fs')
const path = 'a:/centrum/src/contexts/useData.js'
let content = fs.readFileSync(path, 'utf8')

// Find the broken section and replace it with the correct block
const brokenBlock = `

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleRefresh)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleRefresh)
    }
  }, [])`

const fixedBlock = `

  useEffect(() => {
    fetchCritical()

    const handleRefresh = () => {
      const now = Date.now()
      // Throttle: minimum 30s between reloads — prevents window.confirm focus events racing with async deletes
      if (now - lastVisibilityRefreshRef.current > 30000) {
        lastVisibilityRefreshRef.current = now
        console.log('[App Reactivation] Refreshing critical data on focus/visibility change')
        fetchCritical().catch(err => console.error(err))
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleRefresh)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleRefresh)
    }
  }, [])`

if (content.includes(brokenBlock)) {
  content = content.replace(brokenBlock, fixedBlock)
  fs.writeFileSync(path, content, 'utf8')
  console.log('Fixed! Restored useEffect block with 30s throttle')
} else {
  console.log('Broken block not found as exact match, trying line-based approach...')
  console.log('Searching for markers...')
  
  // Find line with "const handleVisibilityChange" that's NOT inside a useEffect
  const lines = content.split('\n')
  let brokenStart = -1
  let brokenEnd = -1
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleVisibilityChange') && !lines[i - 1]?.trim() && i > 0) {
      // Check if there's NO useEffect above it within 5 lines
      const above = lines.slice(Math.max(0, i - 5), i).join('\n')
      if (!above.includes('useEffect')) {
        brokenStart = i - 1  // include the blank line before
        console.log('Found broken start at line', brokenStart + 1, ':', lines[i])
      }
    }
    if (brokenStart !== -1 && lines[i].includes('}, [])') && i > brokenStart) {
      brokenEnd = i
      console.log('Found broken end at line', brokenEnd + 1, ':', lines[i])
      break
    }
  }
  
  if (brokenStart !== -1 && brokenEnd !== -1) {
    const before = lines.slice(0, brokenStart)
    const after = lines.slice(brokenEnd + 1)
    const newLines = [
      ...before,
      '',
      '  useEffect(() => {',
      '    fetchCritical()',
      '',
      '    const handleRefresh = () => {',
      '      const now = Date.now()',
      '      // Throttle: minimum 30s between reloads — prevents window.confirm focus events racing with async deletes',
      '      if (now - lastVisibilityRefreshRef.current > 30000) {',
      '        lastVisibilityRefreshRef.current = now',
      "        console.log('[App Reactivation] Refreshing critical data on focus/visibility change')",
      '        fetchCritical().catch(err => console.error(err))',
      '      }',
      '    }',
      '',
      '    const handleVisibilityChange = () => {',
      "      if (document.visibilityState === 'visible') {",
      '        handleRefresh()',
      '      }',
      '    }',
      '',
      "    document.addEventListener('visibilitychange', handleVisibilityChange)",
      "    window.addEventListener('focus', handleRefresh)",
      '',
      '    return () => {',
      "      document.removeEventListener('visibilitychange', handleVisibilityChange)",
      "      window.removeEventListener('focus', handleRefresh)",
      '    }',
      '  }, [])',
      ...after
    ]
    const fixed = newLines.join('\n')
    fs.writeFileSync(path, fixed, 'utf8')
    console.log('Fixed via line-based approach! Restored useEffect block.')
  } else {
    console.log('Could not find the broken block. Manual fix needed.')
    console.log('brokenStart:', brokenStart, 'brokenEnd:', brokenEnd)
  }
}
