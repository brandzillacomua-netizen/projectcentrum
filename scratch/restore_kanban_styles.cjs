const fs = require('fs');
let code = fs.readFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', 'utf8');

const anchor = '      )}\n          scrollbar-width: thin; scrollbar-color: #1a1a1a transparent;';
const anchorIdx = code.indexOf(anchor);
if (anchorIdx < 0) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
console.log('Anchor found at:', anchorIdx);

const insertionPoint = anchorIdx + '      )}\n'.length;

const missingBlock = `      {/* ─── STYLES ───────────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: \`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }

        .kb-root {
          background: #020202;
          min-height: 100vh; height: 100vh;
          color: #e8e8e8;
          display: flex; flex-direction: column;
          font-family: 'Inter', sans-serif;
          overflow: hidden;
        }

        /* ── NAV ── */
        .kb-nav {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 32px; height: 64px;
          background: rgba(8,8,8,0.95);
          border-bottom: 1px solid #111;
          flex-shrink: 0;
          backdrop-filter: blur(20px);
        }
        .kb-nav-left { display: flex; align-items: center; gap: 24px; }
        .kb-back { display: flex; align-items: center; gap: 6px; color: #444; text-decoration: none; font-weight: 800; font-size: 0.75rem; letter-spacing: 1px; transition: color 0.2s; }
        .kb-back:hover { color: #ff9000; }
        .kb-brand { display: flex; align-items: center; gap: 12px; }
        .kb-brand-icon { width: 36px; height: 36px; background: rgba(255,144,0,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ff9000; border: 1px solid rgba(255,144,0,0.2); }
        .kb-brand-text h1 { margin: 0; font-size: 1rem; font-weight: 900; letter-spacing: 2px; color: #fff; }
        .kb-brand-text span { font-size: 0.65rem; color: #333; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .role-badge { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
        .manager-badge { background: rgba(255,144,0,0.1); color: #ff9000; border: 1px solid rgba(255,144,0,0.25); }
        .kb-nav-right { display: flex; align-items: center; gap: 12px; }
        .kb-search-wrap { display: flex; align-items: center; gap: 8px; }
        .kb-search-wrap.open { background: #0d0d0d; border: 1px solid #222; border-radius: 10px; padding: 4px 10px; }
        .kb-search-input { background: transparent; border: none; color: #fff; outline: none; font-family: inherit; font-size: 0.85rem; width: 180px; }
        .icon-btn { background: transparent; border: 1px solid #1a1a1a; color: #555; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .icon-btn:hover { background: #111; color: #fff; border-color: #333; }
        .icon-btn.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3); }
        .kb-filters { display: flex; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 10px; padding: 3px; gap: 2px; }
        .kf-btn { background: transparent; border: none; color: #444; padding: 5px 14px; border-radius: 7px; font-weight: 800; font-size: 0.68rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; letter-spacing: 0.5px; }
        .kf-btn.active { background: #1a1a1a; color: #fff; }
        .kf-btn:hover:not(.active) { color: #888; }
        .kb-add-btn { display: flex; align-items: center; gap: 7px; background: #ff9000; color: #000; border: none; padding: 8px 18px; border-radius: 10px; font-weight: 900; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; letter-spacing: 0.5px; }
        .kb-add-btn:hover { background: #ffaa33; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,144,0,0.3); }

        /* ── STATS ── */
        .kb-stats {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
          padding: 12px 32px;
          background: #050505; border-bottom: 1px solid #0f0f0f;
          flex-shrink: 0;
        }
        .stat-tile {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 18px;
          background: #080808; border: 1px solid #111; border-radius: 14px;
          cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;
        }
        .stat-tile::before { content: ''; position: absolute; inset: 0; background: var(--sc); opacity: 0; transition: opacity 0.2s; }
        .stat-tile:hover::before { opacity: 0.03; }
        .stat-tile.active { border-color: var(--sc); box-shadow: 0 0 0 1px var(--sc), 0 4px 20px rgba(0,0,0,0.5); }
        .stat-tile.active::before { opacity: 0.05; }
        .st-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .st-body { display: flex; flex-direction: column; }
        .st-num { font-size: 1.3rem; font-weight: 900; line-height: 1; }
        .st-label { font-size: 0.6rem; font-weight: 800; color: #333; letter-spacing: 1px; margin-top: 2px; }
        .st-alert-dot { position: absolute; top: 8px; right: 8px; width: 7px; height: 7px; background: #ef4444; border-radius: 50%; animation: pulse-dot 1.5s ease infinite; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }

        /* ── MOBILE TABS ── */
        .kb-mobile-tabs { display: none; }

        /* ── BODY CONTAINER ── */
        .kb-body-container {
          display: flex;
          flex-direction: row;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        /* ── BOARD ── */
        .kb-board {
          display: flex; gap: 16px; padding: 20px 20px; overflow-x: auto; flex: 1;
          align-items: stretch; min-height: 0;
`;

code = code.slice(0, insertionPoint) + missingBlock + code.slice(insertionPoint);
fs.writeFileSync('a:\\centrum\\src\\modules\\KanbanModule.jsx', code, 'utf8');
console.log('Done! New file size:', code.length);
