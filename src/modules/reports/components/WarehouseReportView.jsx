import React from 'react'
import { Filter, Search, X, BarChart2 } from 'lucide-react'

export const WarehouseReportView = ({
  whFilter,
  setWhFilter,
  typeFilter,
  setTypeFilter,
  itemFilter,
  setItemFilter,
  itemSearchText,
  setItemSearchText,
  isItemDropdownOpen,
  setIsItemDropdownOpen,
  warehouseOptions,
  typeOptions,
  filteredItems,
  handleGenerateReport,
  generatedReport
}) => {
  const whNameMap = {
    operational: 'Оперативний (СО)',
    production: 'Склад Виробництва (СВ)',
    sgp: 'СГП (Склад Готової Продукції)',
    sz: 'СЗ (Склад Залишків)',
    scrap: 'СБ (Брак / Ізолятор)',
    other: 'Інше'
  }

  const typeNameMap = {
    raw: 'Сировина (Листи)',
    part: 'Деталі (Напівфабрикати)',
    product: 'Готові вироби',
    hardware: 'Метизи / Фурнітура',
    consumable: 'Витратні матеріали',
    bz: 'Буферний запас'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* BUILDER PANEL */}
      <div className="glass-panel" style={{ background: '#111', padding: '25px', borderRadius: '16px', border: '1px solid #222' }}>
        <h3 style={{ margin: '0 0 20px', color: '#ff9000', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={20} /> Конструктор звіту по складах
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '25px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Вибір складу</label>
            <select value={whFilter} onChange={e => setWhFilter(e.target.value)} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none' }}>
              <option value="all">-- Всі склади --</option>
              {warehouseOptions.map(w => <option key={w} value={w}>{whNameMap[w] || w}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Група / Тип матеріалу</label>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: '100%', background: '#0a0a0a', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px', fontSize: '0.9rem', outline: 'none' }}>
              <option value="all">-- Всі групи --</option>
              {typeOptions.map(t => <option key={t} value={t}>{typeNameMap[t] || t}</option>)}
            </select>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Конкретна деталь (Пошук)</label>
            <div
              onClick={() => setIsItemDropdownOpen(true)}
              style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '11px 12px', display: 'flex', alignItems: 'center', cursor: 'text' }}
            >
              <Search size={16} color="#555" style={{ marginRight: '8px' }} />
              <input
                type="text"
                placeholder="Введіть назву або код..."
                value={itemSearchText}
                onChange={e => {
                  setItemSearchText(e.target.value)
                  setIsItemDropdownOpen(true)
                  if (itemFilter !== 'all') setItemFilter('all')
                }}
                onFocus={() => setIsItemDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsItemDropdownOpen(false), 200)}
                style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '0.9rem' }}
              />
              {itemFilter !== 'all' && (
                <X size={16} color="#888" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setItemFilter('all'); setItemSearchText(''); }} />
              )}
            </div>

            {isItemDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #333', borderRadius: '10px', maxHeight: '250px', overflowY: 'auto', zIndex: 10, marginTop: '5px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                <div
                  style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #222', color: '#888', fontSize: '0.85rem' }}
                  onClick={() => { setItemFilter('all'); setItemSearchText(''); setIsItemDropdownOpen(false); }}
                >
                  -- Всі деталі --
                </div>
                {filteredItems.slice(0, 100).map(i => (
                  <div
                    key={i.id}
                    style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #222', color: itemFilter === i.id ? '#ff9000' : '#ddd', background: itemFilter === i.id ? 'rgba(255,144,0,0.1)' : 'transparent', fontSize: '0.85rem' }}
                    onClick={() => { setItemFilter(i.id); setItemSearchText(i.name); setIsItemDropdownOpen(false); }}
                  >
                    {i.name} {i.base_code && <span style={{ color: '#555', fontSize: '0.75rem', marginLeft: '10px' }}>#{i.base_code}</span>}
                  </div>
                ))}
                {filteredItems.length === 0 && <div style={{ padding: '10px 15px', color: '#555', fontSize: '0.85rem' }}>Нічого не знайдено</div>}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleGenerateReport}
            style={{ background: '#ff9000', color: '#000', border: 'none', padding: '12px 30px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <BarChart2 size={18} /> СФОРМУВАТИ ЗВІТ
          </button>
        </div>
      </div>

      {/* GENERATED REPORT */}
      {generatedReport && (
        <div className="glass-panel" style={{ background: '#0a0a0a', padding: '30px', borderRadius: '16px', border: '1px solid #1a1a1a', animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '25px' }}>
            <div>
              <h2 style={{ margin: '0 0 10px', fontSize: '1.6rem', color: '#fff', fontWeight: 900 }}>Зведена відомість по залишках</h2>
              <div style={{ fontSize: '0.8rem', color: '#555' }}>
                Сформовано: {generatedReport.timestamp.toLocaleString('uk-UA')} <br/>
                Фільтри: Склад ({whFilter === 'all' ? 'Всі' : (whNameMap[whFilter] || whFilter)}) | Група ({typeFilter === 'all' ? 'Всі' : (typeNameMap[typeFilter] || typeFilter)}) | Деталь ({itemFilter === 'all' ? 'Всі' : 'Вибрана'})
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', gap: '30px', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>Фізичний залишок</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#fff', lineHeight: 1.2 }}>{generatedReport.totalQtyAll}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>В резерві</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 950, color: '#ff9000', lineHeight: 1.2 }}>{generatedReport.totalResAll}</div>
              </div>
              <div style={{ paddingLeft: '20px', borderLeft: '1px solid #222' }}>
                <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: 800 }}>ДОСТУПНО (ВІЛЬНО)</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 950, color: '#22c55e', lineHeight: 1 }}>{generatedReport.totalQtyAll - generatedReport.totalResAll}</div>
              </div>
            </div>
          </div>

          {Object.keys(generatedReport.grouped).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#555', fontSize: '0.9rem' }}>За вказаними фільтрами даних не знайдено.</div>
          ) : (
            Object.values(generatedReport.grouped).map(wh => (
              <div key={wh.name} style={{ marginBottom: '35px' }}>
                <h3 style={{ fontSize: '1.2rem', color: '#ff9000', borderBottom: '2px solid #222', paddingBottom: '10px', marginBottom: '15px', textTransform: 'uppercase' }}>
                  Склад: {whNameMap[wh.name] || wh.name}
                </h3>

                {Object.values(wh.groups).map(group => (
                  <div key={group.name} style={{ marginBottom: '20px', paddingLeft: '15px', borderLeft: '3px solid #333' }}>
                    <h4 style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Група: {typeNameMap[group.name] || group.name}</span>
                      <span style={{ color: '#555' }}>Всього: {group.total - group.reserved} вільних / {group.reserved} рез.</span>
                    </h4>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: '#111', color: '#666', textAlign: 'left' }}>
                          <th style={{ padding: '10px 15px', borderBottom: '1px solid #222', width: '50%' }}>Номенклатура</th>
                          <th style={{ padding: '10px 15px', textAlign: 'center', borderBottom: '1px solid #222' }}>Фізично (всього)</th>
                          <th style={{ padding: '10px 15px', textAlign: 'center', borderBottom: '1px solid #222' }}>В резерві</th>
                          <th style={{ padding: '10px 15px', textAlign: 'center', borderBottom: '1px solid #222', color: '#22c55e' }}>Доступно</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #1a1a1a', background: 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '12px 15px', fontWeight: 700, color: '#ddd' }}>{item.nom_name}</td>
                            <td style={{ padding: '12px 15px', textAlign: 'center', color: '#888' }}>{item.total_qty || 0}</td>
                            <td style={{ padding: '12px 15px', textAlign: 'center', color: '#ff9000' }}>{item.reserved_qty || 0}</td>
                            <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 900, color: '#22c55e' }}>
                              {(Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
