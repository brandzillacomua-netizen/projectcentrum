import fs from 'fs'

const filePath = 'a:/centrum/src/modules/Shop2Terminal.jsx'
let content = fs.readFileSync(filePath, 'utf8')

const targetControls = `      {/* Floating Controls (Search and Scan QR) */}
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

const replacementControls = `      <style>{\`
        .floating-controls-container {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
          transition: all 0.3s ease;
        }
        @media (max-width: 600px) {
          .floating-controls-container {
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: rgba(10, 10, 12, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding: 14px 20px;
            justify-content: space-between;
            border-radius: 0;
            box-shadow: 0 -10px 35px rgba(0,0,0,0.9);
            backdrop-filter: blur(15px);
          }
          .floating-controls-container form {
            flex: 1;
            box-shadow: none !important;
            background: #000 !important;
            border: 1px solid #222 !important;
          }
        }
      \`}</style>

      {/* Floating Controls (Search and Scan QR) */}
      <div className="floating-controls-container">
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
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
          />
          <button type="submit" disabled={isProcessing} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
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

const normalizedContent = content.replace(/\r?\n/g, '\n')
const normTargetControls = targetControls.replace(/\r?\n/g, '\n')
const normReplacementControls = replacementControls.replace(/\r?\n/g, '\n')

let patchedContent = normalizedContent

if (patchedContent.includes(normTargetControls)) {
  patchedContent = patchedContent.replace(normTargetControls, normReplacementControls)
  console.log("Successfully patched floating controls with mobile dock bar styling.")
} else {
  console.error("Could not find floating controls target block!")
}

fs.writeFileSync(filePath, patchedContent.replace(/\n/g, '\r\n'), 'utf8')
console.log("Migration complete.")
