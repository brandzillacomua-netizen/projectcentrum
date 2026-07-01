import fs from 'fs'

const filePath = 'a:/centrum/src/modules/Shop2Terminal.jsx'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Replace the dashboard header to remove the static search form
const targetHeader = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
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

const replacementHeader = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950 }}>МОНІТОРИНГ ЦЕХУ №2</h2>
              </div>`

const normalizedContent = content.replace(/\r?\n/g, '\n')
const normTargetHeader = targetHeader.replace(/\r?\n/g, '\n')
const normReplacementHeader = replacementHeader.replace(/\r?\n/g, '\n')

let patchedContent = normalizedContent

if (patchedContent.includes(normTargetHeader)) {
  patchedContent = patchedContent.replace(normTargetHeader, normReplacementHeader)
  console.log("Successfully removed static search form from dashboard header.")
} else {
  console.error("Could not find dashboard header with static search form!")
}

// 2. Replace the floating QR scan button with the combined floating control panel
const targetFloatingBtn = `      <button onClick={() => setIsScanning(true)}
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
      </button>`

const replacementFloatingControls = `      {/* Floating Controls (Search and Scan QR) */}
      <div style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1000
      }}>
        {/* Floating Search Form */}
        <form onSubmit={handleManualEntry} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(10, 10, 10, 0.95)',
          border: '1px solid #222',
          padding: '10px 14px',
          borderRadius: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          <Search size={16} color="#6b7280" />
          <input
            type="text"
            placeholder="Введіть системний номер..."
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            disabled={isProcessing}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '180px' }}
          />
          <button type="submit" disabled={isProcessing} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        {/* Floating Round QR Scan Button */}
        <button onClick={() => setIsScanning(true)}
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
            boxShadow: '0 10px 30px rgba(139,92,246,0.4)',
            transition: 'all 0.2s',
            flexShrink: 0
          }}>
          <QrCode size={32} />
        </button>
      </div>`

const normTargetFloatingBtn = targetFloatingBtn.replace(/\r?\n/g, '\n')
const normReplacementFloatingControls = replacementFloatingControls.replace(/\r?\n/g, '\n')

if (patchedContent.includes(normTargetFloatingBtn)) {
  patchedContent = patchedContent.replace(normTargetFloatingBtn, normReplacementFloatingControls)
  console.log("Successfully replaced floating QR button with combined floating controls.")
} else {
  console.error("Could not find floating scan button target!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Floating controls migration complete.")
