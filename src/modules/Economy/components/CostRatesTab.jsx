import React from 'react'
import { Sliders, Save, Check, ShieldAlert, Cpu, Wrench } from 'lucide-react'

export const CostRatesTab = ({ costRates = {}, setCostRates }) => {
  const handleChange = (key, value) => {
    setCostRates(prev => ({
      ...prev,
      [key]: Number(value) || 0
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Info Banner */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #ff9000, #d97706)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Sliders size={22} />
        </div>

        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, color: 'var(--text)' }}>
            Виробничі Нормативи & Годинні Тарифні Ставки
          </h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Встановлення вартості 1 нормо-години роботи дільниць та відсотка накладних витрат для економічних розрахунків
          </div>
        </div>
      </div>

      {/* Grid of Rate Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {/* Rate 1: Cutting */}
        <div className="glass-panel" style={{ padding: '22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)' }}>
              🪚 Дільниця Розкрою (Розкрій)
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 800 }}>
              грн / нормо-год
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Вартість години роботи стрічкопильного верстата та оператора розкрою
          </div>
          <input
            type="number"
            value={costRates.cuttingRatePerHour || 140}
            onChange={(e) => handleChange('cuttingRatePerHour', e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text)',
              fontWeight: 950,
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Rate 2: Tumbling */}
        <div className="glass-panel" style={{ padding: '22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)' }}>
              🌀 Дільниця Галтовки (Галтовка)
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 800 }}>
              грн / нормо-год
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Електроенергія, амортизація галтувальних барабанів та наповнювача
          </div>
          <input
            type="number"
            value={costRates.tumblingRatePerHour || 90}
            onChange={(e) => handleChange('tumblingRatePerHour', e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text)',
              fontWeight: 950,
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Rate 3: Brazing / Welding */}
        <div className="glass-panel" style={{ padding: '22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)' }}>
              🔥 Дільниця Пайки та Зварювання
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 800 }}>
              грн / нормо-год
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Витрати флюсу, припою, газу ТВЧ установки та праця паяльника
          </div>
          <input
            type="number"
            value={costRates.brazingRatePerHour || 180}
            onChange={(e) => handleChange('brazingRatePerHour', e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text)',
              fontWeight: 950,
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Rate 4: Grinding & CNC */}
        <div className="glass-panel" style={{ padding: '22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text)' }}>
              ⚙️ Дільниця Заточування & ЧПК
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontWeight: 800 }}>
              грн / нормо-год
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Високоточне шліфування, алмазні круги, ЧПК обробка
          </div>
          <input
            type="number"
            value={costRates.grindingRatePerHour || 320}
            onChange={(e) => handleChange('grindingRatePerHour', e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(0,0,0,0.3)',
              color: 'var(--text)',
              fontWeight: 950,
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Rate 5: Overhead % */}
        <div className="glass-panel" style={{ padding: '22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ef4444' }}>
              🏛️ Загальноцехові Накладні Витрати
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 800 }}>
              % від прямих витрат
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Оренда приміщень, адміністративні витрати, цехове освітлення
          </div>
          <input
            type="number"
            value={costRates.overheadPercentage || 15}
            onChange={(e) => handleChange('overheadPercentage', e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #ef4444',
              background: 'rgba(0,0,0,0.3)',
              color: '#ef4444',
              fontWeight: 950,
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Rate 6: Target Margin % */}
        <div className="glass-panel" style={{ padding: '22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#10b981' }}>
              🎯 Цільова Норма Маржинальності
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 800 }}>
              % від ціни
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Бажаний відсоток валового прибутку в розрахованій ціні виробу
          </div>
          <input
            type="number"
            value={costRates.targetMarginPercentage || 35}
            onChange={(e) => handleChange('targetMarginPercentage', e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #10b981',
              background: 'rgba(0,0,0,0.3)',
              color: '#10b981',
              fontWeight: 950,
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Rate 7: Retail Markup % */}
        <div className="glass-panel" style={{ padding: '22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #ff9000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ff9000' }}>
              🛒 Націнка Роздрібного Прайсу
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255, 144, 0, 0.15)', color: '#ff9000', fontWeight: 800 }}>
              % до гуртової ціни
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Стандартна націнка роздрібного прайсу відносно розрахованої гуртової ціни
          </div>
          <input
            type="number"
            value={costRates.retailMarkupPercentage || 25}
            onChange={(e) => handleChange('retailMarkupPercentage', e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #ff9000',
              background: 'rgba(0,0,0,0.3)',
              color: '#ff9000',
              fontWeight: 950,
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Rate 8: Dealer Discount % */}
        <div className="glass-panel" style={{ padding: '22px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #ec4899' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ec4899' }}>
              🤝 Дилерська Знижка
            </span>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', fontWeight: 800 }}>
              % від гуртової ціни
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Спеціальна партнерська знижка для оптових дилерів
          </div>
          <input
            type="number"
            value={costRates.dealerDiscountPercentage || 10}
            onChange={(e) => handleChange('dealerDiscountPercentage', e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #ec4899',
              background: 'rgba(0,0,0,0.3)',
              color: '#ec4899',
              fontWeight: 950,
              fontSize: '1.1rem',
              outline: 'none'
            }}
          />
        </div>
      </div>
    </div>
  )
}
