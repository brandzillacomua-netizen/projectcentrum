import React, { useState } from 'react'
import { DollarSign, Tag, Calculator, Sliders, TrendingUp, ShieldCheck } from 'lucide-react'
import { useEconomyData } from './hooks/useEconomyData'
import { PriceListTab } from './components/PriceListTab'
import { CostingCalculatorTab } from './components/CostingCalculatorTab'
import { CostRatesTab } from './components/CostRatesTab'
import { MarginAnalyticsTab } from './components/MarginAnalyticsTab'

const EconomyModule = () => {
  const {
    nomenclatures,
    bomItems,
    orders,
    pricesMap,
    costRates,
    setCostRates,
    calculateItemCost,
    updateItemPrice,
    bulkUpdateCategoryPrices
  } = useEconomyData()

  const [activeTab, setActiveTab] = useState('pricelist') // 'pricelist', 'cogs', 'rates', 'analytics'

  return (
    <div style={{ padding: '20px 24px', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)'
          }}>
            <DollarSign size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 950, letterSpacing: '-0.4px', color: 'var(--text)' }}>
              Економіка, Ціноутворення та Собівартість
            </h1>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Модуль економіста: Прайс-листи, калькуляція себевартості (BOM + Труд), нормативи та аналітика маржі
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="glass-panel" style={{
        borderRadius: '16px',
        padding: '6px',
        marginBottom: '24px',
        display: 'flex',
        gap: '6px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('pricelist')}
          style={{
            flex: 1,
            minWidth: '180px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'pricelist' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
            color: activeTab === 'pricelist' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 950,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'pricelist' ? '0 4px 15px rgba(16, 185, 129, 0.3)' : 'none'
          }}
        >
          <Tag size={16} /> 1. Прайс-листи & Базові Ціни
        </button>

        <button
          onClick={() => setActiveTab('cogs')}
          style={{
            flex: 1,
            minWidth: '180px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'cogs' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
            color: activeTab === 'cogs' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 950,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'cogs' ? '0 4px 15px rgba(16, 185, 129, 0.3)' : 'none'
          }}
        >
          <Calculator size={16} /> 2. Калькуляція Собівартості (COGS)
        </button>

        <button
          onClick={() => setActiveTab('rates')}
          style={{
            flex: 1,
            minWidth: '180px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'rates' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
            color: activeTab === 'rates' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 950,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'rates' ? '0 4px 15px rgba(16, 185, 129, 0.3)' : 'none'
          }}
        >
          <Sliders size={16} /> 3. Виробничі Тарифи & Нормативи
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            flex: 1,
            minWidth: '180px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'analytics' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
            color: activeTab === 'analytics' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 950,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'analytics' ? '0 4px 15px rgba(16, 185, 129, 0.3)' : 'none'
          }}
        >
          <TrendingUp size={16} /> 4. Маржинальність & Симулятор
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'pricelist' && (
        <PriceListTab
          nomenclatures={nomenclatures}
          pricesMap={pricesMap}
          costRates={costRates}
          calculateItemCost={calculateItemCost}
          onUpdatePrice={updateItemPrice}
          onBulkUpdatePrices={bulkUpdateCategoryPrices}
        />
      )}

      {activeTab === 'cogs' && (
        <CostingCalculatorTab
          nomenclatures={nomenclatures}
          calculateItemCost={calculateItemCost}
        />
      )}

      {activeTab === 'rates' && (
        <CostRatesTab
          costRates={costRates}
          setCostRates={setCostRates}
        />
      )}

      {activeTab === 'analytics' && (
        <MarginAnalyticsTab
          nomenclatures={nomenclatures}
          orders={orders}
          calculateItemCost={calculateItemCost}
        />
      )}
    </div>
  )
}

export default EconomyModule
