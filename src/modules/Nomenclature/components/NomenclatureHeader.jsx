import React from 'react'
import { ArrowLeft, Layers, FolderPlus, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

export const NomenclatureHeader = ({ onOpenCreateGroup, onOpenWizard }) => {
  return (
    <header className="nom-v2-header" style={{ height: '70px', background: 'var(--card-bg, #ffffff)', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', sticky: 'top', zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/" className="nom-v2-back-link" style={{ color: 'var(--text-muted, #64748b)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
          <ArrowLeft size={18} /> Назад
        </Link>
        <div style={{ height: '24px', width: '1px', background: 'var(--border-color, #e2e8f0)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,144,0,0.15)', border: '1px solid rgba(255,144,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9000' }}>
            <Layers size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, letterSpacing: '0.5px', color: 'var(--text, #0f172a)' }}>Номенклатура ERP v2.0</h1>
            <span style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 800 }}>Окремий стандарт каталогу</span>
          </div>
        </div>
      </div>

      {/* Global Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={onOpenCreateGroup}
          className="btn-v2-secondary"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '10px 18px', 
            borderRadius: '12px', 
            fontSize: '0.82rem', 
            fontWeight: 800, 
            cursor: 'pointer',
            background: 'var(--card-header-bg, #f1f5f9)',
            color: 'var(--text, #0f172a)',
            border: '1px solid var(--border-color, #cbd5e1)',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
        >
          <FolderPlus size={16} /> СТВОРИТИ ГРУПУ
        </button>

        <button 
          onClick={onOpenWizard}
          className="btn-v2-primary"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '10px 22px', 
            borderRadius: '12px', 
            fontSize: '0.85rem', 
            fontWeight: 900, 
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #ff9000 0%, #ea580c 100%)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 15px rgba(234, 88, 12, 0.35)',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
        >
          <Plus size={18} /> СТВОРИТИ ПОЗИЦІЮ
        </button>
      </div>
    </header>
  )
}
