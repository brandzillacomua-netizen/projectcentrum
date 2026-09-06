import React from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'

const WarehouseInventoryTableRow = React.memo(({
  item,
  activeTab,
  isAdmin,
  editingInvId,
  setEditingInvId,
  editingInvTotal,
  setEditingInvTotal,
  editingInvReserved,
  setEditingInvReserved,
  savingInv,
  getItemReservedQty,
  handleSaveInventoryQty,
  handleDeleteInventoryItem,
  setReserveAnalysisItem
}) => {
  const isEditing = editingInvId === item.id
  const reservedQty = getItemReservedQty(item)
  const availableQty = isEditing
    ? (Number(editingInvTotal) || 0) - (Number(editingInvReserved) || 0)
    : Math.max(0, (item.total_qty || 0) - reservedQty)

  return (
    <tr style={{ borderBottom: '1px solid #151515' }}>
      <td className="sticky-col" style={{ padding: '15px', fontWeight: 800 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>{item.name}</span>
          {item.type?.startsWith('scrap') && (() => {
            const types = {
              'scrap': { label: 'Прийомка', color: '#555' },
              'scrap_ready': { label: 'До обробки', color: '#ef4444' },
              'scrap_cat_1': { label: 'Кат. 1', color: '#10b981' },
              'scrap_cat_2': { label: 'Кат. 2', color: '#eab308' },
              'scrap_cat_3': { label: 'Кат. 3', color: '#f97316' },
              'scrap_cat_4': { label: 'Кат. 4', color: '#ef4444' },
            }
            const t = types[item.type] || { label: item.type, color: '#333' }
            return (
              <span style={{ fontSize: '0.6rem', color: t.color, border: `1px solid ${t.color}40`, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 900 }}>
                {t.label}
              </span>
            )
          })()}
          {isAdmin && !isEditing && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingInvId(item.id)
                  setEditingInvTotal(String(item.total_qty || 0))
                  setEditingInvReserved(String(item.reserved_qty || 0))
                }}
                style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', display: 'inline-flex', padding: '4px' }}
                title="Редагувати запаси"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteInventoryItem(item)}
                style={{ background: 'transparent', border: 'none', color: '#ef4444', opacity: 0.7, cursor: 'pointer', display: 'inline-flex', padding: '4px' }}
                title="Видалити позицію зі складу"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </td>
      <td style={{ padding: '15px', textAlign: 'center', color: activeTab === 'scrap' ? '#ef4444' : '#ff9000', fontWeight: 900 }}>
        {isEditing ? (
          <input
            type="number"
            value={editingInvTotal}
            onChange={e => setEditingInvTotal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveInventoryQty(item.id) }}
            style={{ width: '80px', background: '#000', border: '1px solid #ff9000', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
          />
        ) : (
          <>{item.total_qty || 0} <small style={{ color: '#444', fontWeight: 400 }}>{item.unit}</small></>
        )}
      </td>
      <td style={{ padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: 900 }}>
        {availableQty}
      </td>
      <td style={{ padding: '15px', textAlign: 'center', color: reservedQty > 0 ? '#3b82f6' : '#222', fontWeight: 800 }}>
        {isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <input
              type="number"
              value={editingInvReserved}
              onChange={e => setEditingInvReserved(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveInventoryQty(item.id) }}
              style={{ width: '80px', background: '#000', border: '1px solid #3b82f6', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
            />
            <button
              type="button"
              onClick={() => handleSaveInventoryQty(item.id)}
              disabled={savingInv}
              style={{ background: '#10b981', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#000', fontWeight: 900, cursor: 'pointer' }}
            >
              {savingInv ? '...' : <Check size={14} />}
            </button>
            <button type="button" onClick={() => setEditingInvId(null)} style={{ background: '#222', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#fff', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        ) : (
          reservedQty > 0 ? (
            <span 
              onClick={() => setReserveAnalysisItem(item)}
              style={{ textDecoration: 'underline', cursor: 'pointer', color: '#3b82f6', fontWeight: 900 }}
              title="Аналіз резерву"
            >
              {reservedQty}
            </span>
          ) : (
            0
          )
        )}
      </td>
      <td style={{ padding: '15px', textAlign: 'right', color: '#333', fontSize: '0.7rem' }}>
        {item.updated_at ? `${new Date(item.updated_at).toLocaleDateString()} ${new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
      </td>
    </tr>
  )
})

const WarehouseInventoryMobileCard = React.memo(({
  item,
  activeTab,
  editingInvId,
  setEditingInvId,
  editingInvTotal,
  setEditingInvTotal,
  editingInvReserved,
  setEditingInvReserved,
  savingInv,
  handleSaveInventoryQty,
  setReserveAnalysisItem,
  currentUser
}) => {
  const isEditing = editingInvId === item.id

  return (
    <div style={{ background: '#111', padding: '15px', borderRadius: '16px', border: '1px solid #222', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong>{item.name}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.7rem', color: '#444' }}>{item.unit}</span>
          {currentUser?.login === 'admin@workshop.local' && !isEditing && (
            <button
              type="button"
              onClick={() => {
                setEditingInvId(item.id)
                setEditingInvTotal(String(item.total_qty || 0))
                setEditingInvReserved(String(item.reserved_qty || 0))
              }}
              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '20px', flexDirection: isEditing ? 'column' : 'row' }}>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            <div>
              <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>НАЯВНІСТЬ</label>
              <input
                type="number"
                value={editingInvTotal}
                onChange={e => setEditingInvTotal(e.target.value)}
                style={{ width: '100%', background: '#000', border: '1px solid #ff9000', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.65rem', color: '#555', display: 'block', marginBottom: '4px' }}>РЕЗЕРВ</label>
              <input
                type="number"
                value={editingInvReserved}
                onChange={e => setEditingInvReserved(e.target.value)}
                style={{ width: '100%', background: '#000', border: '1px solid #3b82f6', color: '#fff', borderRadius: '6px', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button
                type="button"
                onClick={() => handleSaveInventoryQty(item.id)}
                disabled={savingInv}
                style={{ flex: 1, background: '#10b981', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
              >
                {savingInv ? '...' : 'ЗБЕРЕГТИ'}
              </button>
              <button type="button" onClick={() => setEditingInvId(null)} style={{ flex: 1, background: '#222', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>СКАСУВАТИ</button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <div style={{ fontSize: '0.6rem', color: '#555' }}>НАЯВНІСТЬ</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ff9000' }}>{item.total_qty || 0}</div>
            </div>
            {activeTab !== 'bz' && (
              <div>
                <div style={{ fontSize: '0.6rem', color: '#555' }}>ВІЛЬНО</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{(item.total_qty || 0) - (item.reserved_qty || 0)}</div>
              </div>
            )}
            {activeTab !== 'bz' && (
              <div>
                <div style={{ fontSize: '0.6rem', color: '#555' }}>РЕЗЕРВ</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>
                  {Number(item.reserved_qty) > 0 ? (
                    <span 
                      onClick={() => setReserveAnalysisItem(item)}
                      style={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {item.reserved_qty}
                    </span>
                  ) : (
                    0
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})

export const WarehouseInventoryTable = ({
  activeTab,
  filteredInventory,
  groupedPocketInventory,
  isAdmin,
  editingInvId,
  setEditingInvId,
  editingInvTotal,
  setEditingInvTotal,
  editingInvReserved,
  setEditingInvReserved,
  savingInv,
  getItemReservedQty,
  handleSaveInventoryQty,
  handleDeleteInventoryItem,
  setReserveAnalysisItem,
  currentUser
}) => {
  if (activeTab === 'registry' || activeTab === 'boxes') return null

  return (
    <>
      <div className="table-responsive-container hide-mobile">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #222', textAlign: 'left' }}>
              <th className="sticky-col" style={{ padding: '15px', fontSize: '0.7rem', color: '#555' }}>НАЙМЕНУВАННЯ</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>НАЯВНІСТЬ</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>ВІЛЬНО</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>РЕЗЕРВ</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: '#555', textAlign: 'right' }}>ОСТАННЄ ОНОВЛЕННЯ</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#333', fontSize: '0.85rem' }}>
                  Позицій не знайдено
                </td>
              </tr>
            ) : activeTab === 'pocket' ? (
              Object.entries(groupedPocketInventory).map(([owner, items]) => (
                <React.Fragment key={owner}>
                  <tr style={{ background: 'rgba(255, 144, 0, 0.04)', borderBottom: '1px solid #222' }}>
                    <td colSpan={5} style={{ padding: '12px 15px', fontWeight: 900, color: '#ff9000', fontSize: '0.85rem', letterSpacing: '0.03em' }}>
                      👤 МАЙСТЕР: {owner.toUpperCase()}
                    </td>
                  </tr>
                  {items.map(item => (
                    <WarehouseInventoryTableRow
                      key={item.id}
                      item={item}
                      activeTab={activeTab}
                      isAdmin={isAdmin}
                      editingInvId={editingInvId}
                      setEditingInvId={setEditingInvId}
                      editingInvTotal={editingInvTotal}
                      setEditingInvTotal={setEditingInvTotal}
                      editingInvReserved={editingInvReserved}
                      setEditingInvReserved={setEditingInvReserved}
                      savingInv={savingInv}
                      getItemReservedQty={getItemReservedQty}
                      handleSaveInventoryQty={handleSaveInventoryQty}
                      handleDeleteInventoryItem={handleDeleteInventoryItem}
                      setReserveAnalysisItem={setReserveAnalysisItem}
                    />
                  ))}
                </React.Fragment>
              ))
            ) : (
              filteredInventory.map(item => (
                <WarehouseInventoryTableRow
                  key={item.id}
                  item={item}
                  activeTab={activeTab}
                  isAdmin={isAdmin}
                  editingInvId={editingInvId}
                  setEditingInvId={setEditingInvId}
                  editingInvTotal={editingInvTotal}
                  setEditingInvTotal={setEditingInvTotal}
                  editingInvReserved={editingInvReserved}
                  setEditingInvReserved={setEditingInvReserved}
                  savingInv={savingInv}
                  getItemReservedQty={getItemReservedQty}
                  handleSaveInventoryQty={handleSaveInventoryQty}
                  handleDeleteInventoryItem={handleDeleteInventoryItem}
                  setReserveAnalysisItem={setReserveAnalysisItem}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mobile-only">
        {activeTab === 'pocket' ? (
          Object.entries(groupedPocketInventory).map(([owner, items]) => (
            <div key={owner} style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 900, color: '#ff9000', fontSize: '0.85rem', marginBottom: '10px', padding: '8px 12px', background: 'rgba(255, 144, 0, 0.04)', borderRadius: '10px', letterSpacing: '0.03em' }}>
                👤 МАЙСТЕР: {owner.toUpperCase()}
              </div>
              {items.map(item => (
                <WarehouseInventoryMobileCard
                  key={item.id}
                  item={item}
                  activeTab={activeTab}
                  editingInvId={editingInvId}
                  setEditingInvId={setEditingInvId}
                  editingInvTotal={editingInvTotal}
                  setEditingInvTotal={setEditingInvTotal}
                  editingInvReserved={editingInvReserved}
                  setEditingInvReserved={setEditingInvReserved}
                  savingInv={savingInv}
                  handleSaveInventoryQty={handleSaveInventoryQty}
                  setReserveAnalysisItem={setReserveAnalysisItem}
                  currentUser={currentUser}
                />
              ))}
            </div>
          ))
        ) : (
          filteredInventory.map(item => (
            <WarehouseInventoryMobileCard
              key={item.id}
              item={item}
              activeTab={activeTab}
              editingInvId={editingInvId}
              setEditingInvId={setEditingInvId}
              editingInvTotal={editingInvTotal}
              setEditingInvTotal={setEditingInvTotal}
              editingInvReserved={editingInvReserved}
              setEditingInvReserved={setEditingInvReserved}
              savingInv={savingInv}
              handleSaveInventoryQty={handleSaveInventoryQty}
              setReserveAnalysisItem={setReserveAnalysisItem}
              currentUser={currentUser}
            />
          ))
        )}
      </div>
    </>
  )
}
