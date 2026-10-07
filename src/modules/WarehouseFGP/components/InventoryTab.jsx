import React, { useState, useEffect } from 'react'
import { Pencil, Eye, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { supabase } from '../../../supabase'
import { useStore } from '../../../store/index.js'
import { filterSgpReceiptRegistry } from '../utils/sgpReceiptRegistry.js'
import { StockCardsAnalysisModal } from './StockCardsAnalysisModal'

export function InventoryTab({
  t,
  isDark,
  activeTab,
  filteredItems,
  receiptRows,
  isReceiptRegistryLoading,
  searchQuery,
  isAdmin,
  setReserveAnalysisItem,
  fetchData,
  refreshTable
}) {
  const nomenclatures = useStore(state => state.nomenclatures) || []
  const [editingInvKey, setEditingInvKey] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [isSavingInv, setIsSavingInv] = useState(false)

  const [stockAnalysisItem, setStockAnalysisItem] = useState(null)
  const [registryPage, setRegistryPage] = useState(1)
  const [registryPageSize, setRegistryPageSize] = useState(50)

  useEffect(() => {
    setRegistryPage(1)
  }, [searchQuery])

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
      setIsSavingInv(false)
    }
  }

  const handleDeleteInventoryItem = async (item) => {
    if (!isAdmin) return
    if (!window.confirm(`Ви впевнені, що хочете ВИДАЛИТИ позицію "${item.name}"? Цю дію неможливо скасувати.`)) return
    
    try {
      const idsToDelete = item.rawItems ? item.rawItems.map(r => r.id).filter(Boolean) : [item.id || item.key]
      if (idsToDelete.length === 0) return

      const { error } = await supabase.from('inventory').delete().in('id', idsToDelete)
      if (error) throw error

      if (typeof refreshTable === 'function') refreshTable('inventory')
      if (typeof fetchData === 'function') fetchData(['inventory'])
    } catch (err) {
      alert(`Помилка видалення: ${err.message}`)
    }
  }

  if (activeTab === 'registry') {
    const visibleReceipts = filterSgpReceiptRegistry(receiptRows, searchQuery)
    const totalItems = visibleReceipts.length
    const effectiveSize = registryPageSize === 'all' ? (totalItems || 1) : Number(registryPageSize)
    const totalPages = Math.max(1, Math.ceil(totalItems / effectiveSize))
    const safePage = Math.min(registryPage, totalPages)
    const startIndex = (safePage - 1) * effectiveSize
    const endIndex = registryPageSize === 'all' ? totalItems : Math.min(startIndex + effectiveSize, totalItems)
    const displayedReceipts = registryPageSize === 'all' ? visibleReceipts : visibleReceipts.slice(startIndex, endIndex)

    const navBtnStyle = (disabled) => ({
      background: disabled ? (isDark ? '#1e2433' : '#f1f5f9') : (isDark ? '#1e293b' : '#ffffff'),
      border: `1.5px solid ${t.tableBorder}`,
      borderRadius: '8px',
      padding: '5px 10px',
      fontSize: '0.8rem',
      fontWeight: 800,
      color: disabled ? t.textMuted : t.textPrimary,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      transition: 'all 0.15s ease'
    })

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ overflowX: 'auto', borderRadius: '14px', border: `1.5px solid ${t.tableBorder}` }}>
          <table style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, textAlign: 'left', color: t.textSecondary, fontSize: '0.74rem' }}>
                <th style={{ padding: '14px' }}>ДАТА / ЧАС</th>
                <th style={{ padding: '14px' }}>ДЕТАЛЬ</th>
                <th style={{ padding: '14px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                <th style={{ padding: '14px' }}>ЗВІДКИ НАДІЙШЛО</th>
                <th style={{ padding: '14px' }}>НАРЯД</th>
                <th style={{ padding: '14px' }}>КАРТКА</th>
                <th style={{ padding: '14px' }}>ОПЕРАТОР</th>
              </tr>
            </thead>
            <tbody>
              {displayedReceipts.map(receipt => (
                <tr key={receipt.id} style={{ borderBottom: `1px solid ${t.tableRowBorder}`, fontSize: '0.85rem' }}>
                  <td style={{ padding: '14px', color: t.textSecondary, whiteSpace: 'nowrap' }}>
                    {receipt.timestamp ? new Date(receipt.timestamp).toLocaleString('uk-UA') : '—'}
                  </td>
                  <td style={{ padding: '14px', color: t.textPrimary }}>
                    <div style={{ fontWeight: 850 }}>{receipt.detailName}</div>
                    {receipt.detailCode && <div style={{ marginTop: '3px', color: t.textMuted, fontSize: '0.72rem' }}>{receipt.detailCode}</div>}
                  </td>
                  <td style={{ padding: '14px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '10px', background: isDark ? 'rgba(16,185,129,0.14)' : '#ecfdf5', border: `1px solid ${isDark ? 'rgba(52,211,153,0.3)' : '#a7f3d0'}`, color: isDark ? '#34d399' : '#047857', fontWeight: 950 }}>
                      {receipt.quantity.toLocaleString('uk-UA')} шт
                    </span>
                  </td>
                  <td style={{ padding: '14px', color: t.textPrimary, fontWeight: 750 }}>{receipt.source}</td>
                  <td style={{ padding: '14px', color: t.textPrimary, fontWeight: 850, whiteSpace: 'nowrap' }}>
                    {receipt.orderNumber ? `№${receipt.orderNumber}${receipt.batchIndex ? `/${receipt.batchIndex}` : ''}` : '—'}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 900, color: isDark ? '#34d399' : '#059669', whiteSpace: 'nowrap' }}>
                    #{String(receipt.cardId || receipt.id).slice(-8).toUpperCase()}
                  </td>
                  <td style={{ padding: '14px', color: t.textSecondary }}>{receipt.operatorName}</td>
                </tr>
              ))}
              {displayedReceipts.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
                  {isReceiptRegistryLoading ? 'Завантаження надходжень на СГП…' : searchQuery ? 'За цим запитом надходжень не знайдено' : 'Надходжень на СГП поки немає'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── REGISTRY PAGINATION CONTROLS ── */}
        <div style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
          background: t.tableHeadBg,
          border: `1.5px solid ${t.tableBorder}`,
          borderRadius: '14px'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 800, color: t.textSecondary }}>
            {totalItems > 0 ? (
              <>
                Показано <strong style={{ color: t.textPrimary }}>{startIndex + 1}–{endIndex}</strong> з <strong style={{ color: isDark ? '#34d399' : '#059669' }}>{totalItems.toLocaleString('uk-UA')}</strong> надходжень
              </>
            ) : (
              'Записи відсутні'
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 800, color: t.textSecondary }}>
              <span>На сторінці:</span>
              <select
                value={registryPageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value)
                  setRegistryPageSize(val)
                  setRegistryPage(1)
                }}
                style={{
                  background: t.inputBg,
                  border: `1.5px solid ${t.tableBorder}`,
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  color: t.inputText,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value="all">Усі ({totalItems})</option>
              </select>
            </div>

            {registryPageSize !== 'all' && totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setRegistryPage(1)}
                  disabled={safePage === 1}
                  style={navBtnStyle(safePage === 1)}
                  title="Перша сторінка"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setRegistryPage(prev => Math.max(1, prev - 1))}
                  disabled={safePage === 1}
                  style={navBtnStyle(safePage === 1)}
                  title="Попередня сторінка"
                >
                  <ChevronLeft size={16} /> Назад
                </button>

                <span style={{ fontSize: '0.84rem', fontWeight: 900, padding: '0 8px', color: t.textPrimary }}>
                  {safePage} / {totalPages}
                </span>

                <button
                  onClick={() => setRegistryPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={safePage === totalPages}
                  style={navBtnStyle(safePage === totalPages)}
                  title="Наступна сторінка"
                >
                  Вперед <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setRegistryPage(totalPages)}
                  disabled={safePage === totalPages}
                  style={navBtnStyle(safePage === totalPages)}
                  title="Остання сторінка"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: t.tableHeadBg, borderBottom: `1.5px solid ${t.tableBorder}`, textAlign: 'left', color: t.textSecondary, fontSize: '0.74rem' }}>
          <th style={{ padding: '14px 16px' }}>НАЙМЕНУВАННЯ ВИРОБУ</th>
          <th style={{ padding: '14px 16px', width: '120px' }}>АРТИКУЛ</th>
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
        {filteredItems.map(item => {
          const linkedNom = item.nomenclature_id && nomenclatures.find(n =>
            String(n.id) === String(item.nomenclature_id) ||
            (n.legacy_ids || []).some(id => String(id) === String(item.nomenclature_id))
          )
          const itemCode = linkedNom?.code || '—'

          return (
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
            <td style={{ padding: '14px 16px', color: t.textSecondary, fontWeight: 600, fontSize: '0.85rem' }}>
              {itemCode}
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
                <button
                  type="button"
                  onClick={() => setStockAnalysisItem(item)}
                  title="Натисніть для перегляду карток випуску, що наповнили цей залишок"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '12px',
                    background: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5',
                    border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0'}`,
                    color: isDark ? '#34d399' : '#047857',
                    fontWeight: 950,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none',
                    boxShadow: isDark ? '0 2px 8px rgba(16, 185, 129, 0.12)' : '0 1px 3px rgba(4, 120, 87, 0.08)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.borderColor = isDark ? '#34d399' : '#059669'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.borderColor = isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0'
                    e.currentTarget.style.boxShadow = isDark ? '0 2px 8px rgba(16, 185, 129, 0.12)' : '0 1px 3px rgba(4, 120, 87, 0.08)'
                  }}
                >
                  <span>{Number(item.total_qty || 0).toLocaleString('uk-UA')}</span>
                  <small style={{ color: isDark ? '#a7f3d0' : '#065f46', opacity: 0.8, fontWeight: 700, fontSize: '0.72rem' }}>{item.unit}</small>
                  <Eye size={13} style={{ opacity: 0.85, marginLeft: '2px' }} />
                </button>
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
              ) : isAdmin ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteInventoryItem(item)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#ef4444', 
                      cursor: 'pointer', 
                      padding: '6px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'none'
                    }}
                    title="Видалити позицію"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <span style={{ color: t.textMuted, fontSize: '0.75rem' }}>—</span>
              )}
              </td>
            </tr>
          );
        })}

        {filteredItems.length === 0 && (
          <tr>
            <td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: t.textMuted, fontSize: '0.88rem' }}>
              На складі готової продукції немає записів за даним фільтром
            </td>
          </tr>
        )}
      </tbody>
    </table>

    <StockCardsAnalysisModal
      item={stockAnalysisItem}
      receiptRows={receiptRows}
      nomenclatures={nomenclatures}
      onClose={() => setStockAnalysisItem(null)}
    />
    </>
  )
}
