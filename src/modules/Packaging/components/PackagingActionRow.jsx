import React from 'react'
import { CheckCircle2, Send, Save, Package, Loader2 } from 'lucide-react'

export const PackagingActionRow = ({
  allBOMItems,
  isProcessing,
  hasAnyRequests,
  activeBatchData,
  isWarehouseConfirmed,
  boxNumbers,
  isSavingBoxes,
  allBoxesFilled,
  handleCreateRequest,
  handleSaveBoxes,
  handleCompleteClick
}) => {
  const hasAnyBoxNumber = Object.values(boxNumbers).some(v => v?.trim())
  const canSendRequest = allBOMItems.length > 0 && !isProcessing && !hasAnyRequests && !activeBatchData.isPackaged && !isWarehouseConfirmed

  return (
    <div className="action-buttons-row">
      {/* ЗАПИТ ТМЦ */}
      <button
        onClick={handleCreateRequest}
        disabled={!canSendRequest}
        style={{
          flex: 1,
          padding: '18px 20px',
          background: canSendRequest 
            ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
            : 'var(--card-header-bg, #f1f5f9)',
          color: canSendRequest ? '#ffffff' : 'var(--text-muted, #64748b)',
          border: canSendRequest ? 'none' : '1px solid var(--border-color, #cbd5e1)',
          boxShadow: canSendRequest ? '0 8px 24px rgba(37,99,235,0.25)' : 'none',
          borderRadius: '18px',
          fontWeight: 950,
          cursor: canSendRequest ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          opacity: canSendRequest ? 1 : 0.85,
          transition: '0.3s'
        }}
      >
        {isWarehouseConfirmed ? (
          <><CheckCircle2 size={20} color="#059669" /> ТМЦ ОТРИМАНО (СКЛАД ПІДТВЕРДИВ)</>
        ) : hasAnyRequests ? (
          <><CheckCircle2 size={20} color="#059669" /> ЗАПИТ ТМЦ ВІДПРАВЛЕНО</>
        ) : (
          <><Send size={20} color={canSendRequest ? '#fff' : '#2563eb'} /> СФОРМУВАТИ ЗАПИТ ТМЦ</>
        )}
      </button>

      {/* ЗБЕРЕГТИ КОРОБКИ */}
      {isWarehouseConfirmed && !activeBatchData.isPackaged && (
        <button
          onClick={handleSaveBoxes}
          disabled={isSavingBoxes || !hasAnyBoxNumber}
          style={{
            flex: 1,
            padding: '18px 20px',
            background: hasAnyBoxNumber ? 'rgba(244, 63, 94, 0.12)' : 'var(--card-header-bg, #f1f5f9)',
            color: hasAnyBoxNumber ? '#e11d48' : 'var(--text-muted, #94a3b8)',
            border: `1.5px solid ${hasAnyBoxNumber ? 'rgba(244, 63, 94, 0.35)' : 'var(--border-color, #cbd5e1)'}`,
            borderRadius: '18px',
            fontWeight: 950,
            cursor: hasAnyBoxNumber && !isSavingBoxes ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            transition: '0.3s'
          }}
        >
          {isSavingBoxes ? (
            <><Loader2 size={20} className="anim-spin" /> ЗБЕРЕЖЕННЯ КОРОБОК...</>
          ) : (
            <><Save size={20} /> ЗБЕРЕГТИ КОРОБКИ В БАЗУ</>
          )}
        </button>
      )}

      {/* ЗАВЕРШИТИ ПАКУВАННЯ */}
      <button
        onClick={handleCompleteClick}
        disabled={isProcessing || activeBatchData.isPackaged || !allBoxesFilled}
        style={{
          flex: 1.2,
          padding: '18px 20px',
          background: allBoxesFilled && !activeBatchData.isPackaged 
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
            : 'var(--card-header-bg, #f1f5f9)',
          color: allBoxesFilled && !activeBatchData.isPackaged ? '#ffffff' : 'var(--text-muted, #94a3b8)',
          border: allBoxesFilled && !activeBatchData.isPackaged ? 'none' : '1px solid var(--border-color, #cbd5e1)',
          borderRadius: '18px',
          fontWeight: 950,
          cursor: (allBoxesFilled && !isProcessing && !activeBatchData.isPackaged) ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          boxShadow: allBoxesFilled && !activeBatchData.isPackaged ? '0 10px 30px rgba(16,185,129,0.3)' : 'none',
          opacity: allBoxesFilled && !activeBatchData.isPackaged ? 1 : 0.85,
          transition: '0.3s'
        }}
      >
        {activeBatchData.isPackaged ? (
          <><CheckCircle2 size={20} color="#059669" /> ЗАПАКОВАНО</>
        ) : isProcessing ? (
          <><Loader2 size={20} className="anim-spin" /> ЗБЕРЕЖЕННЯ...</>
        ) : (
          <><Package size={20} color={allBoxesFilled ? '#fff' : 'var(--text-muted, #64748b)'} /> ЗАВЕРШИТИ ПАКУВАННЯ</>
        )}
      </button>
    </div>
  )
}

