import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Scissors, Plus, X, AlertCircle, CheckCircle2, Clock, Trash2, Box, Layers, RefreshCw, Search, ChevronDown, Check } from 'lucide-react';
import { supabase } from '../../../supabase';
import { useMES } from '../../../MESContext';
import { 
  fetchRawRubberStock, 
  fetchRubberPartsCatalog, 
  fetchCuttingBatches, 
  createPendingRubberOrder, 
  cancelRubberOrder 
} from '../../RubberCutting/services/rubberCuttingService';
import { formatDurationSec } from '../../RubberCutting/utils/rubberConstants';

export function Shop2RubberOrdersView() {
  const { currentUser } = useMES();

  const [rawStock, setRawStock] = useState({ 'V2-90030': 0, 'V2-90031': 0 });
  const [parts, setParts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Order Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [targetPartsQty, setTargetPartsQty] = useState(500);
  const [sheetsCount, setSheetsCount] = useState(1);
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);
  const partDropdownRef = useRef(null);
  const partSearchInputRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stockData, partsData, batchesData] = await Promise.all([
        fetchRawRubberStock(supabase),
        fetchRubberPartsCatalog(supabase),
        fetchCuttingBatches(supabase)
      ]);
      setRawStock(stockData);
      setParts(partsData);
      setBatches(batchesData);
      if (partsData.length > 0 && !selectedPart) {
        setSelectedPart(partsData[0]);
      }
    } catch (e) {
      console.error('[Shop2RubberOrdersView] Load data error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isPartDropdownOpen) return;
    const focusTimer = setTimeout(() => {
      partSearchInputRef.current?.focus();
    }, 0);
    const handleOutside = (e) => {
      if (partDropdownRef.current && !partDropdownRef.current.contains(e.target)) {
        setIsPartDropdownOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsPartDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isPartDropdownOpen]);

  // When part or target qty changes, auto-calculate needed sheets
  const handleTargetQtyChange = (qty) => {
    const num = Math.max(1, parseInt(qty, 10) || 1);
    setTargetPartsQty(num);
    if (selectedPart && selectedPart.sheet_yield > 0) {
      const calculatedSheets = Math.ceil(num / selectedPart.sheet_yield);
      setSheetsCount(calculatedSheets);
    }
  };

  const handleSelectPart = (part) => {
    setSelectedPart(part);
    if (part && part.sheet_yield > 0) {
      const calculatedSheets = Math.ceil(targetPartsQty / part.sheet_yield);
      setSheetsCount(calculatedSheets);
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedPart) return;
    setIsSubmitting(true);
    try {
      const createdByName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') || currentUser?.login || 'Нач. Цеху №2';
      await createPendingRubberOrder(supabase, {
        part: selectedPart,
        sheetsCount,
        plannedQuantity: targetPartsQty,
        priority,
        notes,
        createdBy: createdByName
      });
      setIsModalOpen(false);
      setIsPartDropdownOpen(false);
      setNotes('');
      setPartSearch('');
      loadData();
    } catch (err) {
      console.error('[Shop2RubberOrdersView] Create error:', err);
      alert('Помилка створення заявки на порізку');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (batchId) => {
    if (!window.confirm('Скасувати це завдання на порізку гуми?')) return;
    await cancelRubberOrder(supabase, batchId);
    loadData();
  };

  const filteredParts = useMemo(() => {
    const q = partSearch.trim().toLowerCase().replace(/[×х*]/g, 'x');
    if (!q) return parts;
    return parts.filter(p => {
      const hay = `${p.name || ''} ${p.code || ''} ${p.raw_material_code || ''} ${p.sheet_size || ''}`
        .toLowerCase()
        .replace(/[×х*]/g, 'x');
      return hay.includes(q);
    });
  }, [parts, partSearch]);

  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      if (statusFilter === 'all') return true;
      return b.status === statusFilter;
    });
  }, [batches, statusFilter]);

  const pendingCount = batches.filter(b => b.status === 'pending').length;
  const inProgressCount = batches.filter(b => b.status === 'in_progress').length;
  const completedCount = batches.filter(b => b.status === 'completed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Banner & Action */}
      <div style={{
        background: 'var(--card-bg, #0d0d14)',
        borderRadius: '20px',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(255,144,0,0.15)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,144,0,0.3)' }}>
              <Scissors size={22} color="#ff9000" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 950, color: 'var(--text, #fff)', margin: 0 }}>
                ЗАЯВКИ НА ПОРІЗКУ ГУМИ (ЦЕХ №2)
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim, #64748b)', marginTop: '2px', fontWeight: 700 }}>
                Формування завдань для лицювальників-полірувальників на розкрій гумових листів
              </div>
            </div>
          </div>

          {/* SV Raw Stocks quick summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 700 }}>
              Залишки сировини на СВ:
            </span>
            <span style={{ background: 'var(--surface-1, #13131c)', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text, #fff)', fontWeight: 800 }}>
              Гума 2мм (V2-90030): <strong style={{ color: '#10b981' }}>{rawStock['V2-90030'] || 0} шт</strong>
            </span>
            <span style={{ background: 'var(--surface-1, #13131c)', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text, #fff)', fontWeight: 800 }}>
              Гума 4мм (V2-90031): <strong style={{ color: '#10b981' }}>{rawStock['V2-90031'] || 0} шт</strong>
            </span>
          </div>
        </div>

        {/* Create Order Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadData}
            style={{
              background: 'var(--button-bg, rgba(255,255,255,0.06))',
              border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              color: 'var(--text-muted, #94a3b8)',
              padding: '12px',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
            title="Оновити дані"
          >
            <RefreshCw size={18} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: '#ff9000',
              color: '#000',
              border: 'none',
              borderRadius: '14px',
              padding: '14px 22px',
              fontWeight: 950,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 18px rgba(255,144,0,0.35)'
            }}
          >
            <Plus size={18} strokeWidth={3} />
            СТВОРИТИ ЗАЯВКУ НА ГУМУ
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: 'var(--card-bg, #0d0d14)', borderRadius: '16px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', padding: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 900, textTransform: 'uppercase' }}>🟡 Очікують порізки</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#d97706', marginTop: '4px' }}>{pendingCount}</div>
        </div>
        <div style={{ background: 'var(--card-bg, #0d0d14)', borderRadius: '16px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', padding: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 900, textTransform: 'uppercase' }}>🔵 Зараз у роботі</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#0284c7', marginTop: '4px' }}>{inProgressCount}</div>
        </div>
        <div style={{ background: 'var(--card-bg, #0d0d14)', borderRadius: '16px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))', padding: '16px' }}>
          <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 900, textTransform: 'uppercase' }}>🟢 Завершено</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#10b981', marginTop: '4px' }}>{completedCount}</div>
        </div>
      </div>

      {/* Orders Filter Tabs & List */}
      <div style={{
        background: 'var(--card-bg, #0d0d14)',
        borderRadius: '20px',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', background: 'var(--surface-1, #13131c)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
            {[
              { id: 'all', label: 'Всі заявки' },
              { id: 'pending', label: `Очікують (${pendingCount})` },
              { id: 'in_progress', label: `В роботі (${inProgressCount})` },
              { id: 'completed', label: `Виконані (${completedCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  background: statusFilter === tab.id ? '#ff9000' : 'transparent',
                  color: statusFilter === tab.id ? '#000' : 'var(--text-muted, #94a3b8)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim, #64748b)' }}>
            Показано: {filteredBatches.length} завдань
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--card-header-bg, #13131c)', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', color: 'var(--text-dim, #64748b)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Партія</th>
                <th style={{ padding: '12px 16px' }}>Виріб з гуми</th>
                <th style={{ padding: '12px 16px' }}>Вхідний лист</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Потрібно деталей</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Листів</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Факт (шт)</th>
                <th style={{ padding: '12px 16px' }}>Лицювальники</th>
                <th style={{ padding: '12px 16px' }}>Статус</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Дії</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-dim, #64748b)' }}>
                    Немає заявок у цій вкладці
                  </td>
                </tr>
              ) : (
                filteredBatches.map(batch => (
                  <tr
                    key={batch.id}
                    style={{
                      borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                      background: 'transparent'
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#d97706', fontWeight: 800 }}>
                      {batch.batch_number}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--text, #fff)' }}>
                      <div>{batch.part_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim, #64748b)', fontFamily: 'monospace' }}>{batch.part_code}</div>
                      {batch.notes && (
                        <div style={{ fontSize: '0.68rem', color: '#0284c7', marginTop: '2px' }}>{batch.notes}</div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted, #94a3b8)' }}>
                      {batch.raw_material_code}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 950, color: 'var(--text, #fff)', fontSize: '0.9rem' }}>
                      {batch.planned_quantity} шт
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>
                      {batch.sheets_count} л
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 950, color: batch.actual_quantity > 0 ? '#10b981' : 'var(--text-dim, #64748b)' }}>
                      {batch.actual_quantity > 0 ? `${batch.actual_quantity} шт` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem' }}>
                      {batch.operator_name || (batch.operators && batch.operators.join(', ')) || 'Очікує взяття'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: batch.status === 'completed' ? 'rgba(16,185,129,0.15)' : (batch.status === 'in_progress' ? 'rgba(2,132,199,0.15)' : 'rgba(245,158,11,0.15)'),
                        color: batch.status === 'completed' ? '#10b981' : (batch.status === 'in_progress' ? '#0284c7' : '#d97706'),
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: 900
                      }}>
                        {batch.status === 'completed' ? 'ВИКОНАНО' : (batch.status === 'in_progress' ? 'В РОБОТІ' : 'ОЧІКУЄ')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {batch.status === 'pending' && (
                        <button
                          onClick={() => handleCancelOrder(batch.id)}
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#ef4444',
                            borderRadius: '8px',
                            padding: '6px 8px',
                            cursor: 'pointer'
                          }}
                          title="Скасувати заявку"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ORDER MODAL */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--card-bg, #0d0d14)',
            border: '1px solid rgba(255,144,0,0.3)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow, 0 20px 60px rgba(0,0,0,0.8))',
            overflow: 'hidden',
            color: 'var(--text, #fff)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Scissors size={20} color="#ff9000" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 950, color: 'var(--text, #fff)' }}>
                  НОВА ЗАЯВКА НА ПОРІЗКУ ГУМИ
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'var(--button-bg, rgba(255,255,255,0.06))',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateOrder} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Part Selector (Unified Searchable Dropdown) */}
              <div ref={partDropdownRef} style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text, #fff)', display: 'block', marginBottom: '8px' }}>
                  ОБЕРІТЬ ВИРІБ З ГУМИ (З {parts.length} ПОЗИЦІЙ КАТАЛОГУ)
                </label>

                <button
                  type="button"
                  onClick={() => setIsPartDropdownOpen(prev => !prev)}
                  style={{
                    width: '100%',
                    background: 'var(--input-bg, #13131c)',
                    border: isPartDropdownOpen ? '2px solid #ff9000' : '1px solid var(--border-color, rgba(255,255,255,0.12))',
                    color: 'var(--text, #fff)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    outline: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    textAlign: 'left',
                    boxSizing: 'border-box'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedPart
                      ? `${selectedPart.name} — норма: ${selectedPart.sheet_yield} шт/л (${selectedPart.sheet_size}мм, ${selectedPart.raw_material_code})`
                      : 'Оберіть виріб з гуми...'}
                  </span>
                  <ChevronDown
                    size={18}
                    style={{
                      flexShrink: 0,
                      color: 'var(--text-muted, #94a3b8)',
                      transform: isPartDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s ease'
                    }}
                  />
                </button>

                {isPartDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: 'var(--card-bg, #0d0d14)',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.14))',
                      borderRadius: '14px',
                      boxShadow: '0 14px 36px rgba(0,0,0,0.35)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Embedded Search Input */}
                    <div style={{
                      padding: '10px',
                      borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                      background: 'var(--surface-1, #13131c)'
                    }}>
                      <div style={{ position: 'relative' }}>
                        <Search
                          size={15}
                          style={{
                            position: 'absolute',
                            left: '11px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted, #94a3b8)',
                            pointerEvents: 'none'
                          }}
                        />
                        <input
                          ref={partSearchInputRef}
                          type="text"
                          value={partSearch}
                          onChange={e => setPartSearch(e.target.value)}
                          placeholder="Пошук за назвою, розміром або кодом..."
                          style={{
                            width: '100%',
                            background: 'var(--input-bg, #0d0d14)',
                            border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                            color: 'var(--text, #fff)',
                            padding: '8px 32px 8px 34px',
                            borderRadius: '10px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        {partSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setPartSearch('');
                              partSearchInputRef.current?.focus();
                            }}
                            title="Очистити пошук"
                            style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Options List */}
                    <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '6px' }}>
                      {filteredParts.length === 0 ? (
                        <div style={{
                          padding: '18px 12px',
                          textAlign: 'center',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted, #94a3b8)'
                        }}>
                          Нічого не знайдено за запитом
                        </div>
                      ) : (
                        filteredParts.map(p => {
                          const isSelected = selectedPart?.code === p.code;
                          return (
                            <button
                              key={p.code}
                              type="button"
                              onClick={() => {
                                handleSelectPart(p);
                                setIsPartDropdownOpen(false);
                                setPartSearch('');
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                background: isSelected ? 'rgba(255,144,0,0.14)' : 'transparent',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '9px 10px',
                                color: 'var(--text, #fff)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '10px'
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: isSelected ? 900 : 700, color: isSelected ? '#ff9000' : 'var(--text, #fff)' }}>
                                  {p.name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px' }}>
                                  норма: <strong>{p.sheet_yield} шт/л</strong> • {p.sheet_size}мм • {p.raw_material_code}
                                </div>
                              </div>
                              {isSelected && <Check size={16} color="#ff9000" style={{ flexShrink: 0 }} />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quantities Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text, #fff)', display: 'block', marginBottom: '6px' }}>
                    СКІЛЬКИ ДЕТАЛЕЙ ТРЕБА (ШТ)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={targetPartsQty}
                    onChange={e => handleTargetQtyChange(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--input-bg, #13131c)',
                      border: '2px solid #ff9000',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      color: 'var(--text, #fff)',
                      fontSize: '1.2rem',
                      fontWeight: 950,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px' }}>
                    РОЗРАХОВАНА К-СТЬ ЛИСТІВ
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={sheetsCount}
                    onChange={e => setSheetsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{
                      width: '100%',
                      background: 'var(--input-bg, #13131c)',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      color: '#0284c7',
                      fontSize: '1.2rem',
                      fontWeight: 950,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Material Availability Badge */}
              {selectedPart && (
                <div style={{
                  background: 'var(--surface-1, #13131c)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  color: 'var(--text, #fff)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="#ff9000" />
                    <span>Вхідний лист: <strong>{selectedPart.sheet_size} мм</strong> ({selectedPart.raw_material_code})</span>
                  </div>
                  <span style={{ color: '#10b981', fontWeight: 900 }}>
                    Доступно на СВ: {rawStock[selectedPart.raw_material_code] || 0} листів
                  </span>
                </div>
              )}

              {/* Priority */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px' }}>
                  ПРІОРИТЕТ ВИКОНАННЯ
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setPriority('normal')}
                    style={{
                      flex: 1,
                      background: priority === 'normal' ? 'rgba(2,132,199,0.14)' : 'var(--surface-1, #13131c)',
                      border: priority === 'normal' ? '2px solid #0284c7' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
                      color: priority === 'normal' ? '#0284c7' : 'var(--text-muted, #94a3b8)',
                      padding: '10px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Звичайна
                  </button>

                  <button
                    type="button"
                    onClick={() => setPriority('urgent')}
                    style={{
                      flex: 1,
                      background: priority === 'urgent' ? 'rgba(239,68,68,0.14)' : 'var(--surface-1, #13131c)',
                      border: priority === 'urgent' ? '2px solid #ef4444' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
                      color: priority === 'urgent' ? '#ef4444' : 'var(--text-muted, #94a3b8)',
                      padding: '10px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔴 Термінова
                  </button>
                </div>
              </div>

              {/* Note / Comment */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted, #94a3b8)', display: 'block', marginBottom: '6px' }}>
                  ПРИМІТКА / ДЛЯ ЧОГО (НЕОБОВ'ЯЗКОВО)
                </label>
                <input
                  type="text"
                  placeholder="Наприклад: Під партію рам F415"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--input-bg, #13131c)',
                    border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: 'var(--text, #fff)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !selectedPart}
                style={{
                  background: '#ff9000',
                  color: '#000',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '16px',
                  fontWeight: 950,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '10px',
                  boxShadow: '0 4px 18px rgba(255,144,0,0.35)'
                }}
              >
                <CheckCircle2 size={18} />
                {isSubmitting ? 'Відправка...' : 'ВІДПРАВИТИ ЗАВДАННЯ В ТЕРМІНАЛ ПОРІЗКИ'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

