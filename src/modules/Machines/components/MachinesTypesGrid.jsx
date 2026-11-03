import React from 'react'
import { Layers } from 'lucide-react'
import { MACHINE_TYPES } from '../hooks/useMachinesData.js'

export function MachinesTypesGrid({ machines, setSelectedType, activeWorkForMachine }) {
  return (
    <div className="machines-types-grid">
      {MACHINE_TYPES.concat(['Інші']).map(type => {
        const typeMachines = machines.filter(m => type === 'Інші' ? !MACHINE_TYPES.includes(m.type) : m.type === type)
        if (typeMachines.length === 0 && type === 'Інші') return null

        const total = typeMachines.length
        const repair = typeMachines.filter(m => m.status === 'repair').length
        const busy = typeMachines.filter(m => m.status !== 'repair' && activeWorkForMachine(m)).length
        const idle = total - busy - repair

        return (
          <div
            key={type}
            className="machine-card-v3 machine-type-card"
            onClick={() => setSelectedType(type)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedType(type) }}
          >
            <div className="type-icon-box">
              <Layers size={28} />
            </div>
            <h3 className="type-title">{type}</h3>
            <div className="type-stats-row">
              <span className="type-stat-total">Всього: {total}</span>
              <span className="type-stat-idle">Вільні: {idle}</span>
              <span className="type-stat-busy">У роботі: {busy}</span>
              <span className="type-stat-repair">В ремонті: {repair}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
