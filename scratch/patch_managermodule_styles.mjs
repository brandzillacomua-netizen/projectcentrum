import { readFileSync, writeFileSync } from 'fs'

const filePath = 'a:/centrum/src/modules/ManagerModule.jsx'
let src = readFileSync(filePath, 'utf8')
const hasCRLF = src.includes('\r\n')
if (hasCRLF) src = src.replace(/\r\n/g, '\n')

// ── PATCH: Enhance Modal Styles for Premium Glassmorphism Design ─────────────
const modalStylesOld = `        .modal-backdrop-modern {
          position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000;
          display: flex; align-items: center; justifyContent: center; padding: 20px;
          backdrop-filter: blur(8px);
        }
        .modal-content-modern { width: 100%; maxWidth: 650px; }
        .modal-header-modern { display: flex; justify-content: space-between; align-items: center; padding: 30px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .modal-header-modern h2 { margin: 0; font-size: 1.5rem; font-weight: 900; }
        .btn-close-modal { background: transparent; border: none; color: #555; cursor: pointer; transition: color 0.3s; }
        .btn-close-modal:hover { color: #fff; }
        
        .modal-body-modern { padding: 30px; }
        .details-grid-modern { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
        .detail-item label { display: block; font-size: 0.6rem; color: #444; font-weight: 900; letter-spacing: 1px; margin-bottom: 8px; }
        .detail-item div { font-size: 1.1rem; font-weight: 600; }
        
        .section-subtitle-modern { font-size: 0.75rem; color: #333; font-weight: 900; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 10px; }
        .item-row-modern { display: flex; align-items: center; gap: 15px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 14px; margin-bottom: 10px; }
        .item-name { flex: 1; font-weight: 500; }
        .item-qty { color: #ff9000; font-size: 1.1rem; }`

const modalStylesNew = `        .modal-backdrop-modern {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000;
          display: flex; align-items: center; justify-content: center; padding: 20px;
          backdrop-filter: blur(20px);
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .modal-content-modern { 
          width: 100%; 
          maxWidth: 600px; 
          background: rgba(15, 15, 18, 0.75); 
          border: 1px solid rgba(255, 144, 0, 0.15); 
          border-radius: 28px; 
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.05); 
          overflow: hidden;
        }
        
        .modal-header-modern { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 24px 32px; 
          border-bottom: 1px solid rgba(255,255,255,0.04); 
          background: rgba(255, 255, 255, 0.01);
        }
        
        .modal-header-modern h2 { 
          margin: 0; 
          font-size: 1.25rem; 
          font-weight: 900; 
          letter-spacing: -0.5px; 
          text-transform: uppercase;
        }
        
        .btn-close-modal { 
          background: rgba(255,255,255,0.03); 
          border: 1px solid rgba(255,255,255,0.05); 
          color: #888; 
          cursor: pointer; 
          width: 38px; 
          height: 38px; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          transition: all 0.2s; 
        }
        .btn-close-modal:hover { color: #fff; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }
        
        .modal-body-modern { padding: 32px; }
        
        .details-grid-modern { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 20px 32px; 
          margin-bottom: 32px; 
          background: rgba(0,0,0,0.2); 
          padding: 20px 24px; 
          border-radius: 20px; 
          border: 1px solid rgba(255,255,255,0.02);
        }
        
        .detail-item label { 
          display: block; 
          font-size: 0.62rem; 
          color: #555; 
          font-weight: 950; 
          letter-spacing: 1.5px; 
          margin-bottom: 6px; 
          text-transform: uppercase;
        }
        
        .detail-item div { 
          font-size: 1.05rem; 
          font-weight: 800; 
          color: #eee;
        }
        
        .section-subtitle-modern { 
          font-size: 0.72rem; 
          color: #444; 
          font-weight: 950; 
          margin-bottom: 16px; 
          letter-spacing: 1px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .item-row-modern { 
          display: flex; 
          align-items: center; 
          gap: 15px; 
          padding: 16px 20px; 
          background: rgba(255,255,255,0.01); 
          border: 1px solid rgba(255,255,255,0.03); 
          border-radius: 16px; 
          margin-bottom: 12px; 
          transition: border-color 0.2s;
        }
        .item-row-modern:hover { border-color: rgba(255, 144, 0, 0.15); }
        
        .item-name { 
          flex: 1; 
          font-weight: 700; 
          font-size: 0.92rem; 
          color: #ddd; 
        }
        
        .item-qty { 
          color: #ff9000; 
          font-size: 1.15rem; 
          font-weight: 900;
        }`

const cleanOld = modalStylesOld.replace(/\r\n/g, '\n')
const cleanNew = modalStylesNew.replace(/\r\n/g, '\n')

if (!src.includes(cleanOld)) { console.error('modalStylesOld anchor not found'); process.exit(1) }
src = src.replace(cleanOld, cleanNew)
console.log('✓ Modal styling updated in CSS injection')

if (hasCRLF) src = src.replace(/\n/g, '\r\n')
writeFileSync(filePath, src, 'utf8')
console.log('✓ ManagerModule.jsx style updated')
