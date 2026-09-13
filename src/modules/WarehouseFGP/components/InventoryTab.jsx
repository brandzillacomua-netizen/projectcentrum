import React, { useState } from 'react'
import { Pencil, Eye } from 'lucide-react'
import { supabase } from '../../../supabase'

export function InventoryTab({
  t,
  isDark,
  activeTab,
  filteredItems,
  workCardHistory,
  searchQuery,
  isAdmin,
  setReserveAnalysisItem,
  fetchData,
  refreshTable
}) {
  const [editingInvKey, setEditingInvKey] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [isSavingInv, setIsSavingInv] = useState(false)

  const handleSaveInventoryQty = async (item) => {
    if (!item || isSavingInv) return
    setIsSavingInv(true)
    try {
      const primaryRaw = item.rawItems?.[0]
      if (!primaryRaw?.id) throw new Error('Запис інвентарю не знайдено')

      const newTotal = Number(editingInvTotal) || 0
      const newReserved = Number(editingInvReserved) || 0

      // Update primary inventory record
      const { error } = await supabase.from('inventory').update({
        total_qty: newTotal,
        reserved_qty: newReserved
      }).eq('id', primaryRaw.id)

      if (error) throw error

      // If duplicate records exist in the database (e.g. bz_shop2 vs bz), delete stale duplicates
      if (item.rawItems && item.rawItems.length > 1) {
        const otherIds = item.rawItems.slice(1).map(r => r.id).filter(Boolean)
        if (otherIds.length > 0) {
          await supabase.from('inventory').delete().in('id', otherIds)
        }
      }

      if (typeof refreshTable === 'function') refreshTable('inventory')
      if (typeof fetchData === 'function') fetchData(['inventory'])
      setEditingInvKey(null)
    } catch (err) {
      alert(`Помилка оновлення: ${err.message}`)
    } finally {
      setIsSavingInv(false)
    }
  }

  if (activeTab === 'registry') {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, textAlign: 'left', color: t.textSecondary, fontSize: '0.74rem' }}>
            <th style={{ padding: '14px' }}>ДАТА / ЧАС</th>
            <th style={{ padding: '14px' }}>КАРТКА</th>
            <th style={{ padding: '14px' }}>ДЕТАЛЬ</th>
            <th style={{ padding: '14px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
            <th style={{ padding: '14px' }}>ОПЕРАТОР</th>
          </tr>
        </thead>
        <tbody>
          {(workCardHistory || []).filter(h => h.status === 'completed').slice(0, 50).map(card => (
            <tr key={card.id} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, fontSize: '0.85rem' }}>
              <td style={{ padding: '14px', color: t.textSecondary }}>{card.completed_at ? new Date(card.completed_at).toLocaleString('uk-UA') : '—'}</td>
              <td style={{ padding: '14px', fontWeight: 900, color: isDark ? '#34d399' : '#059669' }}>#{String(card.card_id || card.id).slice(-8).toUpperCase()}</td>
              <td style={{ padding: '14px', fontWeight: 800, color: t.textPrimary }}>{card.nomenclature_name || card.card_info || 'Готова деталь'}</td>
              <td style={{ padding: '14px', textAlign: 'center', fontWeight: 900, color: t.textPrimary }}>{card.quantity || 1} шт</td>
              <td style={{ padding: '14px', color: t.textSecondary }}>{card.operator_name || '—'}</td>
            </tr>
          ))}
          {(workCardHistory || []).filter(h => h.status === 'completed').length === 0 && (
            <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>Записів у реєстрі випуску поки немає</td></tr>
          )}
        </tbody>
      </table>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, textAlign: 'left', color: t.textSecondary, fontSize: '0.74rem' }}>
          <th style={{ padding: '14px 16px' }}>НАЙМЕНУВАННЯ ВИРОБУ</th>
          <th style={{ padding: '14px 16px', textAlign: 'center', width: '150px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isDark ? '#34d399' : '#047857', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isDark ? '#34d399' : '#10b981' }} /> НАЯВНІСТЬ
            </span>
          </th>
          <th style={{ padding: '14px 16px', textAlign: 'center', width: '140px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isDark ? '#38bdf8' : '#0284c7', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isDark ? '#38bdf8' : '#0284c7' }} /> ВІЛЬНО
            </span>
          </th>
          <th style={{ padding: '14px 16px', textAlign: 'center', width: '140px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: isDark ? '#fbbf24' : '#b45309', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isDark ? '#fbbf24' : '#f59e0b' }} /> РЕЗЕРВ
            </span>
          </th>
          <th style={{ padding: '14px 16px', textAlign: 'right', width: '80px' }}>ДІЇ</th>
        </tr>
      </thead>
      <tbody>
        {filteredItems.map(item => (
          <tr key={item.key} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, fontSize: '0.85rem' }}>
            <td style={{ padding: '14px 16px', fontWeight: 800, color: t.textPrimary }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{item.name}</span>
                {isAdmin && editingInvKey !== item.key && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingInvKey(item.key)
                      setEditingInvTotal(String(item.total_qty || 0))
                      setEditingInvReserved(String(item.reserved_qty || 0))
                    }}
                    style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '4px' }}
                    title="Редагувати залишок"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
              {editingInvKey === item.key ? (
                <input
                  type="number"
                  value={editingInvTotal}
                  onChange={e => setEditingInvTotal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveInventoryQty(item) }}
                  style={{ width: '85px', background: t.inputBg, border: '1.5px solid #10b981', color: t.inputText, textAlign: 'center', borderRadius: '8px', padding: '6px' }}
                  autoFocus
                />
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: '4px',
                  padding: '6px 14px',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                  border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0'}`,
                  color: isDark ? '#34d399' : '#047857',
                  fontWeight: 950,
                  fontSize: '0.92rem'
                }}>
                  <span>{Number(item.total_qty || 0).toLocaleString('uk-UA')}</span>
                  <small style={{ color: isDark ? '#a7f3d0' : '#065f46', opacity: 0.8, fontWeight: 700, fontSize: '0.72rem' }}>{item.unit}</small>
                </div>
              )}
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 14px',
                borderRadius: '12px',
                background: isDark ? 'rgba(14, 165, 233, 0.12)' : '#f0f9ff',
                border: `1px solid ${isDark ? 'rgba(14, 165, 233, 0.25)' : '#bae6fd'}`,
                color: isDark ? '#38bdf8' : '#0284c7',
                fontWeight: 950,
                fontSize: '0.92rem'
              }}>
                {Math.max(0, (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0)).toLocaleString('uk-UA')}
              </div>
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
              {editingInvKey === item.key ? (
                <input
                  type="number"
                  value={editingInvReserved}
                  onChange={e => setEditingInvReserved(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveInventoryQty(item) }}
                  style={{ width: '75px', background: t.inputBg, border: '1.5px solid #d97706', color: t.inputText, textAlign: 'center', borderRadius: '8px', padding: '6px' }}
                />
              ) : item.reserved_qty > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const primaryRaw = item.rawItems?.[0] || item
                    setReserveAnalysisItem({
                      ...primaryRaw,
                      id: primaryRaw.id || item.key,
                      nomenclature_id: item.nomenclature_id || primaryRaw.nomenclature_id,
                      name: item.name,
                      total_qty: item.total_qty,
                      reserved_qty: item.reserved_qty,
                      unit: item.unit
                    })
                  }}
                  title="Натисніть для перегляду замовлень у резерві"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '12px',
                    background: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
                    border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a'}`,
                    color: isDark ? '#fbbf24' : '#b45309',
                    fontWeight: 950,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none',
                    boxShadow: isDark ? '0 2px 8px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(180, 83, 9, 0.08)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.borderColor = isDark ? '#f59e0b' : '#d97706'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.25)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.borderColor = isDark ? 'rgba(245, 158, 11, 0.4)' : '#fde68a'
                    e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(180, 83, 9, 0.08)'
                  }}
                >
                  <span>{Number(item.reserved_qty).toLocaleString('uk-UA')}</span>
                  <Eye size={13} style={{ opacity: 0.85 }} />
                </button>
              ) : (
                <span style={{ color: t.textMuted, fontSize: '0.85rem', fontWeight: 600 }}>0</span>
              )}
            </td>
            <td style={{ padding: '14px', textAlign: 'right' }}>
              {editingInvKey === item.key ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                  <button
                    onClick={() => handleSaveInventoryQty(item)}
                    disabled={isSavingInv}
                    style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
                  >
                    {isSavingInv ? '...' : 'ЗБЕРЕГТИ'}
                  </button>
                  <button
                    onClick={() => setEditingInvKey(null)}
                    style={{ background: t.buttonSecondaryBg, color: t.textSecondary, border: `1px solid ${t.buttonSecondaryBorder}`, padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span style={{ color: t.textMuted, fontSize: '0.75rem' }}>—</span>
              )}
            </td>
          </tr>
        ))}

        {filteredItems.length === 0 && (
          <tr>
            <td colSpan={5} style={{ padding: '50px', textAlign: 'center', color: t.textMuted, fontSize: '0.88rem' }}>
              На складі готової продукції немає записів за даним фільтром
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
