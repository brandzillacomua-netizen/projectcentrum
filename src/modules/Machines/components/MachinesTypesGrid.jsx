import React from 'react'
import { Layers } from 'lucide-react'
import { MACHINE_TYPES } from '../hooks/useMachinesData.js'

export function MachinesTypesGrid({ machines, setSelectedType, activeWorkForMachine }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '25px' }}>
      {MACHINE_TYPES.concat(['Інші']).map(type => {
        const typeMachines = machines.filter(m => type === 'Інші' ? !MACHINE_TYPES.includes(m.type) : m.type === type)
        if (typeMachines.length === 0 && type === 'Інші') return null

        const total = typeMachines.length
        const repair = typeMachines.filter(m => m.status === 'repair').length
        const busy = typeMachines.filter(m => m.status !== 'repair' && activeWorkForMachine(m)).length
        const idle = total - busy - repair

        return (
          <div key={type} className="machine-card-v3" onClick={() => setSelectedType(type)} style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: '200px' }}>
            <div style={{ background: '#111', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9000', marginBottom: '15px' }}>
              <Layers size={32} />
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.4rem', fontWeight: 900 }}>{type}</h3>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexWrap: 'wrap' }}>
              <span style={{ color: '#71717a' }}>Всього: {total}</span>
              <span style={{ color: '#10b981' }}>Вільні: {idle}</span>
              <span style={{ color: '#ef4444' }}>У роботі: {busy}</span>
              <span style={{ color: '#eab308' }}>В ремонті: {repair}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
