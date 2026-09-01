import React, { useState, useMemo } from 'react'
import {
  Archive,
  ArrowLeft,
  Package,
  Layers,
  AlertTriangle,
  CheckCircle2,
  History,
  Search,
  Plus,
  Trash2,
  Pencil,
  Truck,
  ExternalLink,
  ShieldCheck,
  Eye
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMES } from '../MESContext'
import { supabase } from '../supabase'
import { IconSO, IconSGP } from '../components/WarehouseIcons'

export default function WarehouseFGPModule() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    inventory,
    requests,
    nomenclatures,
    workCards,
    workCardHistory,
    currentUser,
    refreshTable,
    fetchData
  } = useMES()

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'finished')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', total_qty: '', unit: 'шт', type: 'finished' })

  // Admin edit item state
  const [editingInvId, setEditingInvId] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [isSavingInv, setIsSavingInv] = useState(false)

  const isAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.role === 'admin' || currentUser?.role === 'director' || (currentUser?.position || '').toLowerCase().includes('адмін')

  const tabs = [
    { id: 'finished', label: 'Готова продукція', icon: <Archive size={18} /> },
    { id: 'semi', label: 'Напівфабрикати', icon: <Layers size={18} /> },
    { id: 'scrap', label: 'Брак & Карантин', icon: <AlertTriangle size={18} /> },
    { id: 'bz', label: 'Буферний запас (БЗ)', icon: <CheckCircle2 size={18} /> },
    { id: 'registry', label: 'Реєстр випуску', icon: <History size={18} /> }
  ]

  // Filter inventory by SGP types
  const sgpItems = useMemo(() => {
    return (inventory || []).filter(item => {
      const type = item.type || ''
      const nameLower = (item.name || '').toLowerCase()

      if (activeTab === 'finished') {
        return type === 'finished' || type === 'part' || type === 'product' || nameLower.startsWith('іп-') || nameLower.startsWith('kr-') || nameLower.startsWith('ip-')
      }
      if (activeTab === 'semi') {
        return type === 'semi' || type === 'semi_shop2' || nameLower.includes('напівфабрикат') || nameLower.includes('заготовка')
      }
      if (activeTab === 'scrap') {
        return type === 'scrap' || nameLower.includes('брак')
      }
      if (activeTab === 'bz') {
        return type === 'bz' || type === 'bz_shop2' || nameLower.includes('бз') || nameLower.includes('буфер')
      }
      return true
    })
  }, [inventory, activeTab])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return sgpItems
    const q = searchQuery.toLowerCase().trim()
    return sgpItems.filter(item => (item.name || '').toLowerCase().includes(q))
  }, [sgpItems, searchQuery])

  // Compute tab counts
  const tabCounts = useMemo(() => {
    const counts = { finished: 0, semi: 0, scrap: 0, bz: 0, registry: 0 }
    ;(inventory || []).forEach(item => {
      const type = item.type || ''
      const nameLower = (item.name || '').toLowerCase()
      if (type === 'finished' || type === 'part' || type === 'product' || nameLower.startsWith('іп-') || nameLower.startsWith('kr-')) {
        counts.finished += Number(item.total_qty) || 0
      } else if (type === 'semi' || type === 'semi_shop2' || nameLower.includes('напівфабрикат')) {
        counts.semi += Number(item.total_qty) || 0
      } else if (type === 'scrap' || nameLower.includes('брак')) {
        counts.scrap += Number(item.total_qty) || 0
      } else if (type === 'bz' || type === 'bz_shop2' || nameLower.includes('бз')) {
        counts.bz += Number(item.total_qty) || 0
      }
    })
    counts.registry = (workCardHistory || []).filter(h => h.status === 'completed').length
    return counts
  }, [inventory, workCardHistory])

  const handleSaveInventoryQty = async (itemId) => {
    if (!itemId || isSavingInv) return
    setIsSavingInv(true)
    try {
      const { error } = await supabase.from('inventory').update({
        total_qty: Number(editingInvTotal) || 0,
        reserved_qty: Number(editingInvReserved) || 0
      }).eq('id', itemId)

      if (error) throw error
      if (typeof refreshTable === 'function') refreshTable('inventory')
      if (typeof fetchData === 'function') fetchData(['inventory'])
      setEditingInvId(null)
    } catch (err) {
      alert(`Помилка оновлення: ${err.message}`)
    } finally {
      setIsSavingInv(false)
    }
  }

  const handleAddInventoryItem = async (e) => {
    e.preventDefault()
    if (!newItem.name.trim() || !newItem.total_qty) return
    try {
      const { error } = await supabase.from('inventory').insert([{
        name: newItem.name.trim(),
        total_qty: Number(newItem.total_qty) || 0,
        reserved_qty: 0,
        unit: newItem.unit || 'шт',
        type: activeTab === 'semi' ? 'semi' : activeTab === 'scrap' ? 'scrap' : activeTab === 'bz' ? 'bz' : 'finished',
        warehouse: 'fgp'
      }])
      if (error) throw error
      if (typeof refreshTable === 'function') refreshTable('inventory')
      setNewItem({ name: '', total_qty: '', unit: 'шт', type: 'finished' })
      setShowAdd(false)
    } catch (err) {
      alert(`Помилка створення: ${err.message}`)
    }
  }

  return (
    <div className="warehouse-fgp-module" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── ХЕДЕР МОДУЛЯ ── */}
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: '15px 25px', 
        background: '#111', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        borderBottom: '1px solid #222',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> Назад
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconSGP size={22} color="#10b981" />
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, letterSpacing: '-0.02em' }}>
              СКЛАД ГОТОВОЇ ПРОДУКЦІЇ (СГП)
            </h1>
            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 900 }}>
              ERP WMS Pillar
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            to="/warehouse"
            style={{
              height: '42px',
              padding: '0 16px',
              borderRadius: '12px',
              border: '1px solid #222',
              background: '#161616',
              color: '#888',
              fontSize: '0.8rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none'
            }}
          >
            <IconSO size={18} color="#10b981" /> Склад Оперативний
          </Link>
        </div>
      </nav>

      {/* ── ОСНОВНИЙ КОНТЕНТ ── */}
      <div style={{ padding: '25px', flex: 1, overflowY: 'auto' }}>
        
        {/* Вкладки */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', overflowX: 'auto' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`warehouse-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id)
                setSearchParams({ tab: tab.id })
              }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: activeTab === tab.id ? '#10b981' : '#111',
                color: activeTab === tab.id ? '#000' : '#888',
                border: activeTab === tab.id ? '1px solid #10b981' : '1px solid #222',
                padding: '12px 20px',
                borderRadius: '14px',
                fontSize: '0.85rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: '0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tabCounts[tab.id] > 0 && (
                <span className="tab-count-badge" style={{
                  marginLeft: '6px',
                  background: activeTab === tab.id ? '#000' : '#10b981',
                  color: activeTab === tab.id ? '#10b981' : '#000',
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  fontWeight: 1000
                }}>
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Панель таблиці */}
        <div className="content-card glass-panel" style={{ padding: '25px 25px 120px', borderRadius: '24px', background: 'rgba(20,20,20,0.6)', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 950, color: '#10b981' }}>
              {tabs.find(t => t.id === activeTab)?.label.toUpperCase()}
            </h2>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                <input
                  style={{ background: '#000', border: '1px solid #222', padding: '10px 14px 10px 36px', borderRadius: '12px', color: '#fff', fontSize: '0.85rem', outline: 'none', width: '220px' }}
                  placeholder="Пошук випущених позицій..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                onClick={() => setShowAdd(!showAdd)}
                style={{ background: '#10b981', color: '#000', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={18} /> Додати позицію
              </button>
            </div>
          </div>

          {showAdd && (
            <form onSubmit={handleAddInventoryItem} style={{ display: 'flex', gap: '12px', padding: '15px', background: '#111', borderRadius: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
              <input
                style={{ flex: 2, minWidth: '220px', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '10px' }}
                placeholder="Назва готової деталi..."
                value={newItem.name}
                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                required
              />
              <input
                type="number"
                style={{ flex: 1, minWidth: '120px', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '10px' }}
                placeholder="Кількість"
                value={newItem.total_qty}
                onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })}
                required
              />
              <button type="submit" style={{ background: '#10b981', color: '#000', border: 'none', padding: '12px 25px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer' }}>
                ЗБЕРЕГТИ
              </button>
            </form>
          )}

          {activeTab === 'registry' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222', textAlign: 'left', color: '#666', fontSize: '0.7rem' }}>
                  <th style={{ padding: '15px' }}>ДАТА / ЧАС</th>
                  <th style={{ padding: '15px' }}>КАРТКА</th>
                  <th style={{ padding: '15px' }}>ДЕТАЛЬ</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>КІЛЬКІСТЬ</th>
                  <th style={{ padding: '15px' }}>ОПЕРАТОР</th>
                </tr>
              </thead>
              <tbody>
                {(workCardHistory || []).filter(h => h.status === 'completed').slice(0, 50).map(card => (
                  <tr key={card.id} style={{ borderBottom: '1px solid #141414', fontSize: '0.85rem' }}>
                    <td style={{ padding: '15px', color: '#888' }}>{card.completed_at ? new Date(card.completed_at).toLocaleString('uk-UA') : '—'}</td>
                    <td style={{ padding: '15px', fontWeight: 900, color: '#10b981' }}>#{String(card.card_id || card.id).slice(-8).toUpperCase()}</td>
                    <td style={{ padding: '15px', fontWeight: 800 }}>{card.nomenclature_name || card.card_info || 'Готова деталь'}</td>
                    <td style={{ padding: '15px', textAlign: 'center', fontWeight: 900, color: '#fff' }}>{card.quantity || 1} шт</td>
                    <td style={{ padding: '15px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                  </tr>
                ))}
                {(workCardHistory || []).filter(h => h.status === 'completed').length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#444' }}>Записів у реєстрі випуску поки немає</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222', textAlign: 'left', color: '#666', fontSize: '0.7rem' }}>
                  <th style={{ padding: '15px' }}>НАЙМЕНУВАННЯ ВИРОБУ</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>НАЯВНІСТЬ</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>ВІЛЬНО</th>
                  <th style={{ padding: '15px', textAlign: 'center' }}>РЕЗЕРВ</th>
                  <th style={{ padding: '15px', textAlign: 'right' }}>ДІЇ</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #141414', fontSize: '0.85rem' }}>
                    <td style={{ padding: '15px', fontWeight: 800 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{item.name}</span>
                        {isAdmin && editingInvId !== item.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInvId(item.id)
                              setEditingInvTotal(String(item.total_qty || 0))
                              setEditingInvReserved(String(item.reserved_qty || 0))
                            }}
                            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center', color: '#10b981', fontWeight: 900 }}>
                      {editingInvId === item.id ? (
                        <input
                          type="number"
                          value={editingInvTotal}
                          onChange={e => setEditingInvTotal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveInventoryQty(item.id) }}
                          style={{ width: '70px', background: '#000', border: '1px solid #10b981', color: '#fff', textAlign: 'center', borderRadius: '6px', padding: '4px' }}
                        />
                      ) : (
                        <>{item.total_qty || 0} <small style={{ color: '#444', fontWeight: 400 }}>{item.unit}</small></>
                      )}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center', color: '#38bdf8', fontWeight: 900 }}>
                      {Math.max(0, (item.total_qty || 0) - (item.reserved_qty || 0))}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center', color: (item.reserved_qty || 0) > 0 ? '#f59e0b' : '#333', fontWeight: 800 }}>
                      {item.reserved_qty || 0}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'right' }}>
                      {editingInvId === item.id ? (
                        <button
                          onClick={() => handleSaveInventoryQty(item.id)}
                          style={{ background: '#10b981', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
                        >
                          ЗБЕРЕГТИ
                        </button>
                      ) : (
                        <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '50px', textAlign: 'center', color: '#444', fontSize: '0.85rem' }}>
                      На складі готової продукції немає записів за даним фільтром
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
