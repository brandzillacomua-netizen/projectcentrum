import React from 'react'
import { Camera, Plus, X } from 'lucide-react'
import { MACHINE_TYPES } from '../hooks/useMachinesData.js'

export function MachinesHeaderBar({ setIsScanning, showAdd, setShowAdd, setForm }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
      <div>
        <h2 style={{ fontSize: '2rem', fontWeight: 1000, margin: 0, letterSpacing: '-1px' }}>МОНІТОР ВЕРСТАТІВ</h2>
        <p style={{ color: '#444', fontWeight: 700, margin: '5px 0 0' }}>Контроль завантаженості та технічні дані</p>
      </div>
      <div style={{ display: 'flex', gap: '15px' }}>
        <button 
          onClick={() => setIsScanning(true)}
          style={{ 
            background: 'rgba(255, 144, 0, 0.1)', 
            color: '#ff9000', 
            border: '1px solid rgba(255, 144, 0, 0.3)', padding: '14px 30px', borderRadius: '14px', 
            fontWeight: 950, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
            transition: '0.2s'
          }}
        >
          <Camera size={20} />
          СКАНУВАТИ QR
        </button>
        <button 
          onClick={() => { setShowAdd(!showAdd); if(!showAdd) setForm({id:null, name:'', type: MACHINE_TYPES[0], capacity:'1', sequence_number:'', inventory_no:'', floor:'', description:'', status:'idle'}) }}
          style={{ 
            background: showAdd ? '#1a1a1a' : '#ff9000', 
            color: showAdd ? '#fff' : '#000', 
            border: 'none', padding: '14px 30px', borderRadius: '14px', 
            fontWeight: 950, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: showAdd ? 'none' : '0 10px 30px rgba(255,144,0,0.2)',
            transition: '0.2s'
          }}
        >
          {showAdd ? <X size={20} /> : <Plus size={20} />}
          {showAdd ? 'СКАСУВАТИ' : 'НОВИЙ ВЕРСТАТ'}
        </button>
      </div>
    </div>
  )
}
