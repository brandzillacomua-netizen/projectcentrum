import React, { useState } from 'react';
import { ListOrdered, CheckCircle2, Clock, Plus, Play, User, Box, Search } from 'lucide-react';
import { ACCENT_RUBBER, ACCENT_RUBBER_RGB, formatDurationSec } from '../../utils/rubberConstants';

export function RubberCuttingQueue({
  batches = [],
  onSelectBatchForWork,
  parts = []
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBatches = batches.filter(b => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchSearch = !searchTerm.trim() ||
      (b.part_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.part_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.batch_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div style={{
      background: '#0d0d12',
      borderRadius: '20px',
      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Top Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ListOrdered size={20} color={ACCENT_RUBBER} />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 950, color: '#fff', margin: 0 }}>
            ЧЕРГА ТА ІСТОРІЯ ПАРТІЙ ПОРІЗКИ ({filteredBatches.length})
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', background: '#13131c', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { id: 'all', label: 'Всі' },
              { id: 'completed', label: 'Завершені' },
              { id: 'in_progress', label: 'В роботі' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  background: statusFilter === tab.id ? ACCENT_RUBBER : 'transparent',
                  color: statusFilter === tab.id ? '#000' : '#94a3b8',
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

          {/* Search */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Пошук партії..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: '#13131c',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '6px 12px 6px 32px',
                color: '#fff',
                fontSize: '0.75rem',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div style={{
        overflowX: 'auto',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#13131c', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Партія / Код</th>
              <th style={{ padding: '12px 16px' }}>Деталь</th>
              <th style={{ padding: '12px 16px' }}>Вхідний лист</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Листів</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Готово (шт)</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Брак (шт)</th>
              <th style={{ padding: '12px 16px' }}>Час факту / план</th>
              <th style={{ padding: '12px 16px' }}>Оператори</th>
              <th style={{ padding: '12px 16px' }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Не знайдено жодної партії в цьому розділі
                </td>
              </tr>
            ) : (
              filteredBatches.map(batch => {
                const isOvertime = batch.planned_duration_sec > 0 && batch.actual_duration_sec > batch.planned_duration_sec;
                return (
                  <tr
                    key={batch.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: 'rgba(255,255,255,0.01)',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#d97706', fontWeight: 800 }}>
                      {batch.batch_number}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: '#fff' }}>
                      <div>{batch.part_name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>{batch.part_code}</div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#94a3b8' }}>
                      {batch.raw_material_code || 'Гума листова'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 900, color: '#fff' }}>
                      {batch.sheets_count}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 950, color: '#10b981', fontSize: '0.9rem' }}>
                      {batch.actual_quantity}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800, color: batch.scrap_quantity > 0 ? '#ef4444' : '#64748b' }}>
                      {batch.scrap_quantity > 0 ? `${batch.scrap_quantity} шт` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: isOvertime ? '#ef4444' : '#38bdf8', fontWeight: 800 }}>
                      {formatDurationSec(batch.actual_duration_sec)} / {formatDurationSec(batch.planned_duration_sec)}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.75rem' }}>
                      {batch.operator_name || (batch.operators && batch.operators.join(', ')) || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: batch.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: batch.status === 'completed' ? '#10b981' : '#f59e0b',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.68rem',
                        fontWeight: 900
                      }}>
                        {batch.status === 'completed' ? 'ЗАВЕРШЕНО' : 'В РОБОТІ'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

