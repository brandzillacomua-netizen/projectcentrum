import React from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, 
  ShieldCheck, 
  Users as UsersIcon, 
  Building2, 
  Cpu, 
  Sliders 
} from 'lucide-react'
import { useSettingsState } from './Settings/hooks/useSettingsState'
import { SettingsUsersTab } from './Settings/components/SettingsUsersTab'
import { SettingsStructureTab } from './Settings/components/SettingsStructureTab'
import { SettingsSystemAdminTab } from './Settings/components/SettingsSystemAdminTab'
import { SettingsSnapshotCorrTab } from './Settings/components/SettingsSnapshotCorrTab'

const SettingsModule = () => {
  const state = useSettingsState()
  const {
    currentUser,
    logout,
    activeTab,
    setActiveTab,
    isAdmin
  } = state

  return (
    <div className="settings-module-v2" style={{ background: '#070708', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: '0 24px', 
        height: '72px', 
        background: 'rgba(10,10,12,0.85)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, transition: '0.2s' }} className="nav-back-link">
            <ArrowLeft size={16} /> <span className="hide-mobile">На головну</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255,144,0,0.1)', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center' }}>
              <ShieldCheck size={20} color="#ff9000" />
            </div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0 }}>Адмін-Панель MES</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }} className="hide-mobile">
            <div className="nav-user-name" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f3f4f6' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{currentUser?.position}</div>
          </div>
          <button onClick={logout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px 18px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }} className="logout-btn">ВИЙТИ</button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="module-content" style={{ padding: '24px', overflowY: 'auto', flex: 1, maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
        
        {/* Navigation Tabs */}
        <div className="settings-tabs" style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px', borderRadius: '18px', marginBottom: '30px', gap: '4px' }}>
           {isAdmin && (
             <button onClick={() => setActiveTab('users')} className={`tab-btn-v2 ${activeTab === 'users' ? 'active' : ''}`}>
               <UsersIcon size={16} /> КОРИСТУВАЧІ & ДОСЬЄ
             </button>
           )}
           {isAdmin && (
             <button onClick={() => setActiveTab('structure')} className={`tab-btn-v2 ${activeTab === 'structure' ? 'active' : ''}`}>
               <Building2 size={16} /> СТРУКТУРА КОМПАНІЇ
             </button>
           )}
           {isAdmin && (
             <button onClick={() => setActiveTab('system')} className={`tab-btn-v2 ${activeTab === 'system' ? 'active' : ''}`}>
               <Cpu size={16} /> СИСТЕМНІ НАЛАШТУВАННЯ
             </button>
           )}
           {isAdmin && (
             <button onClick={() => setActiveTab('corrections')} className={`tab-btn-v2 ${activeTab === 'corrections' ? 'active' : ''}`}>
               <Sliders size={16} /> КОРЕКЦІЯ СНАПШОТІВ
             </button>
           )}
        </div>

        {/* ── TAB 1: USERS & DOSSIER ── */}
        {activeTab === 'users' && isAdmin && (
          <SettingsUsersTab {...state} />
        )}

        {/* ── TAB 2: COMPANY STRUCTURE ── */}
        {activeTab === 'structure' && isAdmin && (
          <SettingsStructureTab {...state} />
        )}

        {/* ── TAB 3: SYSTEM CONFIG ── */}
        {activeTab === 'system' && isAdmin && (
          <SettingsSystemAdminTab {...state} />
        )}

        {/* ── TAB 4: SNAPSHOT CORRECTIONS ── */}
        {activeTab === 'corrections' && isAdmin && (
          <SettingsSnapshotCorrTab {...state} />
        )}
      </div>

      <style>{`
        .tab-btn-v2 {
          background: transparent;
          border: none;
          color: #888;
          padding: 10px 18px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 0.78rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tab-btn-v2:hover {
          color: #fff;
          background: rgba(255,255,255,0.03);
        }

        .tab-btn-v2.active {
          background: #ff9000;
          color: #000;
          box-shadow: 0 4px 15px rgba(255,144,0,0.25);
        }
        
        .dossier-card:hover {
          border-color: rgba(255,144,0,0.4) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
        }
        
        .permission-item:hover {
          border-color: rgba(255,144,0,0.4) !important;
        }

        .structure-node-card:hover {
          border-color: rgba(255,144,0,0.3) !important;
          background: #121216 !important;
        }

        .edit-node-btn:hover {
          color: #ff9000 !important;
        }

        .delete-node-btn:hover {
          color: #ef4444 !important;
        }

        .card-action-btn:hover {
          background: rgba(255,255,255,0.08) !important;
          color: #fff !important;
        }
        
        .primary-btn:hover {
          box-shadow: 0 6px 20px rgba(255,144,0,0.4) !important;
          transform: translateY(-1px);
        }
        
        .logout-btn:hover {
          background: rgba(239,68,68,0.2) !important;
        }
        
        .nav-back-link:hover {
          color: #fff !important;
        }
        
        .custom-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #ff9000;
          border-radius: 4px;
        }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 900px) {
          .settings-module-v2 {
            min-height: 100dvh !important;
            overflow-x: hidden !important;
          }

          .settings-module-v2 .module-nav {
            height: auto !important;
            min-height: 64px !important;
            padding: 10px 12px !important;
            gap: 10px !important;
            align-items: center !important;
          }

          .settings-module-v2 .module-nav h1 {
            font-size: 0.86rem !important;
            line-height: 1.15 !important;
            max-width: 46vw !important;
            white-space: normal !important;
          }

          .settings-module-v2 .module-nav > div {
            gap: 10px !important;
            min-width: 0 !important;
          }

          .settings-module-v2 .module-content {
            width: 100% !important;
            max-width: none !important;
            padding: 12px !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }

          .settings-module-v2 .settings-tabs {
            display: flex !important;
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            margin-bottom: 16px !important;
            border-radius: 14px !important;
            padding: 5px !important;
            gap: 5px !important;
            scrollbar-width: none;
          }

          .settings-module-v2 .settings-tabs::-webkit-scrollbar {
            display: none;
          }

          .settings-module-v2 .tab-btn-v2 {
            flex: 0 0 auto !important;
            min-height: 42px !important;
            padding: 10px 12px !important;
            font-size: 0.68rem !important;
            border-radius: 10px !important;
            white-space: nowrap !important;
          }

          .settings-module-v2 .admin-users-layout,
          .settings-module-v2 .system-settings-layout {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }

          .settings-module-v2 .user-editor-panel {
            display: none !important;
          }

          .settings-module-v2 .user-editor-panel.mobile-open {
            display: block !important;
          }

          .settings-module-v2 .mobile-new-user-btn,
          .settings-module-v2 .mobile-user-form-close {
            display: flex !important;
          }

          .settings-module-v2 section,
          .settings-module-v2 .settings-panel,
          .settings-module-v2 .glass-panel {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
            padding: 16px !important;
            border-radius: 16px !important;
            position: static !important;
            top: auto !important;
            overflow-x: auto !important;
          }

          .settings-module-v2 form {
            gap: 14px !important;
          }

          .settings-module-v2 form > div,
          .settings-module-v2 section > div,
          .settings-module-v2 .settings-panel > div {
            min-width: 0 !important;
          }

          .settings-module-v2 form div[style*="grid-template-columns"],
          .settings-module-v2 section div[style*="grid-template-columns"],
          .settings-module-v2 .settings-panel div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }

          .settings-module-v2 div[style*="display: flex"] {
            min-width: 0 !important;
          }

          .settings-module-v2 input,
          .settings-module-v2 select,
          .settings-module-v2 textarea {
            max-width: 100% !important;
            min-height: 44px !important;
            font-size: 16px !important;
            box-sizing: border-box !important;
          }

          .settings-module-v2 button {
            min-height: 42px !important;
            touch-action: manipulation;
          }

          .settings-module-v2 .primary-btn,
          .settings-module-v2 .logout-btn {
            padding: 10px 12px !important;
            white-space: nowrap !important;
          }

          .settings-module-v2 section h3,
          .settings-module-v2 .settings-panel h3 {
            font-size: 0.92rem !important;
            line-height: 1.25 !important;
            margin-bottom: 14px !important;
            flex-wrap: wrap !important;
          }

          .settings-module-v2 section h4,
          .settings-module-v2 .settings-panel h4 {
            font-size: 0.76rem !important;
            line-height: 1.3 !important;
          }

          .settings-module-v2 p {
            font-size: 0.76rem !important;
            line-height: 1.45 !important;
          }

          .settings-module-v2 table {
            min-width: 680px !important;
          }

          .settings-module-v2 pre,
          .settings-module-v2 code {
            white-space: pre-wrap !important;
            overflow-wrap: anywhere !important;
          }

          .settings-module-v2 .dossier-card {
            transform: none !important;
          }
        }

        @media (max-width: 560px) {
          .hide-mobile { display: none !important; }

          .settings-module-v2 .module-nav {
            position: sticky !important;
            top: 0 !important;
          }

          .settings-module-v2 .module-nav h1 {
            font-size: 0.78rem !important;
            max-width: 52vw !important;
          }

          .settings-module-v2 .module-content {
            padding: 10px !important;
          }

          .settings-module-v2 .settings-tabs {
            width: calc(100vw - 20px) !important;
            max-width: calc(100vw - 20px) !important;
            margin-bottom: 12px !important;
          }

          .settings-module-v2 .tab-btn-v2 {
            min-height: 40px !important;
            padding: 9px 10px !important;
            font-size: 0.64rem !important;
            gap: 6px !important;
          }

          .settings-module-v2 section,
          .settings-module-v2 .settings-panel,
          .settings-module-v2 .glass-panel {
            padding: 14px !important;
            border-radius: 14px !important;
          }

          .settings-module-v2 .admin-users-layout,
          .settings-module-v2 .system-settings-layout {
            gap: 12px !important;
          }

          .settings-module-v2 section div[style*="justify-content: space-between"],
          .settings-module-v2 .settings-panel div[style*="justify-content: space-between"] {
            align-items: stretch !important;
            flex-wrap: wrap !important;
          }

          .settings-module-v2 section div[style*="display: flex"],
          .settings-module-v2 .settings-panel div[style*="display: flex"] {
            flex-wrap: wrap !important;
          }

          .settings-module-v2 .primary-btn {
            width: 100% !important;
          }

          .settings-module-v2 select {
            width: 100% !important;
          }

          .settings-module-v2 table {
            min-width: 620px !important;
            font-size: 0.7rem !important;
          }
        }
      `}</style>
    </div>
  )
}

export default SettingsModule
