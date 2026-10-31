import React, { useState } from 'react'
import {
  CheckCircle,
  AlertOctagon,
  Copy,
  Printer,
  Check,
  FileSpreadsheet
} from 'lucide-react'

export function CalculatorStockStatus({
  productName,
  quantity,
  materials = [],
  thicknesses = [],
  totals,
  onPrint
}) {
  const [copied, setCopied] = useState(false)

  const deficits = materials.filter(m => m.deficit > 0)
  const isAllAvailable = deficits.length === 0 && materials.length > 0

  const handleCopyReport = () => {
    let text = `РОЗРАХУНОК МАТЕРІАЛІВ (CENTRUM MES)\n`
    text += `Виріб: ${productName || 'Не вказано'}\n`
    text += `Партія: ${quantity} шт\n`
    text += `Дата: ${new Date().toLocaleDateString('uk-UA')}\n`
    text += `------------------------------------\n`
    text += `ВСЬОГО ЛИСТІВ: ${totals.totalSheets}\n`
    text += `  - Листів Т300: ${totals.sheetsT300}\n`
    text += `  - Листів Т700: ${totals.sheetsT700}\n\n`
    text += `ЗВЕДЕННЯ ПО МАТЕРІАЛАХ:\n`
    materials.forEach(m => {
      text += `• ${m.name}: ${m.sheets} листів (на складі: ${m.stockAvailable}, дефіцит: ${m.deficit})\n`
    })
    text += `\nЗВЕДЕННЯ ПО МІЛІМЕТРАХ:\n`
    thicknesses.forEach(t => {
      text += `• ${t.thickness} мм: ${t.sheets} листів\n`
    })

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="calc-stock-status-bar">
      {/* Left: Overall Readiness Badge */}
      <div className="calc-readiness-group">
        {isAllAvailable ? (
          <div className="calc-readiness-pill ready">
            <CheckCircle size={16} />
            <div>
              <div className="calc-readiness-title">СИРОВИНА В НАЯВНОСТІ</div>
              <div className="calc-readiness-desc">Склад має достатньо листів для всієї партії</div>
            </div>
          </div>
        ) : deficits.length > 0 ? (
          <div className="calc-readiness-pill warning">
            <AlertOctagon size={16} />
            <div>
              <div className="calc-readiness-title">ПОТРІБНЕ ДОЗАМОВЛЕННЯ СИРОВИНИ</div>
              <div className="calc-readiness-desc">
                Дефіцит по {deficits.length} поз.: {deficits.map(d => `${d.name} (${d.deficit} шт)`).join(', ')}
              </div>
            </div>
          </div>
        ) : (
          <div className="calc-readiness-pill neutral">
            <span>Очікування розрахунку</span>
          </div>
        )}
      </div>

      {/* Right: Quick Action Buttons for Director */}
      <div className="calc-export-actions">
        <button
          type="button"
          className="calc-btn-action"
          onClick={handleCopyReport}
          title="Скопіювати зведену відомість у буфер обміну"
        >
          {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
          <span>{copied ? 'Скопійовано!' : 'Копіювати звіт'}</span>
        </button>

        <button
          type="button"
          className="calc-btn-action"
          onClick={onPrint}
          title="Роздрукувати калькуляцію або зберегти у PDF"
        >
          <Printer size={14} />
          <span>Друк / PDF</span>
        </button>
      </div>
    </div>
  )
}

