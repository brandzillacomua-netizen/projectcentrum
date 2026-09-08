import React from 'react'
import { 
  ArrowLeft, CheckCircle2, Save, Send, Eye, Split, 
  Plus, Package, Clock, ShieldCheck, AlertTriangle, Layers, Box 
} from 'lucide-react'
import { PackagingBomList } from './PackagingBomList.jsx'
import { PackagingBoxSummary } from './PackagingBoxSummary.jsx'

export const Packaging1CDocumentView = ({
  activeBatchData,
  onBackToJournal,
  isWarehouseConfirmed,
  boxSummaryCount,
  showBoxSummary,
  setShowBoxSummary,
  categorizedBOM,
  allBOMItems,
  orderRequests,
  selectedNomIds,
  setSelectedNomIds,
  excludedNomIds,
  setExcludedNomIds,
  boxNumbers,
  setBoxNumbers,
  customQty,
  setCustomQty,
  setCustomItems,
  onOpenAddItemModal,
  onOpenSplitModal,
  isProcessing,
  hasAnyRequests,
  isSavingBoxes,
  allBoxesFilled,
  boxSummary,
  handleCreateRequest,
  handleSaveBoxes,
  handleCompleteClick
}) => {
  if (!activeBatchData) return null

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const clean = String(dateStr).split('T')[0]
      const parts = clean.split('-')
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`
      }
      return clean
    } catch (e) {
      return String(dateStr)
    }
  }

  const activeSelectedSet = selectedNomIds || excludedNomIds || new Set()
  const selectedItemsCount = (allBOMItems || []).filter(item => {
    const isSelected = activeSelectedSet.has(item.nom.id)
    const reqRequest = (orderRequests || []).find(r => String(r.nomenclature_id) === String(item.nom.id))
    const isPicked = reqRequest?.status === 'completed' || reqRequest?.status === 'issued'
    const isPending = reqRequest?.status === 'pending'
    return isSelected && !isPicked && !isPending
  }).length

  const hasAnyBoxNumber = Object.values(boxNumbers).some(v => v?.trim())
  const canSendRequest = selectedItemsCount > 0 && !isProcessing && !hasAnyRequests && !activeBatchData.isPackaged && !isWarehouseConfirmed
  const canComplete = allBoxesFilled && !isProcessing && !activeBatchData.isPackaged

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#ffffff',
      border: '1.5px solid #cbd5e1',
      borderRadius: '12px',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* 1C DOCUMENT COMMAND BAR (ПА НЕЛЬ ДІЙ ДОКУМЕНТА) */}
      <div style={{
        background: '#f8fafc',
        borderBottom: '1.5px solid #cbd5e1',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        {/* LEFT COMMANDS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onBackToJournal}
            style={{
              padding: '6px 12px',
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={14} /> До журналу
          </button>

          <span style={{ width: '1px', height: '22px', background: '#cbd5e1', margin: '0 4px' }}></span>

          {/* ЗАПИТ ТМЦ */}
          {!isWarehouseConfirmed && (
            <button
              type="button"
              onClick={handleCreateRequest}
              disabled={!canSendRequest}
              title={
                hasAnyRequests
                  ? 'Запит ТМЦ вже надіслано на склад'
                  : selectedItemsCount === 0
                  ? 'Оберіть галочками хоча б одну позицію, щоб сформувати запит ТМЦ'
                  : `Сформувати запит ТМЦ на ${selectedItemsCount} поз.`
              }
              style={{
                padding: '6px 12px',
                background: canSendRequest ? '#0284c7' : '#f1f5f9',
                color: canSendRequest ? '#ffffff' : '#94a3b8',
                border: canSendRequest ? '1px solid #0369a1' : '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: canSendRequest ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: canSendRequest ? '0 1px 2px rgba(2,132,199,0.2)' : 'none',
                transition: 'all 0.15s ease',
                opacity: canSendRequest ? 1 : 0.7
              }}
              onMouseEnter={(e) => {
                if (canSendRequest) e.currentTarget.style.background = '#0369a1'
              }}
              onMouseLeave={(e) => {
                if (canSendRequest) e.currentTarget.style.background = '#0284c7'
              }}
            >
              {hasAnyRequests ? (
                <><CheckCircle2 size={13} color="#059669" /> Запит на складі</>
              ) : (
                <><Send size={13} /> {selectedItemsCount > 0 ? `Сформувати запит ТМЦ (${selectedItemsCount})` : 'Сформувати запит ТМЦ'}</>
              )}
            </button>
          )}

          {/* ЗБЕРЕГТИ КОРОБКИ */}
          {isWarehouseConfirmed && !activeBatchData.isPackaged && (
            <button
              type="button"
              onClick={handleSaveBoxes}
              disabled={isSavingBoxes || !hasAnyBoxNumber}
              style={{
                padding: '6px 12px',
                background: hasAnyBoxNumber ? '#ffffff' : '#f8fafc',
                color: hasAnyBoxNumber ? '#0f172a' : '#94a3b8',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: hasAnyBoxNumber && !isSavingBoxes ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Save size={14} color="#f43f5e" /> {isSavingBoxes ? 'Збереження...' : 'Записати коробки'}
            </button>
          )}

          {/* ДОДАТИ ПОЗИЦІЮ */}
          {!activeBatchData.isPackaged && (
            <button
              type="button"
              onClick={() => onOpenAddItemModal('hardware')}
              style={{
                padding: '6px 12px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} color="#0284c7" /> Додати комплектуючі
            </button>
          )}

          {/* РОЗДІЛИТИ НА ПАРТІЇ */}
          {activeBatchData.hasPendingScheduleSplit && (
            <button
              type="button"
              onClick={onOpenSplitModal}
              style={{
                padding: '6px 12px',
                background: '#fef3c7',
                border: '1.5px solid #f59e0b',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 900,
                color: '#b45309',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Split size={14} /> ⚡ Розділити наряд на {activeBatchData.batchSchedule?.length} партії
            </button>
          )}

          {/* ЗМІСТ КОРОБОК */}
          {boxSummaryCount > 0 && (
            <button
              type="button"
              onClick={() => setShowBoxSummary(v => !v)}
              style={{
                padding: '6px 12px',
                background: showBoxSummary ? '#f1f5f9' : '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Eye size={14} /> {showBoxSummary ? 'Специфікація BOM' : `Зміст коробок (${boxSummaryCount})`}
            </button>
          )}
        </div>

        {/* RIGHT COMMAND: 1C "ПРОВЕСТИ ТА СПАКУВАТИ" */}
        <div>
          <button
            type="button"
            onClick={handleCompleteClick}
            disabled={!canComplete}
            style={{
              padding: '8px 20px',
              background: canComplete ? '#16a34a' : '#f1f5f9',
              color: canComplete ? '#ffffff' : '#94a3b8',
              border: canComplete ? 'none' : '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 1000,
              cursor: canComplete ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: canComplete ? '0 2px 8px rgba(22, 163, 74, 0.3)' : 'none'
            }}
          >
            <CheckCircle2 size={16} /> ПРОВЕСТИ ТА СПАКУВАТИ
          </button>
        </div>
      </div>

      {/* 1C DOCUMENT HEADER (ШАПКА ДОКУМЕНТА) */}
      <div style={{
        background: '#f1f5f9',
        borderBottom: '1.5px solid #cbd5e1',
        padding: '12px 18px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        fontSize: '0.8rem'
      }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Документ / Наряд</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            № {activeBatchData.orderNum}{activeBatchData.batchIndex ? `/${activeBatchData.batchIndex}` : ''}
            {activeBatchData.batchIndex && (
              <span style={{ background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900 }}>
                Партія {activeBatchData.batchIndex}
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Контрагент (Замовник)</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#1e293b' }}>
            {activeBatchData.customer || '—'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Номенклатура виробу</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#d97706' }}>
            {activeBatchData.productNames}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Обсяг пакування (План)</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 1000, color: '#059669' }}>
            {activeBatchData.plannedSets} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>шт.</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Дедлайн відвантаження</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#334155' }}>
            {formatDate(activeBatchData.deadline)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Стан забезпечення ТМЦ</div>
          <div>
            {isWarehouseConfirmed ? (
              <span style={{ color: '#16a34a', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> СКЛАД ПІДТВЕРДИВ
              </span>
            ) : hasAnyRequests ? (
              <span style={{ color: '#1d4ed8', fontWeight: 800 }}>
                Запит в обробці на складі
              </span>
            ) : (
              <span style={{ color: '#d97706', fontWeight: 800 }}>
                Потрібно сформувати запит ТМЦ
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 1C PENDING SPLIT ALERT */}
      {activeBatchData.hasPendingScheduleSplit && (
        <div style={{
          background: '#fffbeb',
          borderBottom: '1.5px solid #fcd34d',
          padding: '8px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: '#92400e',
          fontWeight: 800
        }}>
          <div>
            ⚡ <strong>УВАГА:</strong> Менеджер вніс графік відвантажень ({activeBatchData.batchSchedule?.length} партій). Ви можете розділити цей наряд і зафіксувати вже спаковану кількість.
          </div>
          <button
            type="button"
            onClick={onOpenSplitModal}
            style={{
              padding: '4px 10px',
              background: '#d97706',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 900,
              fontSize: '0.72rem',
              cursor: 'pointer'
            }}
          >
            Розділити наряд
          </button>
        </div>
      )}

      {/* 1C DOCUMENT TABLE PART (ТАБЛИЧНА ЧАСТИНА ДОКУМЕНТА) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#ffffff' }}>
        {showBoxSummary ? (
          <PackagingBoxSummary boxSummary={boxSummary} />
        ) : (
          <PackagingBomList
            categorizedBOM={categorizedBOM}
            hasAnyRequests={hasAnyRequests}
            activeBatchData={activeBatchData}
            orderRequests={orderRequests}
            selectedNomIds={activeSelectedSet}
            setSelectedNomIds={setSelectedNomIds || setExcludedNomIds}
            excludedNomIds={activeSelectedSet}
            setExcludedNomIds={setSelectedNomIds || setExcludedNomIds}
            boxNumbers={boxNumbers}
            setBoxNumbers={setBoxNumbers}
            customQty={customQty}
            setCustomQty={setCustomQty}
            setCustomItems={setCustomItems}
            onOpenAddItemModal={onOpenAddItemModal}
          />
        )}
      </div>

      {/* 1C DOCUMENT FOOTER BAR */}
      <div style={{
        background: '#f8fafc',
        borderTop: '1.5px solid #cbd5e1',
        padding: '8px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span>Всього позицій BOM: <strong>{allBOMItems.length}</strong></span>
          <span>Заповнено коробок: <strong>{Object.values(boxNumbers).filter(v => v?.trim()).length}</strong> із <strong>{allBOMItems.length}</strong></span>
        </div>
        <div>
          {!allBoxesFilled && isWarehouseConfirmed && !activeBatchData.isPackaged && (
            <span style={{ color: '#d97706', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={13} /> Для проведення заповніть номери коробок для всіх позицій
            </span>
          )}
          {allBoxesFilled && !activeBatchData.isPackaged && (
            <span style={{ color: '#16a34a', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Всі коробки розподілено. Готово до проведення!
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
