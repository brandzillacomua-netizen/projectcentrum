import fs from 'fs'

const filePath = 'a:/centrum/src/modules/Shop2Terminal.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Remove the search form from the navigation header
const headerSearchFormStr = `\n          <form onSubmit={handleManualEntry} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0e0e12', border: '1px solid #222', padding: '6px 10px', borderRadius: '10px', marginLeft: '15px' }}>
            <Search size={14} color="#6b7280" />
            <input
              type="text"
              placeholder="Системний номер..."
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              disabled={isProcessing}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 700, outline: 'none', width: '130px' }}
            />
            <button type="submit" disabled={isProcessing} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {isProcessing ? <RefreshCw size={10} className="anim-spin" /> : 'ЗНАЙТИ'}
            </button>
          </form>`

if (content.includes(headerSearchFormStr)) {
  content = content.replace(headerSearchFormStr, '')
  console.log("Successfully removed search form from header navbar.")
} else {
  // Try finding a version with slightly different spacing or CRLF
  const normalizedSearchFormStr = headerSearchFormStr.replace(/\r?\n/g, '\n')
  const normalizedContent = content.replace(/\r?\n/g, '\n')
  if (normalizedContent.includes(normalizedSearchFormStr)) {
    content = normalizedContent.replace(normalizedSearchFormStr, '').replace(/\n/g, '\r\n')
    console.log("Successfully removed search form from header navbar (normalized).")
  } else {
    console.error("Could not find search form in header navbar!")
  }
}

// 2. Insert the search form below, next to "СКАНУВАТИ QR" in the dashboard area
const targetDashboardHeader = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950 }}>МОНІТОРИНГ ЦЕХУ №2</h2>
                <button onClick={() => setIsScanning(true)} style={{ background: '#8b5cf6', border: 'none', color: '#fff', padding: '15px 30px', borderRadius: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><Camera size={20} /> СКАНУВАТИ QR</button>
              </div>`

const replacementDashboardHeader = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950 }}>МОНІТОРИНГ ЦЕХУ №2</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <form onSubmit={handleManualEntry} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0e0e12', border: '1px solid #222', padding: '10px 14px', borderRadius: '13px' }}>
                    <Search size={16} color="#6b7280" />
                    <input
                      type="text"
                      placeholder="Введіть системний номер..."
                      value={manualId}
                      onChange={e => setManualId(e.target.value)}
                      disabled={isProcessing}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '180px' }}
                    />
                    <button type="submit" disabled={isProcessing} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
                    </button>
                  </form>
                  <button onClick={() => setIsScanning(true)} style={{ background: '#8b5cf6', border: 'none', color: '#fff', padding: '15px 30px', borderRadius: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}><Camera size={20} /> СКАНУВАТИ QR</button>
                </div>
              </div>`

const normalizedTarget = targetDashboardHeader.replace(/\r?\n/g, '\n')
const normalizedReplacement = replacementDashboardHeader.replace(/\r?\n/g, '\n')
const currentNormalizedContent = content.replace(/\r?\n/g, '\n')

if (currentNormalizedContent.includes(normalizedTarget)) {
  content = currentNormalizedContent.replace(normalizedTarget, normalizedReplacement).replace(/\n/g, '\r\n')
  console.log("Successfully replaced dashboard header with search form.")
} else {
  console.error("Could not find the target dashboard header to replace!")
}

fs.writeFileSync(filePath, content, 'utf8')
