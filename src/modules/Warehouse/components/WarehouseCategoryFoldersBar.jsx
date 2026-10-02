import React from 'react'

export const WarehouseCategoryFoldersBar = ({
  activeTab,
  setActiveTab,
  setSearchParams,
  inventory
}) => {
  if (!['raw', 'sheets', 'cutters'].includes(activeTab)) return null

  const isHw = i => (i.type === 'hardware' || i.type === 'fastener' || i.type === 'mount' ||
    (i.name || '').toLowerCase().includes('гвинт') || (i.name || '').toLowerCase().includes('гайка') ||
    (i.name || '').toLowerCase().includes('болт') || (i.name || '').toLowerCase().includes('шайба') ||
    (i.name || '').toLowerCase().includes('стійка') || (i.name || '').toLowerCase().includes('накладка') ||
    (i.name || '').toLowerCase().includes('тримач') || (i.name || '').toLowerCase().includes('метиз') ||
    (i.name || '').toLowerCase().includes('кріплення'))

  const isGenericCutterType = i => /^фреза\s+ф\d+/i.test((i.name || '').trim())
  const isCutter = i => !isGenericCutterType(i) && ((i.name || '').toLowerCase().includes('фреза') || i.type === 'consumable' || i.type === 'cutter')
  const isSheet = i => (i.name || '').toLowerCase().includes('лист') && !(i.name || '').toLowerCase().includes('гума') && !(i.name || '').toLowerCase().includes('накладка')

  const baseOpInv = (inventory || []).filter(i => (i.warehouse === 'operational' || !i.warehouse) && i.warehouse !== 'sgp' && i.warehouse !== 'fgp' && !isHw(i) && !isGenericCutterType(i))

  const rawCount = baseOpInv.filter(i => Number(i.total_qty) > 0 || isSheet(i) || isCutter(i)).length
  const sheetsCount = baseOpInv.filter(i => isSheet(i)).length
  const cuttersCount = baseOpInv.filter(i => isCutter(i)).length

  const folders = [
    { id: 'raw', label: '📁 Всі позиції СО', count: rawCount, color: '#ff9000' },
    { id: 'sheets', label: '📄 Папка «Листи»', count: sheetsCount, color: '#38bdf8' },
    { id: 'cutters', label: '✂️ Папка «Фрези»', count: cuttersCount, color: '#10b981' }
  ]

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', flexWrap: 'wrap', alignItems: 'center', background: '#0a0a0a', padding: '10px 14px', borderRadius: '16px', border: '1px solid #1f1f1f' }}>
      <span style={{ fontSize: '.72rem', color: '#666', fontWeight: 850, marginRight: '4px' }}>Папки склада:</span>
      {folders.map(folder => (
        <button
          key={folder.id}
          type="button"
          className={`folder-tab-btn ${activeTab === folder.id ? 'active' : ''}`}
          onClick={() => {
            setActiveTab(folder.id)
            setSearchParams({ tab: folder.id })
          }}
          style={{
            background: activeTab === folder.id ? folder.color : '#141414',
            color: activeTab === folder.id ? '#000' : '#ccc',
            border: activeTab === folder.id ? `1px solid ${folder.color}` : '1px solid #282828',
            padding: '8px 14px',
            borderRadius: '11px',
            fontSize: '.78rem',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
        >
          <span>{folder.label}</span>
          <span style={{
            background: activeTab === folder.id ? 'rgba(0,0,0,0.2)' : '#222',
            color: activeTab === folder.id ? '#000' : folder.color,
            fontSize: '.7rem',
            padding: '2px 7px',
            borderRadius: '99px',
            fontWeight: 1000
          }}>
            {folder.count}
          </span>
        </button>
      ))}
    </div>
  )
}
