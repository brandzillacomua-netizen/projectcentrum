import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Monitor, RefreshCw, Layers, Clock, Archive, AlertTriangle } from 'lucide-react'
import { useMES } from '../../MESContext'
import { useShop2BufferData } from './hooks/useShop2BufferData'
import { useShop2CardCreator } from './hooks/useShop2CardCreator'
import { Shop2BufferQueueTable } from './components/Shop2BufferQueueTable'
import { GenerateShop2CardModal } from './components/GenerateShop2CardModal'
import { DeficitRerunListModal } from './components/DeficitRerunListModal'
import { Shop2ActiveCardsList } from './components/Shop2ActiveCardsList'
import { Shop2HistoryCardsList } from './components/Shop2HistoryCardsList'

export default function Shop2CardGenModule() {
  const {
    orders = [],
    tasks = [],
    workCards = [],
    inventory = [],
    nomenclatures = [],
    bomItems = [],
    machines = [],
    fetchData,
    refreshTable
  } = useMES()

  useEffect(() => {
    if (typeof fetchData === 'function') {
      fetchData(['orders', 'tasks', 'inventory', 'nomenclatures', 'bom_items', 'work_cards', 'machines']).catch(() => {})
    }
  }, [fetchData])

  const [activeTab, setActiveTab] = useState('buffer') // 'buffer' | 'active' | 'history'
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('all')
  const [groupBy, setGroupBy] = useState('product') // 'product' | 'part' | 'order'
  const [sortBy, setSortBy] = useState('available_desc') // 'available_desc' | 'name_asc' | 'product_asc'
  const [showDeficitModal, setShowDeficitModal] = useState(false)

  const {
    bufferRows,
    filteredRows,
    productSections,
    deficitRows,
    totalDeficitQty,
    shop2TaskIdsSet,
    stages
  } = useShop2BufferData({
    orders,
    tasks,
    workCards,
    inventory,
    nomenclatures,
    bomItems,
    searchTerm,
    selectedOrderId,
    groupBy,
    sortBy
  })

  const {
    selectedRow,
    isModalOpen,
    isSubmitting,
    error,
    openGenModal,
    closeGenModal,
    handleGenerateCards
  } = useShop2CardCreator({
    tasks,
    fetchData,
    refreshTable
  })

  // Summary statistics
  const totalAvailableQty = bufferRows.reduce((sum, r) => sum + r.availableQty, 0)
  const totalInProgressQty = bufferRows.reduce((sum, r) => sum + r.inProgressQty, 0)
  const totalReceivedQty = bufferRows.reduce((sum, r) => sum + r.totalReceived, 0)

  return (
    <div style={{
      background: 'var(--bg, #f8fafc)',
      minHeight: '100vh',
      color: 'var(--text, #0f172a)',
      padding: '24px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* CSS Keyframes for Pulsing Red Alert Button */}
      <style>{`
        @keyframes pulseRedAlert {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            transform: scale(1.02);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            transform: scale(1);
          }
        }
        .pulse-red-btn {
          animation: pulseRedAlert 1.8s infinite ease-in-out;
        }
      `}</style>

      {/* ── Top Header Navigation ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border, #cbd5e1)', borderRadius: '12px', color: 'var(--text, #0f172a)', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={20} color="#ff9000" />
              <h1 style={{ fontSize: '1.4rem', fontWeight: 950, margin: 0, letterSpacing: '0.5px', color: 'var(--text, #0f172a)' }}>
                Цех №2 – Створення РК (Буфер)
              </h1>
            </div>
            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.8rem', margin: '4px 0 0' }}>
              Формування робочих карток з накопиченого буфера заготовок
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* FLASHING RED ALERT BUTTON FOR DEFICIT (Appears ONLY when totalDeficitQty > 0) */}
          {totalDeficitQty > 0 && (
            <button
              onClick={() => setShowDeficitModal(true)}
              className="pulse-red-btn"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '12px',
                fontSize: '0.82rem',
                fontWeight: 950,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} />
              🚨 ПОТРЕБА В ДОВИПУСКУ ({totalDeficitQty} шт)
            </button>
          )}

          <button
            onClick={() => {
              if (typeof fetchData === 'function') fetchData(['work_cards', 'tasks', 'orders', 'inventory']).catch(() => {})
            }}
            style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border, #cbd5e1)', color: 'var(--text-muted, #475569)', padding: '10px 16px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} /> Оновити дані
          </button>
        </div>
      </div>

      {/* ── Stat Counters ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '18px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 800 }}>Надійшло в Буфер (Цех №1 + ВКЯ)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0284c7', marginTop: '4px' }}>
            {totalReceivedQty.toLocaleString()} <small style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>шт</small>
          </div>
        </div>

        <div style={{ background: 'var(--card-bg, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '18px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', fontWeight: 800 }}>В роботі (Цех №2)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#d97706', marginTop: '4px' }}>
            {totalInProgressQty.toLocaleString()} <small style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)' }}>шт</small>
          </div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '18px', padding: '20px' }}>
          <div style={{ fontSize: '0.7rem', color: '#059669', textTransform: 'uppercase', fontWeight: 900 }}>Доступно до запуску (ВІЛЬНО)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 950, color: '#059669', marginTop: '4px' }}>
            {totalAvailableQty.toLocaleString()} <small style={{ fontSize: '0.7rem', color: '#047857' }}>шт</small>
          </div>
        </div>
      </div>

      {/* ── Tabs Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border, #e2e8f0)', paddingBottom: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('buffer')}
          style={{
            background: activeTab === 'buffer' ? '#ff9000' : 'var(--card-bg, #ffffff)',
            color: activeTab === 'buffer' ? '#ffffff' : 'var(--text-muted, #64748b)',
            border: activeTab === 'buffer' ? 'none' : '1px solid var(--border, #cbd5e1)',
            padding: '10px 20px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 950,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Layers size={16} />
          Буфер заготовок ({bufferRows.length})
        </button>

        <button
          onClick={() => setActiveTab('active')}
          style={{
            background: activeTab === 'active' ? '#ff9000' : 'var(--card-bg, #ffffff)',
            color: activeTab === 'active' ? '#ffffff' : 'var(--text-muted, #64748b)',
            border: activeTab === 'active' ? 'none' : '1px solid var(--border, #cbd5e1)',
            padding: '10px 20px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 950,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Clock size={16} />
          Активні РК Цеху №2
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            background: activeTab === 'history' ? '#ff9000' : 'var(--card-bg, #ffffff)',
            color: activeTab === 'history' ? '#ffffff' : 'var(--text-muted, #64748b)',
            border: activeTab === 'history' ? 'none' : '1px solid var(--border, #cbd5e1)',
            padding: '10px 20px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 950,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Archive size={16} />
          Архів виконаних РК
        </button>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────────── */}
      {activeTab === 'buffer' && (
        <Shop2BufferQueueTable
          rows={filteredRows}
          productSections={productSections}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedOrderId={selectedOrderId}
          setSelectedOrderId={setSelectedOrderId}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          sortBy={sortBy}
          setSortBy={setSortBy}
          orders={orders}
          onOpenGenModal={openGenModal}
        />
      )}

      {activeTab === 'active' && (
        <Shop2ActiveCardsList
          workCards={workCards}
          orders={orders}
          nomenclatures={nomenclatures}
          shop2TaskIdsSet={shop2TaskIdsSet}
        />
      )}

      {activeTab === 'history' && (
        <Shop2HistoryCardsList
          workCards={workCards}
          orders={orders}
          nomenclatures={nomenclatures}
          shop2TaskIdsSet={shop2TaskIdsSet}
        />
      )}

      {/* ── Generation Modal ─────────────────────────────────────────────────── */}
      {isModalOpen && (
        <GenerateShop2CardModal
          row={selectedRow}
          stages={stages}
          machines={machines}
          isSubmitting={isSubmitting}
          error={error}
          onClose={closeGenModal}
          onGenerate={handleGenerateCards}
        />
      )}

      {/* ── Deficit Rerun List Modal (Triggered by Flashing Red Alert Button) ── */}
      {showDeficitModal && (
        <DeficitRerunListModal
          deficitRows={deficitRows}
          orders={orders}
          onClose={() => setShowDeficitModal(false)}
          onSuccess={() => {
            if (typeof fetchData === 'function') fetchData(['work_cards', 'tasks', 'orders']).catch(() => {})
          }}
        />
      )}
    </div>
  )
}
