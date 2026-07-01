import fs from 'fs'

const filePath = 'a:/centrum/src/modules/Shop2Terminal.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add scan button at the bottom of the left side-panel
const sidePanelTarget = `        <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={16} /> ЧЕРГА ЦЕХ №2 ({queuedCards.length})
          </div>
          {renderQueue()}
        </div>`

const sidePanelReplacement = `        <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={16} /> ЧЕРГА ЦЕХ №2 ({queuedCards.length})
          </div>
          {renderQueue()}
          <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setIsScanning(true)}
              style={{ width: '100%', background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#8b5cf6', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Camera size={18} /> СКАНУВАТИ
            </button>
          </div>
        </div>`

// 2. Add scan button at the bottom of the side-drawer (mobile view)
const sideDrawerTarget = `        <div style={{ position: 'fixed', left: isDrawerOpen ? 0 : '-300px', top: 0, bottom: 0, width: '300px', background: '#121212', zIndex: 100000, transition: '0.3s', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span>
            <X size={20} onClick={() => setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />
          </div>
          {renderQueue()}
        </div>`

const sideDrawerReplacement = `        <div style={{ position: 'fixed', left: isDrawerOpen ? 0 : '-300px', top: 0, bottom: 0, width: '300px', background: '#121212', zIndex: 100000, transition: '0.3s', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span>
            <X size={20} onClick={() => setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />
          </div>
          {renderQueue()}
          <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setIsScanning(true)}
              style={{ width: '100%', background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#8b5cf6', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Camera size={18} /> СКАНУВАТИ
            </button>
          </div>
        </div>`

// Normalize and replace
const normalizedContent = content.replace(/\r?\n/g, '\n')
const normSidePanelTarget = sidePanelTarget.replace(/\r?\n/g, '\n')
const normSidePanelReplacement = sidePanelReplacement.replace(/\r?\n/g, '\n')
const normSideDrawerTarget = sideDrawerTarget.replace(/\r?\n/g, '\n')
const normSideDrawerReplacement = sideDrawerReplacement.replace(/\r?\n/g, '\n')

let patchedContent = normalizedContent

if (patchedContent.includes(normSidePanelTarget)) {
  patchedContent = patchedContent.replace(normSidePanelTarget, normSidePanelReplacement)
  console.log("Patched side-panel.")
} else {
  console.error("Could not find side-panel target!")
}

if (patchedContent.includes(normSideDrawerTarget)) {
  patchedContent = patchedContent.replace(normSideDrawerTarget, normSideDrawerReplacement)
  console.log("Patched side-drawer.")
} else {
  console.error("Could not find side-drawer target!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Patched scan buttons successfully.")
