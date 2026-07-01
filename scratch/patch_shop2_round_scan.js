import fs from 'fs'

const filePath = 'a:/centrum/src/modules/Shop2Terminal.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add QrCode to imported icons list
content = content.replace(
  `X, ClipboardList, Camera, Menu, RefreshCw, Box, Layers, Gauge, Package, Eye, Search`,
  `X, ClipboardList, Camera, Menu, RefreshCw, Box, Layers, Gauge, Package, Eye, Search, QrCode`
)

// 2. Remove the rectangular scan button from the dashboard header area
const targetHeaderWithBtn = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
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

const replacementHeaderWithoutBtn = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
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
                </div>
              </div>`

const normalizedContent = content.replace(/\r?\n/g, '\n')
const normTarget = targetHeaderWithBtn.replace(/\r?\n/g, '\n')
const normReplacement = replacementDashboardHeader(replacementHeaderWithoutBtn)

function replacementDashboardHeader(str) {
  return str.replace(/\r?\n/g, '\n')
}

let patchedContent = normalizedContent

if (patchedContent.includes(normTarget)) {
  patchedContent = patchedContent.replace(normTarget, normReplacement)
  console.log("Successfully removed rectangular scan button from dashboard header.")
} else {
  console.error("Could not find the target dashboard header with rectangular scan button!")
}

// 3. Add the floating round scan button at the bottom of the dashboard layout (before the machineCallModal block)
const modalTarget = `      {machineCallModal && (`
const modalReplacement = `      <button onClick={() => setIsScanning(true)}
        className="hover-lift"
        style={{ 
          background: '#8b5cf6', 
          border: 'none', 
          color: '#000', 
          width: '64px',
          height: '64px',
          borderRadius: '50%', 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center', 
          cursor: 'pointer',
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 1000,
          boxShadow: '0 10px 30px rgba(139,92,246,0.4)',
          transition: 'all 0.2s'
        }}>
        <QrCode size={32} />
      </button>

      {machineCallModal && (`

const normModalTarget = modalTarget.replace(/\r?\n/g, '\n')
const normModalReplacement = modalReplacement.replace(/\r?\n/g, '\n')

if (patchedContent.includes(normModalTarget)) {
  patchedContent = patchedContent.replace(normModalTarget, normModalReplacement)
  console.log("Successfully added floating round QR scan button.")
} else {
  console.error("Could not find machineCallModal block to place round scan button!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Completed round scan button migration successfully.")
