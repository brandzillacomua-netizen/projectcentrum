import React from 'react'
import { X, Award, AlertTriangle, Clock, Wrench, ShieldCheck, Cpu, Package, Sparkles } from 'lucide-react'

export const EmployeeAuditModal = ({ operator, onClose }) => {
  if (!operator) return null

  const machines = Object.entries(operator.machinesMap || {}).sort((a, b) => b[1] - a[1])
  const nomenclatures = Object.entries(operator.nomMap || {}).sort((a, b) => b[1] - a[1])
  const pauseReasons = Object.entries(operator.pauseReasons || {}).sort((a, b) => b[1] - a[1])

  const totalMachineQty = machines.reduce((s, [, q]) => s + q, 0) || 1
  const totalNomQty = nomenclatures.reduce((s, [, q]) => s + q, 0) || 1

  return (
    <div className="dossier-modal-overlay" onClick={onClose}>
      <div className="dossier-modal-card glass-panel-premium" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dossier-modal-header">
          <div className="dossier-header-left">
            <div className="dossier-avatar-badge" style={{ borderColor: operator.tierColor }}>
              {operator.tierBadge}
            </div>
            <div>
              <div className="dossier-title-row">
                <h2>{operator.name}</h2>
                <span className="dossier-tier-pill" style={{ color: operator.tierColor, borderColor: operator.tierColor }}>
                  {operator.tierLabel}
                </span>
              </div>
              <div className="dossier-subtitle">
                <span>{operator.position}</span>
                <span className="dot-divider">•</span>
                <span>{operator.department}</span>
                <span className="dot-divider">•</span>
                <span className="shift-tag">{operator.shift}</span>
              </div>
            </div>
          </div>

          <button className="dossier-btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="dossier-modal-body">
          {/* AI Executive Summary */}
          <div className="dossier-ai-card">
            <div className="dossier-ai-head">
              <Sparkles size={16} className="text-amber-400" />
              <span>AI ВЕРДИКТ ТА РЕКОМЕНДАЦІЯ ДИРЕКТОРУ:</span>
            </div>
            <p className="dossier-ai-text">
              {operator.compositeScore >= 88 ? (
                <>Працівник демонструє <strong>еталонну продуктивність</strong> (вище середнього по цеху на {Math.round((operator.unitsPerHour / 50 - 1) * 100)}%). Рівень браку мінімальний ({operator.scrapRate}%). Найвища віддача на верстаті <strong>{operator.topMachine}</strong>. Рекомендовано для преміювання та наставництва.</>
              ) : operator.compositeScore >= 70 ? (
                <><strong>Стабільний надійний оператор</strong>. Дотримується нормативів виробництва, виготовлено {operator.producedQty.toLocaleString()} шт. Основний фокус покращення — оптимізація часу простоїв ({operator.pauseHours} год на паузах).</>
              ) : operator.scrapRate > 4.0 ? (
                <><strong>Зона підвищеного браку</strong> ({operator.scrapRate}%). Зверніть увагу на якість різання виробу <strong>"{operator.topNom}"</strong>. Рекомендовано провести додатковий інструктаж з налагодження фрез або перевірити геометрію подачі.</>
              ) : (
                <>Продуктивність нижча за середню норму по цеху ({operator.unitsPerHour} шт/год). Рекомендовано проаналізувати завантаження або передавати більш однотипні партії для розгону темпу.</>
              )}
            </p>
          </div>

          {/* KPI Grid */}
          <div className="dossier-kpi-grid">
            <div className="dossier-kpi-box">
              <span className="dossier-kpi-label">ВИРОБЛЕНО ДЕТАЛЕЙ</span>
              <span className="dossier-kpi-value text-green">{operator.producedQty.toLocaleString()} шт</span>
              <span className="dossier-kpi-sub">У {operator.cardsCount} робочих картах</span>
            </div>

            <div className="dossier-kpi-box">
              <span className="dossier-kpi-label">ШВИДКІСТЬ ВИПУСКУ</span>
              <span className="dossier-kpi-value text-amber">{operator.unitsPerHour} шт/год</span>
              <span className="dossier-kpi-sub">Чистий робочий час: {operator.activeHours} год</span>
            </div>

            <div className="dossier-kpi-box">
              <span className="dossier-kpi-label">БРАК ТА ВТРАТИ</span>
              <span className={`dossier-kpi-value ${operator.scrapRate > 3 ? 'text-red' : 'text-green'}`}>
                {operator.scrapRate}%
              </span>
              <span className="dossier-kpi-sub">{operator.scrapQty} шт браковано</span>
            </div>

            <div className="dossier-kpi-box">
              <span className="dossier-kpi-label">ПРОСТОЇ ТА ПАУЗИ</span>
              <span className="dossier-kpi-value text-blue">{operator.pauseHours} год</span>
              <span className="dossier-kpi-sub">{operator.pauseCount} зупинок ({operator.downtimeRatio}% зміни)</span>
            </div>
          </div>

          {/* Split Sections */}
          <div className="dossier-sections-split">
            {/* Top Machines */}
            <div className="dossier-subcard">
              <div className="dossier-subcard-title">
                <Cpu size={14} className="text-amber-400" />
                <span>Завантаження по верстатах</span>
              </div>
              <div className="dossier-bar-list">
                {machines.length === 0 ? (
                  <div className="dossier-empty">Немає записів</div>
                ) : (
                  machines.map(([mName, qty]) => {
                    const percent = Math.round((qty / totalMachineQty) * 100)
                    return (
                      <div key={mName} className="dossier-bar-item">
                        <div className="dossier-bar-header">
                          <span className="dossier-bar-name">{mName}</span>
                          <span className="dossier-bar-val">{qty.toLocaleString()} шт ({percent}%)</span>
                        </div>
                        <div className="dossier-bar-track">
                          <div className="dossier-bar-fill fill-amber" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Top Products */}
            <div className="dossier-subcard">
              <div className="dossier-subcard-title">
                <Package size={14} className="text-blue-400" />
                <span>Основні вироби (номенклатура)</span>
              </div>
              <div className="dossier-bar-list">
                {nomenclatures.length === 0 ? (
                  <div className="dossier-empty">Немає записів</div>
                ) : (
                  nomenclatures.slice(0, 5).map(([nName, qty]) => {
                    const percent = Math.round((qty / totalNomQty) * 100)
                    return (
                      <div key={nName} className="dossier-bar-item">
                        <div className="dossier-bar-header">
                          <span className="dossier-bar-name" title={nName}>{nName}</span>
                          <span className="dossier-bar-val">{qty.toLocaleString()} шт ({percent}%)</span>
                        </div>
                        <div className="dossier-bar-track">
                          <div className="dossier-bar-fill fill-blue" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Pause Reasons breakdown */}
          {pauseReasons.length > 0 && (
            <div className="dossier-subcard" style={{ marginTop: '12px' }}>
              <div className="dossier-subcard-title">
                <Clock size={14} className="text-red-400" />
                <span>Структура причин зупинок та простоїв</span>
              </div>
              <div className="dossier-pause-tags">
                {pauseReasons.map(([reason, sec]) => (
                  <div key={reason} className="dossier-pause-tag">
                    <span className="pause-tag-reason">{reason}</span>
                    <span className="pause-tag-time">{Math.round((sec / 60))} хв</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

