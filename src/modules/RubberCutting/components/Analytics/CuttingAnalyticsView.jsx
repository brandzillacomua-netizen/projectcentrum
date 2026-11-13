import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, Users, AlertTriangle, Layers, Clock, Download } from 'lucide-react';
import { ACCENT_RUBBER, formatDurationSec } from '../../utils/rubberConstants';

export function CuttingAnalyticsView({ batches = [] }) {
  // Aggregate KPIs
  const stats = useMemo(() => {
    let totalSheets = 0;
    let totalParts = 0;
    let totalScrap = 0;
    let totalSecs = 0;
    const operatorMap = {};

    batches.forEach(b => {
      totalSheets += Number(b.sheets_count) || 0;
      totalParts += Number(b.actual_quantity) || 0;
      totalScrap += Number(b.scrap_quantity) || 0;
      totalSecs += Number(b.actual_duration_sec) || 0;

      const ops = Array.isArray(b.operators) && b.operators.length > 0 
        ? b.operators 
        : (b.operator_name ? b.operator_name.split(',').map(s => s.trim()) : ['Не вказано']);

      ops.forEach(op => {
        if (!op) return;
        if (!operatorMap[op]) {
          operatorMap[op] = { name: op, runs: 0, sheets: 0, parts: 0, scrap: 0, timeSec: 0 };
        }
        operatorMap[op].runs += 1;
        operatorMap[op].sheets += Number(b.sheets_count) || 0;
        operatorMap[op].parts += Number(b.actual_quantity) || 0;
        operatorMap[op].scrap += Number(b.scrap_quantity) || 0;
        operatorMap[op].timeSec += Number(b.actual_duration_sec) || 0;
      });
    });

    const scrapRate = totalParts + totalScrap > 0 
      ? ((totalScrap / (totalParts + totalScrap)) * 100).toFixed(1) 
      : '0.0';

    return {
      totalRuns: batches.length,
      totalSheets,
      totalParts,
      totalScrap,
      totalSecs,
      scrapRate,
      operators: Object.values(operatorMap).sort((a, b) => b.parts - a.parts)
    };
  }, [batches]);

  const handleExportCSV = () => {
    if (batches.length === 0) return;
    const headers = ['Партія', 'Дата', 'Зміна', 'Деталь', 'Вхідний лист', 'Листів', 'Деталей (шт)', 'Брак (шт)', 'Причина браку', 'Час факт (сек)', 'Оператори'];
    const rows = batches.map(b => [
      b.batch_number,
      new Date(b.created_at).toLocaleString('uk-UA'),
      b.shift || '',
      b.part_name || '',
      b.raw_material_code || '',
      b.sheets_count || 0,
      b.actual_quantity || 0,
      b.scrap_quantity || 0,
      b.scrap_reason || '',
      b.actual_duration_sec || 0,
      b.operator_name || ''
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `porizka_gumy_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#0d0d12', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
            <Layers size={14} color={ACCENT_RUBBER} /> Листів порізано
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#fff', marginTop: '6px' }}>
            {stats.totalSheets} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>шт</span>
          </div>
        </div>

        <div style={{ background: '#0d0d12', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
            <TrendingUp size={14} color="#10b981" /> Виготовлено деталей
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#10b981', marginTop: '6px' }}>
            {stats.totalParts} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>шт</span>
          </div>
        </div>

        <div style={{ background: '#0d0d12', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
            <AlertTriangle size={14} color="#ef4444" /> Брак деталей
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 950, color: stats.totalScrap > 0 ? '#ef4444' : '#fff', marginTop: '6px' }}>
            {stats.totalScrap} <span style={{ fontSize: '0.85rem', color: '#64748b' }}>шт ({stats.scrapRate}%)</span>
          </div>
        </div>

        <div style={{ background: '#0d0d12', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
            <Clock size={14} color="#38bdf8" /> Загальний час станка
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 950, color: '#38bdf8', marginTop: '6px' }}>
            {formatDurationSec(stats.totalSecs)}
          </div>
        </div>
      </div>

      {/* Operator Efficiency Table */}
      <div style={{
        background: '#0d0d12',
        borderRadius: '20px',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} color={ACCENT_RUBBER} />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 950, color: '#fff', margin: 0 }}>
              ЕФЕКТИВНІСТЬ ОПЕРАТОРІВ ПОРІЗКИ ({stats.operators.length})
            </h2>
          </div>

          <button
            onClick={handleExportCSV}
            style={{
              background: '#13131c',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> Експорт у CSV
          </button>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#13131c', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Працівник</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Партій виконано</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Листів порізано</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Готових деталей (шт)</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Брак (шт)</th>
                <th style={{ padding: '12px 16px' }}>Відпрацьований час</th>
              </tr>
            </thead>
            <tbody>
              {stats.operators.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Ще немає записів виконаних операцій порізки
                  </td>
                </tr>
              ) : (
                stats.operators.map(op => (
                  <tr
                    key={op.name}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: 'rgba(255,255,255,0.01)'
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: '#fff' }}>
                      {op.name}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                      {op.runs}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#fff', fontWeight: 800 }}>
                      {op.sheets}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#10b981', fontWeight: 950, fontSize: '0.9rem' }}>
                      {op.parts}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: op.scrap > 0 ? '#ef4444' : '#64748b', fontWeight: 800 }}>
                      {op.scrap > 0 ? `${op.scrap} шт` : '0'}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: 800 }}>
                      {formatDurationSec(op.timeSec)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

