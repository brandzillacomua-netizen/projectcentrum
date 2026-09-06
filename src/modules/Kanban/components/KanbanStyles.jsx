import React from 'react'

export const KanbanStyles = () => (
  <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }

        .kb-root {
          background: #020202;
          min-height: calc(100vh - 56px);
          height: calc(100vh - 56px);
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
        .projects-nav-btn { display: flex; align-items: center; gap: 9px; min-width: 154px; padding: 7px 10px 7px 7px; border-radius: 11px; text-decoration: none; background: linear-gradient(135deg, #ff9000, #ffab2e); color: #090909; border: 1px solid #ffc05a; box-shadow: 0 5px 18px rgba(255,144,0,0.2); transition: transform .2s, box-shadow .2s, filter .2s; }
        .projects-nav-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,144,0,0.38); filter: brightness(1.07); }
        .projects-nav-icon { width: 29px; height: 29px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.14); }
        .projects-nav-copy { display: flex; flex: 1; flex-direction: column; line-height: 1.05; }
        .projects-nav-copy b { font-size: .72rem; letter-spacing: .7px; }
        .projects-nav-copy small { margin-top: 4px; font-size: .56rem; font-weight: 700; opacity: .62; }
        .projects-nav-arrow { transition: transform .2s; }
        .projects-nav-btn:hover .projects-nav-arrow { transform: translateX(3px); }

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

        /* ── FLOATING ADD TASK BUTTON ── */
        .kb-floating-add-btn {
          position: fixed;
          bottom: 32px;
          right: 32px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff9000 0%, #ff5500 100%);
          border: none;
          color: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(255, 144, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2);
          z-index: 99999;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: float-btn-bounce 3s ease-in-out infinite;
        }
        .kb-floating-add-btn:hover {
          transform: scale(1.1) translateY(-3px);
          box-shadow: 0 12px 30px rgba(255, 144, 0, 0.6);
          background: linear-gradient(135deg, #ffaa33 0%, #ff6622 100%);
        }
        .kb-floating-add-btn:active {
          transform: scale(0.95);
        }
        @keyframes float-btn-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @media (max-width: 768px) {
          .kb-floating-add-btn {
            bottom: 24px;
            right: 24px;
            width: 50px;
            height: 50px;
          }
        }

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
          scrollbar-width: thin; scrollbar-color: #1a1a1a transparent;
          min-width: 0;
        }
        .kb-board::-webkit-scrollbar { height: 6px; }
        .kb-board::-webkit-scrollbar-track { background: transparent; }
        .kb-board::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 3px; }

        /* ── SIDEBAR ── */
        .kb-sidebar {
          position: fixed;
          top: 73px;
          right: 0;
          bottom: 0;
          width: 280px; min-width: 280px; max-width: 280px;
          height: calc(100% - 73px);
          background: #060606; border-left: 1px solid #141414;
          overflow: visible; padding: 16px 14px;
          display: flex; flex-direction: column; gap: 12px;
          z-index: 9999;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          scrollbar-width: thin; scrollbar-color: rgba(255, 144, 0, 0.2) transparent;
        }
        .kb-sidebar.open {
          transform: translateX(0);
          box-shadow: -10px 0 30px rgba(0,0,0,0.8);
        }
        .kb-sidebar::-webkit-scrollbar { width: 6px; }
        .kb-sidebar::-webkit-scrollbar-thumb { background: rgba(255, 144, 0, 0.2); border-radius: 3px; }
        .kb-sidebar::-webkit-scrollbar-thumb:hover { background: rgba(255, 144, 0, 0.4); }

        .kb-sidebar-toggle-tab {
          position: absolute;
          left: -32px;
          top: 180px;
          width: 32px;
          height: 120px;
          background: linear-gradient(180deg, #161616 0%, #0c0c0c 100%);
          border: 1px solid #ff900033;
          border-right: none;
          border-radius: 10px 0 0 10px;
          color: #ff9000;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: -8px 0 20px rgba(0,0,0,0.7);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10000;
          padding: 8px 0;
        }
        .kb-sidebar-toggle-tab:hover {
          background: linear-gradient(180deg, #ff9000 0%, #ff5500 100%);
          color: #000;
          border-color: transparent;
          width: 36px;
          left: -36px;
        }
        .kb-sidebar-toggle-tab:hover .tab-text {
          color: #000;
          text-shadow: none;
        }
        .kb-sidebar-toggle-tab:hover .tab-arrow-icon {
          color: #000;
        }
        .kb-sidebar-toggle-tab:hover .tab-indicator-dots {
          background: #000;
        }
        .tab-arrow-icon {
          color: #ff9000;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        .tab-text {
          writing-mode: vertical-rl;
          text-orient: mixed;
          transform: rotate(180deg);
          font-size: 0.62rem;
          font-weight: 900;
          letter-spacing: 2px;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          user-select: none;
          transition: color 0.2s;
        }
        .tab-indicator-dots {
          width: 4px;
          height: 4px;
          background: #ff9000;
          border-radius: 50%;
          box-shadow: 0 0 8px #ff9000;
          animation: pulse-tab-dot 2s ease infinite;
        }
        @keyframes pulse-tab-dot {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 1; }
        }

        .sb-block { flex-shrink: 0; background: #080808; border: 1px solid #111; border-radius: 14px; overflow: hidden; }
        .sb-block-head { display: flex; align-items: center; gap: 7px; padding: 8px 12px; border-bottom: 1px solid #111; font-size: 0.6rem; font-weight: 900; color: #333; letter-spacing: 1.5px; text-transform: uppercase; }
        .sb-empty { padding: 12px 14px; font-size: 0.72rem; color: #282828; font-weight: 600; text-align: center; }

        /* Department list */
        .sb-dept-list { display: flex; flex-direction: column; gap: 4px; padding: 6px; }
        .sb-dept-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px; border-radius: 8px; cursor: pointer;
          transition: all 0.2s; background: rgba(255,255,255,0.01);
          border: 1px solid transparent;
        }
        .sb-dept-item:hover { background: rgba(255,144,0,0.05); border-color: rgba(255,144,0,0.15); }
        .sb-dept-item.active { background: rgba(255,144,0,0.1); border-color: #ff9000; }
        .sb-dept-name { font-size: 0.8rem; font-weight: 700; color: #ccc; }
        .sb-dept-item.active .sb-dept-name { color: #fff; }
        .sb-dept-badges { display: flex; gap: 4px; align-items: center; }
        .sb-dbadge {
          font-size: 0.65rem; font-weight: 900; padding: 2px 6px; border-radius: 5px; min-width: 18px; text-align: center;
        }
        .sb-dbadge-todo { background: rgba(255,255,255,0.05); color: #888; }
        .sb-dbadge-prog { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .sb-dbadge-rev { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .sb-dbadge-over { background: rgba(239,68,68,0.15); color: #ef4444; }
        .sb-dbadge-empty { background: transparent; color: #222; }

        /* Deadlines */
        .sb-deadline-list { display: flex; flex-direction: column; gap: 1px; }
        .sb-deadline-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; cursor: pointer; border-bottom: 1px solid #0d0d0d; transition: background 0.15s; }
        .sb-deadline-item:last-child { border-bottom: none; }
        .sb-deadline-item:hover { background: rgba(255,255,255,0.015); }
        .sb-deadline-item.dl-overdue { background: rgba(239,68,68,0.03); }
        .sb-deadline-item.dl-soon { background: rgba(245,158,11,0.02); }
        .dl-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .dl-date { font-size: 0.68rem; font-weight: 900; margin-bottom: 2px; letter-spacing: 0.3px; white-space: nowrap; }
        .dl-title { font-size: 0.75rem; color: #aaa; white-space: normal; word-break: break-word; font-weight: 600; line-height: 1.25; }
        .dl-avatar { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg,#ff9000,#ffb347); color: #000; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; font-weight: 900; flex-shrink: 0; }

        /* Stats */
        .sb-stats-grid { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .sb-stat-row { display: flex; flex-direction: column; gap: 4px; }
        .sb-stat-label { font-size: 0.6rem; font-weight: 900; letter-spacing: 0.5px; }
        .sb-stat-bar-wrap { display: flex; align-items: center; gap: 6px; }
        .sb-stat-bar { flex: 1; height: 4px; background: #111; border-radius: 2px; overflow: hidden; }
        .sb-stat-num { font-size: 0.7rem; font-weight: 900; min-width: 16px; text-align: right; }
        .sb-divider { height: 1px; background: #111; margin: 4px 0; }
        .sb-mini-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
        .sb-mini-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; background: #0d0d0d; border-radius: 8px; padding: 8px 4px; border: 1px solid #111; }
        .sb-mini-label { font-size: 0.55rem; color: #333; font-weight: 800; text-align: center; letter-spacing: 0.3px; }
        .sb-mini-val { font-size: 1rem; font-weight: 900; }

        /* ── COLUMN ── */
        .kb-col {
          flex: 0 0 290px; display: flex; flex-direction: column;
          background: #070707; border: 1px solid #111; border-radius: 18px;
          overflow: hidden; min-height: 0;
        }
        .col-head {
          padding: 16px 18px 14px; border-top: 3px solid; border-bottom: 1px solid #111;
          display: flex; justify-content: space-between; align-items: center;
          background: #0a0a0a;
        }
        .col-head-left { display: flex; align-items: center; gap: 10px; }
        .col-head h3 { margin: 0; font-size: 0.8rem; font-weight: 900; letter-spacing: 1.5px; }
        .col-cnt { font-size: 0.75rem; font-weight: 900; padding: 3px 9px; border-radius: 20px; }
        .col-add-btn { width: 26px; height: 26px; border-radius: 7px; background: rgba(255,144,0,0.1); border: 1px solid rgba(255,144,0,0.2); color: #ff9000; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .col-add-btn:hover { background: #ff9000; color: #000; }
        .col-body { padding: 14px 12px; flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; scrollbar-width: thin; scrollbar-color: #1a1a1a transparent; }
        .col-body::-webkit-scrollbar { width: 4px; }
        .col-body::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
        .col-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 30px 10px; border: 2px dashed #111; border-radius: 12px; color: #1d1d1d; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }

        /* ── CARD ── */
        .kb-card {
          flex-shrink: 0;
          background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 14px;
          padding: 14px; cursor: pointer; position: relative;
          transition: all 0.22s ease; overflow: hidden;
        }
        .kb-card::after { content:''; position:absolute; inset:0; background: rgba(255,255,255,0); transition: background 0.2s; border-radius: 14px; pointer-events:none; }
        .kb-card:hover { border-color: #2a2a2a; transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,0.6); }
        .kb-card:hover::after { background: rgba(255,255,255,0.008); }
        .kb-card.dragging { opacity: 0.4; transform: rotate(2deg); border-style: dashed; }
        .kb-card.overdue { border-color: rgba(239,68,68,0.25) !important; }

        .card-pbar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; opacity: 0.7; }
        .card-top { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }

        .priority-badge { display: flex; align-items: center; gap: 4px; font-size: 0.6rem; font-weight: 900; padding: 3px 8px; border-radius: 6px; border: 1px solid; letter-spacing: 0.5px; }
        .collective-badge { display: flex; align-items: center; gap: 4px; background: rgba(139,92,246,0.1); color: #8b5cf6; font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(139,92,246,0.2); }
        .overdue-badge { display: flex; align-items: center; gap: 4px; background: rgba(239,68,68,0.1); color: #ef4444; font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.2); }
        .pulse { animation: pulse-badge 2s ease infinite; }
        @keyframes pulse-badge { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .card-title { margin: 0 0 10px; font-size: 0.88rem; font-weight: 700; line-height: 1.4; color: #ddd; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #141414; }
        .card-meta { display: flex; align-items: center; gap: 10px; }
        .card-deadline { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 700; }
        .card-cl-count { display: flex; align-items: center; gap: 3px; font-size: 0.7rem; font-weight: 700; }
        .card-users { display: flex; }

        .checklist-bar-wrap { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
        .checklist-bar-track { flex: 1; height: 3px; background: #1a1a1a; border-radius: 2px; overflow: hidden; }
        .checklist-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
        .checklist-bar-label { display: flex; align-items: center; gap: 3px; font-size: 0.65rem; font-weight: 800; white-space: nowrap; }

        /* ── CARD ACTIONS ── */
        .card-actions { display: flex; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #161616; }
        .ca-row { display: flex; gap: 6px; width: 100%; }
        .ca-btn { flex: 1; padding: 7px 10px; border-radius: 8px; border: 1px solid; font-size: 0.65rem; font-weight: 900; cursor: pointer; transition: all 0.2s; letter-spacing: 0.3px; }
        .ca-start { background: rgba(59,130,246,0.08); color: #3b82f6; border-color: rgba(59,130,246,0.2); }
        .ca-start:hover { background: #3b82f6; color: #fff; border-color: #3b82f6; }
        .ca-review { background: rgba(245,158,11,0.08); color: #f59e0b; border-color: rgba(245,158,11,0.2); }
        .ca-review:hover { background: #f59e0b; color: #000; border-color: #f59e0b; }
        .ca-approve { background: rgba(16,185,129,0.08); color: #10b981; border-color: rgba(16,185,129,0.2); }
        .ca-approve:hover { background: #10b981; color: #fff; }
        .ca-reject { background: rgba(239,68,68,0.08); color: #ef4444; border-color: rgba(239,68,68,0.2); }
        .ca-reject:hover { background: #ef4444; color: #fff; }

        .card-mgr-btns { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
        .kb-card:hover .card-mgr-btns { opacity: 1; }
        .mgr-btn { width: 22px; height: 22px; border-radius: 5px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .edit-btn { background: rgba(59,130,246,0.12); color: #3b82f6; }
        .edit-btn:hover { background: #3b82f6; color: #fff; }
        .del-btn { background: rgba(239,68,68,0.12); color: #ef4444; }
        .del-btn:hover { background: #ef4444; color: #fff; }

        /* ── USER AVATAR ── */
        .user-avatar-wrap { display: flex; align-items: center; gap: 7px; }
        .user-avatar { border-radius: 50%; background: linear-gradient(135deg, #ff9000, #ffb347); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 900; text-transform: uppercase; flex-shrink: 0; border: 2px solid #0d0d0d; }
        .avatar-name { font-size: 0.82rem; font-weight: 700; color: #ccc; }
        .ua-unassigned { width: 26px; height: 26px; border-radius: 50%; background: #111; color: #333; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; border: 2px dashed #222; }

        /* ── MODAL ── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(12px); animation: fade-in 0.2s ease; }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        .modal-box { background: #080808; border: 1px solid #1a1a1a; border-radius: 22px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.9); animation: modal-in 0.25s ease; }
        @keyframes modal-in { from{transform:scale(0.95) translateY(10px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
        .modal-head { padding: 22px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #111; }
        .modal-head h2 { margin: 0; font-size: 1.05rem; font-weight: 900; display: flex; align-items: center; gap: 10px; }
        .modal-head-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        .modal-head-left h2 { font-size: 1.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .modal-head-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .priority-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 8px currentColor; }

        /* ── DETAIL MODAL ── */
        .detail-modal { width: 900px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; }
        .detail-body { display: grid; grid-template-columns: 220px 1fr; flex: 1; overflow: hidden; }
        .detail-side { padding: 22px 20px; border-right: 1px solid #111; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; background: #060606; }
        .side-block { display: flex; flex-direction: column; gap: 6px; }
        .side-block label { font-size: 0.6rem; font-weight: 900; color: #333; text-transform: uppercase; letter-spacing: 1px; }
        .side-val { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; font-weight: 600; color: #999; }
        .status-chip { font-weight: 900; font-size: 0.82rem; }
        .status-select { background: #0f0f0f; border: 1px solid #222; color: #fff; padding: 8px 10px; border-radius: 8px; font-family: inherit; font-weight: 800; font-size: 0.8rem; width: 100%; cursor: pointer; }
        .side-actions { display: flex; flex-direction: column; gap: 8px; }
        .sa-btn { padding: 9px 12px; border-radius: 9px; border: 1px solid; font-size: 0.7rem; font-weight: 900; cursor: pointer; transition: all 0.2s; text-align: center; }
        .sa-start { background: rgba(59,130,246,0.1); color: #3b82f6; border-color: rgba(59,130,246,0.25); }
        .sa-start:hover { background: #3b82f6; color: #fff; }
        .sa-review { background: rgba(245,158,11,0.1); color: #f59e0b; border-color: rgba(245,158,11,0.25); }
        .sa-review:hover { background: #f59e0b; color: #000; }
        .sa-approve { background: rgba(16,185,129,0.1); color: #10b981; border-color: rgba(16,185,129,0.25); }
        .sa-approve:hover { background: #10b981; color: #fff; }
        .sa-reject { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.25); }
        .sa-reject:hover { background: #ef4444; color: #fff; }

        .detail-main { display: flex; flex-direction: column; overflow: hidden; }
        .detail-tabs { display: flex; gap: 2px; padding: 16px 22px 0; border-bottom: 1px solid #111; background: #060606; }
        .dtab { display: flex; align-items: center; gap: 7px; background: transparent; border: none; color: #444; padding: 10px 16px; font-family: inherit; font-size: 0.75rem; font-weight: 800; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s; letter-spacing: 0.3px; }
        .dtab.active { color: #ff9000; border-bottom-color: #ff9000; }
        .dtab:hover:not(.active) { color: #888; }
        .tab-content { flex: 1; padding: 22px; overflow-y: auto; }
        .desc-box { background: #060606; border: 1px solid #111; border-radius: 14px; padding: 20px; line-height: 1.7; color: #bbb; font-size: 0.88rem; white-space: pre-wrap; min-height: 100px; }
        .dim-text { color: #333; font-style: italic; }

        /* ── CHECKLIST ── */
        .checklist-editor { display: flex; flex-direction: column; gap: 12px; }
        .checklist-progress-row { display: flex; align-items: center; gap: 10px; }
        .cl-track { flex: 1; height: 5px; background: #111; border-radius: 3px; overflow: hidden; }
        .cl-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
        .cl-pct { font-size: 0.75rem; font-weight: 900; color: #888; min-width: 32px; text-align: right; }
        .checklist-items { display: flex; flex-direction: column; gap: 6px; }
        .check-click-area { transition: opacity 0.15s ease; }
        .check-click-area:hover { opacity: 0.85; }
        .check-click-area:active { opacity: 0.7; }
        .checklist-item.parent-item {
          background: #0d0d10 !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
          border-left: 3px solid #ff9000 !important;
          border-radius: 12px !important;
          padding: 12px 16px !important;
          margin-top: 10px !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .checklist-item.child-item {
          background: transparent !important;
          border: none !important;
          border-left: 2px solid rgba(255, 144, 0, 0.25) !important;
          border-radius: 0 !important;
          padding: 6px 12px 6px 16px !important;
          margin-left: 28px !important;
          margin-top: 2px !important;
          margin-bottom: 2px !important;
        }
        .checklist-item.child-item:hover {
          background: rgba(255, 255, 255, 0.02) !important;
          border-left-color: #ff9000 !important;
        }
        .checklist-item.child-item .check-text {
          font-size: 0.8rem !important;
          color: #aaa;
        }
        .checklist-item.child-item.done .check-text {
          color: #555 !important;
        }
        .checklist-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: #090909; border: 1px solid #141414; border-radius: 9px; transition: all 0.2s; }
        .checklist-item.done .check-text { text-decoration: line-through; color: #444; }
        .checklist-item:hover { border-color: #1e1e1e; }
        .check-toggle { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; flex-shrink: 0; }
        .check-text { flex: 1; font-size: 0.85rem; color: #ccc; line-height: 1.4; }
        .check-remove { background: none; border: none; color: #333; cursor: pointer; padding: 2px; display: flex; align-items: center; opacity: 0; transition: opacity 0.2s; }
        .checklist-item:hover .check-remove { opacity: 1; }
        .check-remove:hover { color: #ef4444; }
        .checklist-empty { text-align: center; padding: 20px; color: #282828; font-size: 0.8rem; font-weight: 700; }
        .add-check-row { display: flex; gap: 8px; }
        .add-check-row input { flex: 1; background: #0d0d0d; border: 1px solid #1a1a1a; color: #fff; padding: 9px 14px; border-radius: 9px; font-family: inherit; font-size: 0.83rem; outline: none; transition: border-color 0.2s; }
        .add-check-row input:focus { border-color: #ff9000; }
        .add-check-btn { width: 36px; height: 36px; border-radius: 9px; background: rgba(255,144,0,0.1); border: 1px solid rgba(255,144,0,0.2); color: #ff9000; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .add-check-btn:hover { background: #ff9000; color: #000; }

        /* ── COMMENTS ── */
        .comments-content { display: flex; flex-direction: column; height: 100%; }
        .comments-list { flex: 1; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; margin-bottom: 16px; padding-right: 4px; }
        .comment-item { display: flex; flex-direction: column; gap: 5px; }
        .comment-meta { display: flex; justify-content: space-between; padding: 0 4px; }
        .comment-author { font-size: 0.72rem; font-weight: 900; color: #ff9000; }
        .comment-time { font-size: 0.65rem; color: #333; }
        .comment-bubble { background: #0d0d0d; border: 1px solid #141414; padding: 10px 14px; border-radius: 10px; font-size: 0.82rem; color: #ccc; line-height: 1.5; word-break: break-word; }
        .comments-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 30px; color: #222; }
        .comment-form { display: flex; gap: 8px; padding: 12px; background: #060606; border: 1px solid #111; border-radius: 12px; margin-top: auto; }
        .comment-form input { flex: 1; background: transparent; border: none; color: #fff; outline: none; font-family: inherit; font-size: 0.83rem; }
        .comment-send { background: #ff9000; color: #000; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 900; font-size: 0.7rem; cursor: pointer; white-space: nowrap; }

        /* ── CREATE / EDIT MODAL ── */
        .create-modal { width: 560px; max-width: 95vw; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
        .modal-form { padding: 24px 28px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 18px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 0.65rem; font-weight: 900; color: #444; text-transform: uppercase; letter-spacing: 0.8px; display: flex; align-items: center; gap: 5px; }
        .form-group input, .form-group textarea, .form-group select { background: #0d0d0d; border: 1px solid #1a1a1a; color: #fff; padding: 11px 14px; border-radius: 10px; font-family: inherit; font-size: 0.88rem; outline: none; transition: border-color 0.2s; width: 100%; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #ff9000; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
        .form-group textarea { resize: vertical; }
        .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        /* Toggle */
        .collective-toggle { padding: 12px 16px; background: rgba(255,144,0,0.04); border: 1px solid rgba(255,144,0,0.1); border-radius: 10px; }
        .toggle-wrap { display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 0.83rem; font-weight: 700; color: #888; }
        .toggle-wrap input[type=checkbox] { display: none; }
        .toggle-slider { position: relative; width: 38px; height: 20px; background: #1a1a1a; border-radius: 10px; transition: background 0.2s; flex-shrink: 0; }
        .toggle-slider::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #444; transition: all 0.2s; }
        .toggle-wrap input:checked + .toggle-slider { background: #ff9000; }
        .toggle-wrap input:checked + .toggle-slider::after { left: 21px; background: #000; }

        /* Assignee */
        .assignee-selector { position: relative; }
        .selected-assignee { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #0d0d0d; border: 1px solid #ff900030; border-radius: 10px; }
        .clear-btn { background: none; border: none; color: #555; cursor: pointer; margin-left: auto; }
        .clear-btn:hover { color: #ef4444; }
        .assignee-search-wrap { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 10px; }
        .assignee-search-wrap input { flex: 1; background: transparent; border: none; color: #fff; outline: none; font-family: inherit; font-size: 0.88rem; }
        .assignee-search-wrap svg { color: #444; flex-shrink: 0; }
        .assignee-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #0d0d0d; border: 1px solid #1e1e1e; border-radius: 12px; z-index: 100; overflow: hidden; box-shadow: 0 12px 32px rgba(0,0,0,0.6); }
        .assignee-option { display: flex; align-items: center; gap: 12px; padding: 11px 14px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid #111; }
        .assignee-option:last-child { border-bottom: none; }
        .assignee-option:hover { background: #141414; }
        .opt-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg,#ff9000,#ffb347); color: #000; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900; flex-shrink: 0; }
        .opt-info { display: flex; flex-direction: column; }
        .opt-name { font-size: 0.85rem; font-weight: 700; color: #ddd; }
        .opt-pos { font-size: 0.65rem; color: #444; text-transform: uppercase; }
        .no-results { padding: 14px; text-align: center; color: #333; font-size: 0.8rem; }

        /* Checklist builder in create form */
        .cl-builder { display: flex; flex-direction: column; gap: 6px; }
        .cl-build-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #0a0a0a; border: 1px solid #141414; border-radius: 8px; font-size: 0.82rem; color: #bbb; }
        .cl-build-item.done span { text-decoration: line-through; color: #444; }
        .cl-build-item button { background: none; border: none; color: #333; cursor: pointer; padding: 2px; display: flex; align-items: center; margin-left: auto; }
        .cl-build-item button:hover { color: #ef4444; }
        .cl-build-item > button:first-child { margin-left: 0; flex-shrink: 0; }

        /* Footer */
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 28px; border-top: 1px solid #111; background: #060606; }
        .btn-ghost { background: transparent; border: 1px solid #1e1e1e; color: #555; padding: 9px 20px; border-radius: 9px; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .btn-ghost:hover { background: #111; color: #888; }
        .btn-primary-orange { display: flex; align-items: center; gap: 7px; background: #ff9000; color: #000; border: none; padding: 9px 22px; border-radius: 9px; font-weight: 900; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .btn-primary-orange:hover:not(:disabled) { background: #ffaa33; box-shadow: 0 4px 12px rgba(255,144,0,0.3); }
        .btn-primary-orange:disabled { background: #7a4400; color: #3a2000; cursor: not-allowed; opacity: 0.7; }
        .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(0,0,0,0.3); border-top-color: #000; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── RESPONSIVE ── */
        @media (max-width: 1100px) {
          .kb-nav { padding: 0 20px; flex-wrap: wrap; height: auto; gap: 10px; padding-top: 12px; padding-bottom: 12px; }
          .kb-nav-right { flex-wrap: wrap; gap: 8px; }
          .projects-nav-btn { min-width: auto; }
          .projects-nav-copy small { display: none; }
          .kb-stats { grid-template-columns: repeat(2, 1fr); padding: 12px 20px; }
          .kb-board { padding: 16px 20px; }
        }
        @media (max-width: 768px) {
          .kb-root {
            height: auto !important;
            min-height: calc(100vh - 56px) !important;
            overflow: visible !important;
          }
          .kb-nav {
            padding: 10px 12px !important;
            gap: 8px !important;
          }
          .kb-brand-text {
            display: none !important;
          }
          .kb-body-container {
            display: block !important;
            height: auto !important;
            overflow: visible !important;
          }
          .kb-sidebar {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: 100% !important;
            z-index: 999999 !important;
            border-left: none !important;
            transform: translateX(100%) !important;
            transition: transform 0.3s ease !important;
            overflow-y: auto !important;
            padding: 24px 20px !important;
            background: #030303 !important;
          }
          .kb-sidebar.open {
            transform: translateX(0) !important;
          }
          .kb-sidebar-toggle-tab {
            left: -36px !important;
            top: 250px !important;
            width: 36px !important;
            height: 120px !important;
            border-radius: 10px 0 0 10px !important;
            box-shadow: -6px 0 15px rgba(0,0,0,0.8) !important;
            z-index: 1000000 !important;
          }
          /* Compact Statistics Block for mobile */
          .kb-stats {
            grid-template-columns: repeat(4, 1fr) !important;
            padding: 8px 10px !important;
            gap: 6px !important;
          }
          .stat-tile {
            padding: 6px 8px !important;
            gap: 6px !important;
            border-radius: 8px !important;
          }
          .st-icon {
            width: 20px !important;
            height: 20px !important;
            border-radius: 5px !important;
          }
          .st-icon svg {
            width: 11px !important;
            height: 11px !important;
          }
          .st-num {
            font-size: 0.9rem !important;
          }
          .st-label {
            font-size: 0.5rem !important;
            margin-top: 0px !important;
          }
          .kb-mobile-tabs { display: flex; background: #060606; border-bottom: 1px solid #111; overflow-x: auto; padding: 6px 12px; gap: 6px; flex-shrink: 0; }
          .mob-tab { display: flex; align-items: center; gap: 6px; background: transparent; border: none; border-bottom: 2px solid transparent; padding: 8px 12px; color: #444; font-weight: 800; font-size: 0.7rem; cursor: pointer; white-space: nowrap; transition: all 0.2s; letter-spacing: 0.5px; }
          .mob-tab.active { color: #fff; border-bottom-color: var(--cc); }
          .mob-tab-cnt { font-size: 0.65rem; font-weight: 900; padding: 2px 6px; border-radius: 5px; }
          .kb-board { display: block !important; height: auto !important; padding: 16px !important; }
          .kb-col { display: none !important; width: 100% !important; height: auto !important; margin-bottom: 20px; }
          .kb-col.mob-active { display: block !important; }
          .col-body { display: block !important; height: auto !important; }
          .detail-body { display: block !important; overflow-y: auto !important; height: auto !important; max-height: calc(95vh - 60px); }
          .detail-side { border-right: none; border-bottom: 1px solid #111; overflow: visible !important; height: auto !important; }
          .detail-main { overflow: visible !important; height: auto !important; }
          .detail-modal { max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; }
          
          /* Checklist Mobile Improvements */
          .checklist-item {
            flex-wrap: wrap !important;
            gap: 6px 10px !important;
            align-items: flex-start !important;
          }
          .checklist-item .check-text {
            flex: 1;
            min-width: 180px;
          }
          .checklist-item > div {
            width: 100% !important;
            margin-left: 0 !important;
            padding-left: 26px !important;
            justify-content: flex-start !important;
            gap: 12px !important;
            flex-wrap: wrap;
          }
          .checklist-item > div input[type="date"] {
            width: 110px !important;
          }
          .checklist-item > div input[type="time"] {
            width: 70px !important;
          }
          .kb-filters { overflow-x: auto; }
          .kf-btn { font-size: 0.6rem; padding: 5px 10px; }
        }
      `}} />
)
