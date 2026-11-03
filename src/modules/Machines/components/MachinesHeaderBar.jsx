import React from 'react'
import { Camera, Plus, X, Wrench, Printer } from 'lucide-react'
import { MACHINE_TYPES } from '../hooks/useMachinesData.js'

export function MachinesHeaderBar({
  setIsScanning,
  showAdd,
  setShowAdd,
  setForm,
  onOpenGlobalMaintenance,
  onOpenBatchQrPrint
}) {
  const handleToggleAdd = () => {
    setShowAdd(!showAdd)
    if (!showAdd) {
      setForm({
        id: null,
        name: '',
        type: MACHINE_TYPES[0],
        capacity: '1',
        sequence_number: '',
        inventory_no: '',
        floor: '',
        description: '',
        status: 'idle'
      })
    }
  }

  return (
    <div className="machines-header-bar">
      <div className="machines-header-title-box">
        <h2 className="machines-header-title">МОНІТОР ВЕРСТАТІВ</h2>
        <p className="machines-header-subtitle">Контроль завантаженості та технічні дані</p>
      </div>

      <div className="machines-header-actions">
        <button 
          type="button"
          onClick={() => setIsScanning(true)}
          className="machines-action-btn machines-btn-scan"
          title="Сканувати QR-код верстата для швидкого відкриття досьє або замовлень"
        >
          <Camera size={18} />
          <span>СКАНУВАТИ QR</span>
        </button>

        <button 
          type="button"
          onClick={handleToggleAdd}
          className={`machines-action-btn ${showAdd ? 'machines-btn-cancel' : 'machines-btn-add'}`}
          title={showAdd ? 'Скасувати створення верстата' : 'Додати новий верстат'}
        >
          {showAdd ? <X size={18} /> : <Plus size={18} />}
          <span>{showAdd ? 'СКАСУВАТИ' : 'НОВИЙ ВЕРСТАТ'}</span>
        </button>

        <button 
          type="button"
          onClick={onOpenBatchQrPrint}
          className="machines-action-btn machines-btn-secondary"
          title="Друк QR-кодів верстатів (по 6, 8 або 4 на аркуш А4)"
        >
          <Printer size={18} />
          <span>ДРУК QR</span>
        </button>

        <button 
          type="button"
          onClick={onOpenGlobalMaintenance}
          className="machines-action-btn machines-btn-secondary"
          title="Загальний журнал ТО та обслуговування верстатів"
        >
          <Wrench size={18} />
          <span>ЖУРНАЛ ТО</span>
        </button>
      </div>
    </div>
  )
}
