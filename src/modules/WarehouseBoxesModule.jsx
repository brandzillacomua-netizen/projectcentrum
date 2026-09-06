import React from 'react'
import { Warehouse as WarehouseIcon, ArrowLeft, Search, Check, AlertCircle, Box, QrCode, ChevronDown, Layers3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ScannerPanel } from './Warehouse/components/ScannerPanel.jsx'
import { KittingModal } from './Warehouse/components/KittingModal.jsx'
import { MaterialDetailModal } from './Warehouse/components/MaterialDetailModal.jsx'
import { ManualInventoryIssueUI, ManualIssueJournalButton } from './Warehouse/ManualIssue/ManualInventoryIssueUI.jsx'
import { useWarehouseBoxesData } from './Warehouse/hooks/useWarehouseBoxesData.jsx'

const WarehouseBoxesModule = () => {
  const {
    nomenclatures,
    checkedCutters,
    searchQuery,
    setSearchQuery,
    isProcessing,
    isScanning,
    setIsScanning,
    cameraError,
    manualCardInput,
    setManualCardInput,
    kittingBoxItem,
    setKittingBoxItem,
    scannedCard,
    setScannedCard,
    scannedRequests,
    setScannedRequests,
    selectedOrderNum,
    setSelectedOrderNum,
    filterStatus,
    setFilterStatus,
    checkedSheets,
    setCheckedSheets,
    expandedGroups,
    isMobile,
    handlers,
    manualIssue,
    allBoxes,
    filteredBoxes,
    orderList,
    nomenclatureGroups,
    toggleGroup,
    handleBoxCardScan
  } = useWarehouseBoxesData()

  return (
    <div className="warehouse-boxes-module" style={{ background: '#080808', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header */}
      <nav style={{
        flexShrink: 0,
        padding: isMobile ? '12px 15px' : '15px 25px',
        background: '#111',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #222',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '20px' }}>
          <Link to="/" style={{ color: '#aaa', transition: '0.2s', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
            <span style={{ marginLeft: '4px', fontSize: '0.8rem', fontWeight: 600 }}>Назад</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <WarehouseIcon size={18} style={{ color: '#ff9000' }} />
            <h1 style={{ margin: 0, fontSize: isMobile ? '0.95rem' : '1.2rem', fontWeight: 900 }}>
              БОКСИ ФРЕЗ
            </h1>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ManualIssueJournalButton onClick={manualIssue.openJournal} compact={isMobile} />
          <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontWeight: 950 }}>
            ЗІБРАНО: {allBoxes.filter(b => b.isPrepared).length}/{allBoxes.length}
          </span>
          <span style={{ fontSize: '0.68rem', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '3px 8px', borderRadius: '6px', fontWeight: 950 }}>
            ВИДАНО: {allBoxes.filter(b => b.isIssued).length}/{allBoxes.length}
          </span>
        </div>
      </nav>

      {/* Camera Scanner Overlay Panel */}
      <ScannerPanel
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        cameraError={cameraError}
        manualCardInput={manualCardInput}
        setManualCardInput={setManualCardInput}
        handleCardScan={handleBoxCardScan}
      />

      <ManualInventoryIssueUI controller={manualIssue} />

      {/* Kitting Modal (opens upon successful scan) */}
      <KittingModal
        kittingBoxItem={kittingBoxItem}
        setKittingBoxItem={setKittingBoxItem}
        checkedCutters={checkedCutters}
        handleToggleCutterCheck={handlers.handleToggleCutterCheck}
        handlePrepareBox={handlers.handlePrepareBox}
        isProcessing={isProcessing}
      />

      <MaterialDetailModal
        scannedCard={scannedCard}
        setScannedCard={setScannedCard}
        scannedRequests={scannedRequests}
        setScannedRequests={setScannedRequests}
        nomenclatures={nomenclatures}
        isIssuingCard={isProcessing}
        handleIssueCardMaterials={handlers.handleIssueCardMaterials}
      />

      {/* Workspace */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
        
        {/* SIDEBAR: (Only rendered on Desktop) */}
        {!isMobile && (
          <aside style={{
            width: '260px',
            background: '#0d0d0d',
            borderRight: '1px solid #1a1a1a',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Черга нарядів</span>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              <button
                onClick={() => setSelectedOrderNum('all')}
                style={{
                  width: '100%',
                  background: selectedOrderNum === 'all' ? 'rgba(255, 144, 0, 0.08)' : 'transparent',
                  border: selectedOrderNum === 'all' ? '1px solid rgba(255, 144, 0, 0.3)' : '1px solid transparent',
                  borderRadius: '12px',
                  padding: '12px 15px',
                  color: selectedOrderNum === 'all' ? '#ff9000' : '#888',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '5px',
                  transition: 'all 0.15s'
                }}
              >
                <span>Усі наряди</span>
                <span style={{ background: '#181818', color: '#aaa', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px' }}>{allBoxes.length}</span>
              </button>

              {orderList.map(ord => (
                <button
                  key={ord.orderNum}
                  onClick={() => setSelectedOrderNum(ord.orderNum)}
                  style={{
                    width: '100%',
                    background: selectedOrderNum === ord.orderNum ? 'rgba(255, 144, 0, 0.08)' : 'transparent',
                    border: selectedOrderNum === ord.orderNum ? '1px solid rgba(255, 144, 0, 0.3)' : '1px solid transparent',
                    borderRadius: '12px',
                    padding: '12px 15px',
                    color: selectedOrderNum === ord.orderNum ? '#ff9000' : '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '5px',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span>#{ord.orderNum}</span>
                    <span style={{ fontSize: '0.65rem', color: ord.pending > 0 ? '#ff9000' : ord.issued === ord.total ? '#3b82f6' : '#10b981', fontWeight: 600 }}>
                      {ord.pending > 0 
                        ? `Очікує збірки: ${ord.pending} шт` 
                        : ord.issued === ord.total 
                          ? 'Усі видано' 
                          : `Зібрано: ${ord.prepared}/${ord.total} (Видано: ${ord.issued})`}
                    </span>
                  </div>
                  <span style={{ background: '#181818', color: '#666', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px' }}>{ord.total}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* MAIN PANEL */}
        <main style={{ flex: 1, padding: isMobile ? '12px' : '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          
          {/* Controls Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            
            {/* Mobile Order Selector Dropdown */}
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.6rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>Активний Наряд</span>
                <select
                  value={selectedOrderNum}
                  onChange={e => setSelectedOrderNum(e.target.value)}
                  style={{
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: '10px',
                    padding: '10px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    outline: 'none'
                  }}
                >
                  <option value="all">Усі наряди ({allBoxes.length} шт)</option>
                  {orderList.map(ord => (
                    <option key={ord.orderNum} value={ord.orderNum}>
                      #{ord.orderNum} ({ord.pending > 0 ? `Очікує: ${ord.pending}` : 'Зібрано'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              {/* Status Tabs */}
              <div style={{ display: 'flex', background: '#111', padding: '3px', borderRadius: '10px', border: '1px solid #222', flex: 1, maxWidth: isMobile ? 'none' : 'fit-content' }}>
                <button
                  onClick={() => setFilterStatus('pending')}
                  style={{
                    flex: 1,
                    background: filterStatus === 'pending' ? '#ff9000' : 'transparent',
                    color: filterStatus === 'pending' ? '#000' : '#888',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <AlertCircle size={12} />
                  Очікують
                </button>
                <button
                  onClick={() => setFilterStatus('prepared')}
                  style={{
                    flex: 1,
                    background: filterStatus === 'prepared' ? '#ff9000' : 'transparent',
                    color: filterStatus === 'prepared' ? '#000' : '#888',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Check size={12} />
                  Зібрані
                </button>
              </div>

              {/* Search Input */}
              <div style={{ position: 'relative', flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : '260px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                <input
                  type="text"
                  placeholder="Пошук..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: '10px',
                    padding: '8px 12px 8px 32px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Nomenclature accordions */}
          {filteredBoxes.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #222', borderRadius: '16px', padding: '40px 20px' }}>
              <Box size={32} style={{ color: '#333', marginBottom: '10px' }} />
              <span style={{ color: '#555', fontSize: '0.78rem', fontWeight: 600 }}>Немає відповідних боксів</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '14px', paddingBottom: isMobile ? '86px' : '20px' }}>
              {nomenclatureGroups.map(group => {
                const isExpanded = !!expandedGroups[group.key]
                const progress = group.items.length ? Math.round((group.prepared / group.items.length) * 100) : 0

                return (
                  <section
                    key={group.key}
                    style={{
                      background: '#0e0e0e',
                      border: isExpanded ? '1px solid rgba(255, 144, 0, 0.32)' : '1px solid #242424',
                      borderRadius: isMobile ? '14px' : '16px',
                      overflow: 'hidden',
                      boxShadow: isExpanded ? '0 8px 28px rgba(0,0,0,0.28)' : 'none'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      aria-expanded={isExpanded}
                      style={{
                        width: '100%',
                        minHeight: isMobile ? '72px' : '78px',
                        padding: isMobile ? '12px' : '14px 18px',
                        border: 'none',
                        background: isExpanded ? 'rgba(255, 144, 0, 0.055)' : '#111',
                        color: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                        alignItems: 'center',
                        gap: isMobile ? '10px' : '14px'
                      }}
                    >
                      <span style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '11px', display: 'grid', placeItems: 'center', background: group.pending ? 'rgba(255,144,0,.12)' : 'rgba(16,185,129,.12)', color: group.pending ? '#ff9000' : '#10b981' }}>
                        <Layers3 size={19} />
                      </span>
                      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        <strong style={{ fontSize: isMobile ? '0.82rem' : '0.9rem', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {group.name}
                        </strong>
                        <span style={{ height: '4px', borderRadius: '99px', background: '#252525', overflow: 'hidden' }}>
                          <span style={{ display: 'block', width: `${progress}%`, height: '100%', borderRadius: 'inherit', background: progress === 100 ? '#10b981' : '#ff9000', transition: 'width .25s ease' }} />
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', whiteSpace: 'nowrap' }}>
                          <strong style={{ fontSize: '0.78rem', color: group.items.filter(b => b.isIssued).length === group.items.length ? '#3b82f6' : group.pending ? '#ff9000' : '#10b981' }}>
                            Зібр: {group.prepared}/{group.items.length} • Вид: {group.items.filter(b => b.isIssued).length}
                          </strong>
                          <span style={{ fontSize: '0.54rem', color: '#777', fontWeight: 800, textTransform: 'uppercase' }}>статус комплектації</span>
                        </span>
                        <ChevronDown size={19} style={{ color: '#888', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
                      </span>
                    </button>

                    {isExpanded && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                        gap: isMobile ? '10px' : '14px',
                        padding: isMobile ? '10px' : '14px',
                        borderTop: '1px solid #242424'
                      }}>
                        {group.items.map(boxItem => {
                          const cardId = boxItem.card.id
                          const isAllChecked = boxItem.cutters.every(c => checkedCutters[cardId]?.[c.nomenclature_id])
                          const isSheetChecked = !!checkedSheets[cardId] || boxItem.isPrepared
                          const canSubmit = isAllChecked && isSheetChecked

                          return (
                            <div
                              key={cardId}
                              style={{
                                background: boxItem.isPrepared ? 'rgba(16, 185, 129, 0.01)' : '#111',
                                border: boxItem.isPrepared ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #222',
                                borderRadius: '16px',
                                padding: isMobile ? '14px' : '18px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                              }}
                            >
                              {/* Card Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
                                <div>
                                  <div style={{ fontSize: '0.62rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase' }}>
                                    НАРЯД #{boxItem.orderNum}
                                  </div>
                                  <strong style={{ fontSize: '0.95rem', color: '#fff' }}>Картка {boxItem.cardNum}</strong>
                                </div>
                                
                                {boxItem.isIssued ? (
                                  <span style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', padding: '3px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 950 }}>
                                    ВИДАНО
                                  </span>
                                ) : boxItem.isPrepared ? (
                                  <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900 }}>
                                    ЗІБРАНО
                                  </span>
                                ) : (
                                  <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '3px 8px', borderRadius: '6px', fontSize: '0.62rem', fontWeight: 900 }}>
                                    ОЧІКУЄ
                                  </span>
                                )}
                              </div>

                              {/* Part name */}
                              <div>
                                <div style={{ fontSize: '0.58rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Деталь</div>
                                <div style={{ fontSize: '0.78rem', color: '#ccc', fontWeight: 700, marginTop: '2px', wordBreak: 'break-all', whiteSpace: 'normal' }}>
                                  {boxItem.partName}
                                </div>
                              </div>

                              {/* Machine and sheets count */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#0a0a0a', padding: '8px 12px', borderRadius: '10px', border: '1px solid #1a1a1a' }}>
                                <div>
                                  <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 800 }}>ВЕРСТАТ</div>
                                  <div style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 700 }}>{boxItem.card.machine || '—'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: 800 }}>ЛИСТИ</div>
                                  <div style={{ fontSize: '0.72rem', color: '#ff9000', fontWeight: 900 }}>{boxItem.cardSheets} л.</div>
                                </div>
                              </div>

                              {/* Filling Checklists */}
                              <div>
                                <div style={{ fontSize: '0.6rem', color: '#888', fontWeight: 800, marginBottom: '6px' }}>СПИСОК НАПОВНЕННЯ:</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {/* Sheets check */}
                                  <div 
                                    onClick={() => !boxItem.isPrepared && setCheckedSheets(prev => ({ ...prev, [cardId]: !prev[cardId] }))}
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between', 
                                      background: isSheetChecked ? 'rgba(16, 185, 129, 0.04)' : '#0a0a0a', 
                                      padding: '8px 12px', 
                                      borderRadius: '8px', 
                                      border: isSheetChecked ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #222',
                                      cursor: boxItem.isPrepared ? 'default' : 'pointer'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={isSheetChecked}
                                        disabled={boxItem.isPrepared}
                                        onChange={() => {}} 
                                        style={{ cursor: boxItem.isPrepared ? 'default' : 'pointer' }}
                                      />
                                      <span style={{ fontSize: '0.7rem', color: isSheetChecked ? '#aaa' : '#fff' }}>
                                        {boxItem.activeMaterialName}
                                      </span>
                                    </div>
                                    <strong style={{ fontSize: '0.72rem', color: isSheetChecked ? '#10b981' : '#fff' }}>
                                      {boxItem.cardSheets} л.
                                    </strong>
                                  </div>

                                  {/* Cutters checks */}
                                  {boxItem.cutters.map(cutter => {
                                    const isChecked = !!checkedCutters[cardId]?.[cutter.nomenclature_id] || boxItem.isPrepared
                                    return (
                                      <div 
                                        key={cutter.nomenclature_id}
                                        onClick={() => !boxItem.isPrepared && handlers.handleToggleCutterCheck(cardId, cutter.nomenclature_id)}
                                        style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'space-between', 
                                          background: isChecked ? 'rgba(16, 185, 129, 0.04)' : '#0a0a0a', 
                                          padding: '8px 12px', 
                                          borderRadius: '8px', 
                                          border: isChecked ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid #222',
                                          cursor: boxItem.isPrepared ? 'default' : 'pointer'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <input 
                                            type="checkbox" 
                                            checked={isChecked}
                                            disabled={boxItem.isPrepared}
                                            onChange={() => {}} 
                                            style={{ cursor: boxItem.isPrepared ? 'default' : 'pointer' }}
                                          />
                                          <span style={{ fontSize: '0.7rem', color: isChecked ? '#aaa' : '#fff', wordBreak: 'break-word', whiteSpace: 'normal', display: 'inline-block' }}>
                                            {cutter.name}
                                          </span>
                                        </div>
                                        <strong style={{ fontSize: '0.72rem', color: isChecked ? '#10b981' : '#fff', whiteSpace: 'nowrap' }}>
                                          {cutter.qty} шт
                                        </strong>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Save Button */}
                              {!boxItem.isPrepared && (
                                <button
                                  disabled={isProcessing || !canSubmit}
                                  onClick={() => handlers.handlePrepareBox(boxItem, null)}
                                  style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: canSubmit ? '#ff9000' : '#1a1a1a',
                                    color: canSubmit ? '#000' : '#555',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 900,
                                    fontSize: '0.75rem',
                                    cursor: (isProcessing || !canSubmit) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    marginTop: '2px'
                                  }}
                                >
                                  {!isAllChecked || !isSheetChecked 
                                    ? 'Позначте вміст' 
                                    : `Завершити комплектацію боксу`
                                  }
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Button (FAB) Scanner Widget */}
      <button
        type="button"
        onClick={() => setIsScanning(true)}
        style={{
          position: 'fixed',
          bottom: '25px',
          right: '25px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff9000, #e68000)',
          color: '#000',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 30px rgba(255, 144, 0, 0.35), 0 0 15px rgba(255, 144, 0, 0.2)',
          zIndex: 850,
          transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 12px 35px rgba(255, 144, 0, 0.45)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1) translateY(0)'
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 144, 0, 0.35)'
        }}
      >
        <QrCode size={26} strokeWidth={2.5} />
      </button>
    </div>
  )
}

export default WarehouseBoxesModule
