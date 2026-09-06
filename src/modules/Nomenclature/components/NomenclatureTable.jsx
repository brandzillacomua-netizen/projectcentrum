import React from 'react'
import { Search, ChevronRight, Package, Plus, Clock, Edit2, Trash2 } from 'lucide-react'

const NomenclatureTableRow = React.memo(({
  item,
  groups,
  handleOpenEditItem,
  handleDeleteItem
}) => {
  const grp = groups.find(g => g.id === item.group_id)
  const rawMat = item.rule_params?.rawSheet || item.material_type || '—'
  const normQty = item.rule_params?.unitsPerSheet || item.units_per_sheet || null
  const cResVal = item.rule_params?.cutterResource === 'custom' ? item.rule_params?.customCutterResource : (item.rule_params?.cutterResource || item.cutter_resource || null)
  const cRes = cResVal ? `${cResVal} л/фр` : null

  return (
    <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', transition: 'background 0.2s' }} className="table-row-hover">
      <td style={{ padding: '16px 20px', fontWeight: 900, color: '#d97706', fontSize: '0.85rem', fontFamily: 'monospace' }}>
        {item.code}
      </td>
      <td style={{ padding: '16px 20px', fontWeight: 800, fontSize: '0.9rem', color: 'var(--text, #0f172a)' }}>
        <div>{item.name}</div>
        {item.rule_params?.loadTimings && Object.entries(item.rule_params.loadTimings).some(([_, v]) => v !== '' && v !== null && v !== undefined) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {Object.entries(item.rule_params.loadTimings)
              .filter(([_, v]) => v !== '' && v !== null && v !== undefined)
              .map(([k, v]) => (
                <span key={k} style={{ background: 'rgba(255, 144, 0, 0.12)', border: '1px solid rgba(255, 144, 0, 0.3)', color: '#d97706', padding: '2px 6px', borderRadius: '5px', fontSize: '0.68rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Clock size={10} /> {k}л: {v}хв
                </span>
              ))
            }
          </div>
        )}
      </td>
      <td style={{ padding: '16px 20px', color: '#0284c7', fontWeight: 700, fontSize: '0.82rem' }}>
        {rawMat}
      </td>
      <td style={{ padding: '16px 20px', color: normQty ? '#059669' : (cRes ? '#d97706' : 'var(--text-muted, #64748b)'), fontWeight: 800, fontSize: '0.85rem' }}>
        {normQty ? `${normQty} шт/л` : (cRes ? cRes : '—')}
      </td>
      <td style={{ padding: '16px 20px' }}>
        <span style={{ background: 'var(--card-header-bg, #f1f5f9)', color: 'var(--text-muted, #475569)', border: '1px solid var(--border-color, #e2e8f0)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
          {grp ? grp.name : '01. Загальна'}
        </span>
      </td>
      <td style={{ padding: '16px 20px', color: 'var(--text-muted, #64748b)', fontWeight: 700, fontSize: '0.85rem' }}>
        {item.unit || 'шт'}
      </td>
      <td style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <button 
          onClick={() => handleOpenEditItem(item)}
          style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', color: '#0284c7', cursor: 'pointer', padding: '6px 8px', marginRight: '6px', transition: 'all 0.15s' }}
          title="Редагувати номенклатуру"
        >
          <Edit2 size={15} />
        </button>
        <button 
          onClick={() => handleDeleteItem(item.id)}
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', padding: '6px 8px', transition: 'all 0.15s' }}
          title="Видалити позицію"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  )
})

export const NomenclatureTable = ({
  selectedGroup,
  groups,
  searchQuery,
  setSearchQuery,
  visibleItems,
  handleOpenWizard,
  handleOpenEditItem,
  handleDeleteItem
}) => {
  return (
    <main className="nom-v2-main" style={{ flex: 1, padding: '25px', overflowY: 'auto', background: 'var(--bg, #f0f2f7)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Info & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
            <span>Каталог</span>
            <ChevronRight size={14} />
            <span style={{ color: selectedGroup ? '#d97706' : 'var(--text, #0f172a)', fontWeight: 800 }}>
              {selectedGroup ? selectedGroup.name : 'Усі позиції'}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text, #0f172a)' }}>
            {selectedGroup ? selectedGroup.name : 'Реєстр номенклатури v2'}
          </h2>
        </div>

        {/* Search */}
        <div className="nom-v2-search" style={{ position: 'relative', width: '360px' }}>
          <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }} size={18} />
          <input 
            type="text"
            placeholder="Швидкий пошук у V2 за назвою чи кодом..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '12px', padding: '11px 15px 11px 44px', color: 'var(--text, #0f172a)', fontSize: '0.85rem', outline: 'none' }}
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="nom-v2-table-wrap" style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '20px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow, 0 4px 20px rgba(0,0,0,0.05))' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr className="nom-v2-tr-head" style={{ background: 'var(--card-header-bg, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              <th className="nom-v2-th" style={{ padding: '16px 20px', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900, width: '120px' }}>Код V2</th>
              <th className="nom-v2-th" style={{ padding: '16px 20px', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900 }}>Стандартизована Назва</th>
              <th className="nom-v2-th" style={{ padding: '16px 20px', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900, width: '160px' }}>Матеріал (Лист)</th>
              <th className="nom-v2-th" style={{ padding: '16px 20px', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900, width: '130px' }}>Норма на листі</th>
              <th className="nom-v2-th" style={{ padding: '16px 20px', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900, width: '180px' }}>Категорія / Група</th>
              <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900, width: '90px' }}>Од. вим.</th>
              <th style={{ padding: '16px 20px', fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 900, width: '100px', textAlign: 'right' }}>Дії</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <Package size={48} style={{ opacity: 0.3 }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                      {searchQuery ? 'За вашим запитом нічого не знайдено' : 'У цьому розділі V2 каталогу ще немає позицій'}
                    </span>
                    <button 
                      onClick={() => handleOpenWizard()}
                      style={{ background: 'rgba(255,144,0,0.1)', color: '#d97706', border: '1px solid rgba(255,144,0,0.3)', borderRadius: '10px', padding: '10px 18px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', marginTop: '5px' }}
                    >
                      <Plus size={16} /> Додати першу позицію за правилами ERP
                    </button>
                  </div>
                </td>
              </tr>
            ) : visibleItems.map(item => (
              <NomenclatureTableRow
                key={item.id}
                item={item}
                groups={groups}
                handleOpenEditItem={handleOpenEditItem}
                handleDeleteItem={handleDeleteItem}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

