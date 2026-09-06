import React from 'react'
import { Pencil, Check, Trash2 } from 'lucide-react'
import { getItemReservedQty, getNomLabel } from '../utils/supplyHelpers'

export const SupplyStockTab = ({
  searchQuery,
  setSearchQuery,
  stockFolder,
  setStockFolder,
  filteredStock = [],
  nomenclatures = [],
  tasks = [],
  isAdmin,
  editingInvId,
  setEditingInvId,
  editingInvTotal,
  setEditingInvTotal,
  editingInvReserved,
  setEditingInvReserved,
  savingInv,
  handleSaveInventoryQty,
  handleDeleteInventoryItem,
  setReserveAnalysisItem
}) => {
  return (
    <section className="stock-col glass-panel" style={{ background: 'var(--card-bg, #111)', padding: '25px', borderRadius: '24px', border: '1px solid var(--border-color, #222)', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: 0, color: 'var(--text-color, #fff)' }}>СКЛАДСЬКІ ЗАЛИШКИ</h3>
        <div style={{ position: 'relative' }}>
          <input
            style={{ background: 'var(--card-inner-bg, #000)', border: '1px solid var(--border-color, #222)', padding: '8px 15px', borderRadius: '10px', color: 'var(--text-color, #fff)', width: '200px', outline: 'none' }}
            placeholder="Пошук..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Папки склада СВ */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--card-inner-bg, #0a0a0a)', padding: '10px 14px', borderRadius: '16px', border: '1px solid var(--border-color, #1f1f1f)' }}>
        <span style={{ fontSize: '.72rem', color: 'var(--text-muted, #666)', fontWeight: 850, marginRight: '4px' }}>Папки склада:</span>
        {[
          { id: 'all', label: '📁 Всі' },
          { id: 'raw', label: '🪵 Сировина' },
          { id: 'sheet_materials', label: '📄 Листові' },
          { id: 'hardware', label: '🔩 Метизи / Фурнітура' },
          { id: 'consumable', label: '🧪 Розхідники / Хімія' },
          { id: 'unprepared', label: '📦 Непідготовлені' },
          { id: 'prepared', label: '✅ Підготовлені' }
        ].map(f => {
          const active = stockFolder === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStockFolder(f.id)}
              style={{
                background: active ? '#ff9000' : 'transparent',
                color: active ? '#000' : 'var(--text-muted, #888)',
                border: active ? 'none' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: active ? 900 : 700,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="table-responsive-container">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color, #222)', textAlign: 'left' }}>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)' }}>НАЙМЕНУВАННЯ</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)' }}>ТИП / КАТЕГОРІЯ</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)', textAlign: 'center' }}>ЗАГАЛЬНИЙ ЗАЛИШОК</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)', textAlign: 'center' }}>В ЗАРЕЗЕРВІ / В РОБОТІ</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)', textAlign: 'center' }}>ДОСТУПНО</th>
            </tr>
          </thead>
          <tbody>
            {filteredStock.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted, #444)', fontSize: '0.85rem' }}>
                  Позицій не знайдено
                </td>
              </tr>
            ) : (
              filteredStock.map(item => {
                const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
                const reservedQty = getItemReservedQty(item, tasks)
                const totalQty = Number(item.total_qty) || 0
                const available = Math.max(0, totalQty - reservedQty)
                const isEditing = editingInvId === item.id

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color, #151515)', opacity: available === 0 && !item.is_virtual_zero_stock ? 0.6 : 1 }}>
                    <td style={{ padding: '15px', fontWeight: 700, color: 'var(--text-color, #fff)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{item.name || (nom ? getNomLabel(nom) : 'Без назви')}</span>
                        {isAdmin && !item.is_virtual_zero_stock && (
                          <div style={{ display: 'inline-flex', gap: '4px', marginLeft: '6px' }}>
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingInvId(item.id)
                                  setEditingInvTotal(String(item.total_qty || 0))
                                  setEditingInvReserved(String(item.reserved_qty || 0))
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#ff9000', cursor: 'pointer', padding: '2px' }}
                                title="Редагувати кількість (Адмін)"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteInventoryItem(item)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                              title="Видалити зі склада (Адмін)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '15px', fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>
                      {nom?.type === 'raw' ? 'Сировина' : nom?.type === 'hardware' ? 'Метизи' : nom?.type === 'consumable' ? 'Розхідник' : (nom?.type || item.material_type || '—')}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                          <input
                            type="number"
                            value={editingInvTotal}
                            onChange={e => setEditingInvTotal(e.target.value)}
                            style={{ width: '60px', background: '#000', border: '1px solid #ff9000', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px', fontSize: '0.8rem' }}
                          />
                        </div>
                      ) : (
                        <span style={{ color: totalQty > 0 ? 'var(--text-color, #fff)' : '#ef4444' }}>
                          {totalQty} {item.unit || 'шт'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 800 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                          <input
                            type="number"
                            value={editingInvReserved}
                            onChange={e => setEditingInvReserved(e.target.value)}
                            style={{ width: '60px', background: '#000', border: '1px solid #ff9000', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px', fontSize: '0.8rem' }}
                          />
                          <button
                            type="button"
                            disabled={savingInv}
                            onClick={() => handleSaveInventoryQty(item.id)}
                            style={{ background: '#10b981', color: '#000', border: 'none', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer' }}
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        reservedQty > 0 ? (
                          <span
                            onClick={() => setReserveAnalysisItem(item)}
                            style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                            title="Натисніть для детального аналізу бронювання"
                          >
                            {reservedQty} {item.unit || 'шт'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #555)', fontSize: '0.8rem' }}>0</span>
                        )
                      )}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900 }}>
                      <span style={{ color: available > 0 ? '#10b981' : '#ef4444', background: available > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '8px' }}>
                        {available} {item.unit || 'шт'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
