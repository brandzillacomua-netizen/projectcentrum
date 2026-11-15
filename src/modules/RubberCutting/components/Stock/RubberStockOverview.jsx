import React from 'react';
import { Boxes, Package, Layers, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ACCENT_RUBBER, RAW_SHEETS, formatDurationSec } from '../../utils/rubberConstants';

export function RubberStockOverview({ rawStock = {}, parts = [] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Raw Material Sheets Cards (Warehouse SV) */}
      <div style={{
        background: 'var(--card-bg, #0d0d12)',
        borderRadius: '20px',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={20} color={ACCENT_RUBBER} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 950, color: 'var(--text, #fff)', margin: 0 }}>
              ЗАЛИШКИ ЛИСТОВОЇ ГУМИ НА СКЛАДІ ВИРОБНИЦТВА (СВ)
            </h2>
          </div>
          <Link
            to="/supply"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: ACCENT_RUBBER,
              textDecoration: 'none',
              fontSize: '0.78rem',
              fontWeight: 800
            }}
          >
            Відкрити Склад СВ <ExternalLink size={14} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {RAW_SHEETS.map(sheet => {
            const qty = rawStock[sheet.code] || 0;
            return (
              <div
                key={sheet.code}
                style={{
                  background: 'var(--surface-1, #13131c)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      background: 'rgba(255,144,0,0.15)',
                      color: ACCENT_RUBBER,
                      fontWeight: 950,
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {sheet.thickness} мм
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#d97706', fontWeight: 900 }}>
                      {sheet.code}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text, #fff)', marginTop: '6px' }}>
                    {sheet.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim, #64748b)', marginTop: '2px' }}>
                    Формат листа: {sheet.dimensions} мм
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#10b981' }}>
                    {qty}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim, #64748b)', fontWeight: 800, textTransform: 'uppercase' }}>
                    листів доступно
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 20 Verified Parts Catalog Table */}
      <div style={{
        background: 'var(--card-bg, #0d0d12)',
        borderRadius: '20px',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Boxes size={20} color={ACCENT_RUBBER} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 950, color: 'var(--text, #fff)', margin: 0 }}>
              КАТАЛОГ ДЕТАЛЕЙ РОЗКРОЮ ГУМИ ({parts.length} ПОЗИЦІЙ)
            </h2>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim, #64748b)', fontWeight: 700 }}>
            Кількість на листі та плановий хронометраж станка
          </span>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--card-header-bg, #13131c)', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', color: 'var(--text-dim, #64748b)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Код V2</th>
                <th style={{ padding: '12px 16px' }}>Стандартизована назва</th>
                <th style={{ padding: '12px 16px' }}>Розмір виробу</th>
                <th style={{ padding: '12px 16px' }}>Вхідний лист (СВ)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Деталей з листа</th>
                <th style={{ padding: '12px 16px' }}>Час на станку (лист)</th>
                <th style={{ padding: '12px 16px' }}>Час на 1 деталь</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(part => (
                <tr
                  key={part.code || part.name}
                  style={{
                    borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))',
                    background: 'transparent'
                  }}
                >
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#d97706', fontWeight: 800 }}>
                    {part.code}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text, #fff)' }}>
                    {part.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#0284c7', fontWeight: 700 }}>
                    {part.part_size}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted, #94a3b8)' }}>
                    {part.sheet_size} мм ({part.raw_material_code})
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 950, color: '#10b981' }}>
                    {part.sheet_yield} шт
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text, #fff)', fontWeight: 800 }}>
                    {part.sheet_cutting_time_sec > 0 ? `${part.sheet_cutting_time_sec} сек (${formatDurationSec(part.sheet_cutting_time_sec)})` : 'уточнюється'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted, #94a3b8)' }}>
                    {part.item_cutting_time_sec > 0 ? `${part.item_cutting_time_sec} сек` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

