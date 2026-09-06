import React from 'react'
import { QrCode, Printer, Trash2 } from 'lucide-react'
import { getQR } from '../utils/supplyHelpers'

export const SupplyQrTab = ({
  nomenclatures = [],
  qrNomSearch,
  setQrNomSearch,
  selectedQrNomIds,
  setSelectedQrNomIds,
  editingQrNomId,
  setEditingQrNomId,
  editingQrCodeValue,
  setEditingQrCodeValue,
  savingQr,
  handleSaveQrCode,
  handleDeleteQrCode
}) => {
  const filteredNoms = nomenclatures.filter(n => 
    n.type !== 'finished' && n.type !== 'product' && 
    (n.name || '').toLowerCase().includes(qrNomSearch.toLowerCase())
  )
  const filteredNomsWithQr = filteredNoms.filter(n => getQR(n))
  const allSelected = filteredNomsWithQr.length > 0 && filteredNomsWithQr.every(n => selectedQrNomIds.has(n.id))

  const toggleAll = () => {
    const next = new Set(selectedQrNomIds)
    if (allSelected) {
      filteredNomsWithQr.forEach(n => next.delete(n.id))
    } else {
      filteredNomsWithQr.forEach(n => next.add(n.id))
    }
    setSelectedQrNomIds(next)
  }

  const toggleOne = (id) => {
    const next = new Set(selectedQrNomIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedQrNomIds(next)
  }

  return (
    <section className="qrcodes-col glass-panel" style={{ background: 'var(--card-bg, #111)', padding: '25px', borderRadius: '24px', border: '1px solid var(--border-color, #222)', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
            <QrCode size={20} /> ГЕНЕРАТОР ТА ДРУК QR-КОДІВ
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #555)' }}>
            Призначення унікальних кодів і друк стікерів для швидкої прийомки сканером
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            style={{ background: 'var(--card-inner-bg, #000)', border: '1px solid var(--border-color, #222)', padding: '10px 15px', borderRadius: '10px', color: 'var(--text-color, #fff)', width: '250px', outline: 'none' }}
            placeholder="Пошук номенклатури..." 
            value={qrNomSearch} 
            onChange={e => setQrNomSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedQrNomIds.size > 0 && (
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'rgba(255, 144, 0, 0.08)', border: '1px solid rgba(255, 144, 0, 0.3)', padding: '15px 25px', borderRadius: '16px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-color, #fff)' }}>
            Обрано для друку: <strong style={{ color: '#ff9000' }}>{selectedQrNomIds.size}</strong> позицій
          </span>
          <button
            onClick={() => {
              const selectedNoms = nomenclatures.filter(n => selectedQrNomIds.has(n.id) && getQR(n))
              if (selectedNoms.length === 0) return
              
              const qrWindow = window.open('', '_blank', 'width=800,height=600')
              const gridHtml = selectedNoms.map(nom => {
                const qrVal = getQR(nom)
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrVal)}`
                return `
                  <div class="label-box">
                    <div class="title">${nom.name}</div>
                    <img class="qr-image" src="${qrUrl}" alt="QR" />
                    <div class="code">${qrVal}</div>
                  </div>
                `
              }).join('')

              qrWindow.document.write(`
                <html>
                  <head>
                    <title>Друк QR-кодів</title>
                    <style>
                      body { font-family: sans-serif; margin: 0; padding: 20px; background: white; color: black; }
                      .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; }
                      .label-box { border: 1px dashed #ccc; padding: 15px; border-radius: 8px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-inside: avoid; }
                      .title { font-size: 11px; font-weight: bold; margin-bottom: 5px; max-height: 40px; overflow: hidden; }
                      .qr-image { width: 120px; height: 120px; margin: 5px 0; }
                      .code { font-size: 9px; font-family: monospace; color: #555; letter-spacing: 1px; }
                      @media print { body { padding: 0; } .label-box { border: 1px solid #ddd; } }
                    </style>
                  </head>
                  <body>
                    <div class="grid-container">${gridHtml}</div>
                    <script>
                      window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
                    </script>
                  </body>
                </html>
              `)
              qrWindow.document.close()
            }}
            style={{ background: '#ff9000', color: '#000', border: 'none', padding: '8px 18px', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}
          >
            <Printer size={16} /> ДРУКУВАТИ ОБРАНІ ({selectedQrNomIds.size})
          </button>
          <button
            onClick={() => setSelectedQrNomIds(new Set())}
            style={{ background: 'transparent', border: '1px solid var(--border-color, #333)', color: 'var(--text-muted, #888)', padding: '8px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            СКАСУВАТИ ВИДІЛЕННЯ
          </button>
        </div>
      )}

      <div className="table-responsive-container">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color, #222)', textAlign: 'left' }}>
              <th style={{ padding: '15px 10px', width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={filteredNomsWithQr.length === 0}
                  style={{ width: '16px', height: '16px', accentColor: '#ff9000', cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)' }}>НАЙМЕНУВАННЯ</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)' }}>ТИП</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)', textAlign: 'center' }}>QR-КОД</th>
              <th style={{ padding: '15px', fontSize: '0.7rem', color: 'var(--text-muted, #555)', textAlign: 'center' }}>ДІЇ</th>
            </tr>
          </thead>
          <tbody>
            {filteredNoms.map(nom => {
              const qrVal = getQR(nom)
              const isEditingThis = editingQrNomId === nom.id
              const isSelected = selectedQrNomIds.has(nom.id)
              return (
                <tr key={nom.id} style={{ borderBottom: '1px solid var(--border-color, #151515)', opacity: !qrVal && !isEditingThis ? 0.7 : 1 }}>
                  <td style={{ padding: '15px 10px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(nom.id)}
                      disabled={!qrVal}
                      style={{ width: '16px', height: '16px', accentColor: '#ff9000', cursor: qrVal ? 'pointer' : 'not-allowed' }}
                    />
                  </td>
                  <td style={{ padding: '15px', fontWeight: 700, color: 'var(--text-color, #fff)' }}>
                    {nom.name} {nom.material_type && <span style={{ color: 'var(--text-muted, #555)', fontSize: '0.75rem' }}>({nom.material_type})</span>}
                  </td>
                  <td style={{ padding: '15px', fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>
                    {nom.type === 'raw' ? 'Сировина' : nom.type === 'hardware' ? 'Метизи' : nom.type === 'consumable' ? 'Розхідник' : nom.type}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'center' }}>
                    {isEditingThis ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={editingQrCodeValue}
                          onChange={e => setEditingQrCodeValue(e.target.value)}
                          placeholder="Введіть код..."
                          style={{ background: 'var(--card-inner-bg, #000)', border: '1px solid #ff9000', color: '#fff', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', width: '150px', outline: 'none' }}
                        />
                        <button
                          onClick={() => {
                            const rand = 'NOM-' + Math.random().toString(36).substring(2, 8).toUpperCase()
                            setEditingQrCodeValue(rand)
                          }}
                          style={{ background: '#222', border: '1px solid #444', color: '#ff9000', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                        >
                          АВТО
                        </button>
                      </div>
                    ) : (
                      qrVal ? (
                        <span style={{ fontFamily: 'monospace', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900 }}>
                          {qrVal}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted, #444)', fontSize: '0.75rem' }}>не призначено</span>
                      )
                    )}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'center' }}>
                    {isEditingThis ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleSaveQrCode(nom.id, editingQrCodeValue)}
                          disabled={savingQr}
                          style={{ background: '#10b981', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 900 }}
                        >
                          {savingQr ? '...' : 'ЗБЕРЕГТИ'}
                        </button>
                        <button
                          onClick={() => setEditingQrNomId(null)}
                          style={{ background: '#222', color: '#fff', border: '1px solid #333', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          СКАСУВАТИ
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingQrNomId(nom.id)
                            setEditingQrCodeValue(qrVal || 'NOM-' + Math.random().toString(36).substring(2, 8).toUpperCase())
                          }}
                          style={{ background: 'transparent', border: '1px solid var(--border-color, #333)', color: '#ff9000', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                        >
                          {qrVal ? 'РЕДАГУВАТИ' : '+ ДОДАТИ'}
                        </button>
                        {qrVal && (
                          <button
                            type="button"
                            onClick={() => handleDeleteQrCode(nom)}
                            disabled={savingQr}
                            title="Видалити QR-код"
                            style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', cursor: savingQr ? 'wait' : 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px', opacity: savingQr ? 0.6 : 1 }}
                          >
                            <Trash2 size={13} /> ВИДАЛИТИ
                          </button>
                        )}
                        {qrVal && (
                          <button
                            onClick={() => {
                              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrVal)}`
                              const printWindow = window.open('', '_blank', 'width=400,height=400')
                              printWindow.document.write(`
                                <html>
                                  <head>
                                    <title>Друк QR-коду</title>
                                    <style>
                                      body { font-family: sans-serif; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: white; color: black; }
                                      .label { border: 2px dashed #000; padding: 15px; border-radius: 10px; display: inline-block; }
                                      .title { font-size: 14px; font-weight: bold; margin-bottom: 5px; max-width: 250px; word-wrap: break-word; }
                                      .qr-image { width: 150px; height: 150px; margin: 10px 0; }
                                      .code { font-size: 11px; font-family: monospace; color: #555; letter-spacing: 1px; }
                                      @media print { body { margin: 0; padding: 0; } .label { border: none; } }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="label">
                                      <div class="title">${nom.name}</div>
                                      <img class="qr-image" src="${qrUrl}" alt="QR" />
                                      <div class="code">${qrVal}</div>
                                    </div>
                                    <script>
                                      window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); }
                                    </script>
                                  </body>
                                </html>
                              `)
                              printWindow.document.close()
                            }}
                            style={{ background: 'transparent', border: '1px solid #10b981', color: '#10b981', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Printer size={12} /> ДРУК
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
