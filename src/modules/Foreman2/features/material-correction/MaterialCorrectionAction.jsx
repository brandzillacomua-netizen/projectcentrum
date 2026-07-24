import React from 'react'

export default function MaterialCorrectionAction({ correction, task, part, snapshot, productionCards, material, sheets, plan }) {
  if (!correction?.canCorrect || Number(plan) <= 0) return null

  return (
    <button
      type="button"
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        correction.open(task, {
          nomId: part?.id,
          name: part?.name,
          material,
          plannedSheets: sheets,
          plan,
          productionCards,
          snapshot
        })
      }}
      style={{ marginTop: '5px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.35)', color: '#f59e0b', padding: '4px 7px', borderRadius: '6px', fontSize: '.58rem', fontWeight: 950, cursor: 'pointer', textTransform: 'uppercase' }}
      title="Виправити помилково вибраний матеріал без видалення наряду"
    >
      ✎ Виправити
    </button>
  )
}
