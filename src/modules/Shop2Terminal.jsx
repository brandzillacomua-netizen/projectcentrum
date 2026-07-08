import React, { useState, useEffect } from 'react'
import { useScrapReasons } from '../hooks/useScrapReasons'
import {
  Tablet, ArrowLeft, Play, CheckCircle, Scan, Timer, AlertTriangle,
  X, ClipboardList, Camera, Menu, RefreshCw, Box, Layers, Gauge, Package, Eye, Search, QrCode
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'
import { supabase } from '../supabase'

const cyrillicToLatinMap = {
  'й':'q', 'ц':'w', 'у':'e', 'к':'r', 'е':'t', 'н':'y', 'г':'u', 'ш':'i', 'щ':'o', 'з':'p', 'х':'[', 'ї':']',
  'ф':'a', 'ы':'s', 'і':'s', 'в':'d', 'а':'f', 'п':'g', 'р':'h', 'о':'j', 'л':'k', 'д':'l', 'ж':';', 'є':'\'',
  'я':'z', 'ч':'x', 'с':'c', 'м':'v', 'и':'b', 'т':'n', 'ь':'m', 'б':',', 'ю':'.', '.':'/',
  'Й':'Q', 'Ц':'W', 'У':'E', 'К':'R', 'Е':'T', 'Н':'Y', 'Г':'U', 'Ш':'I', 'Щ':'O', 'З':'P', 'Х':'{', 'Ї':'}',
  'Ф':'A', 'Ы':'S', 'І':'S', 'В':'D', 'А':'F', 'П':'G', 'Р':'H', 'О':'J', 'Л':'K', 'Д':'L', 'Ж':':', 'Є':'"',
  'Я':'Z', 'Ч':'X', 'С':'C', 'М':'V', 'И':'B', 'Т':'N', 'Ь':'M', 'Б':'<', 'Ю':'>', ',':'?',
  '?':'/', 'ё':'`', 'Ё':'~', '№':'#'
}

const translateCyrillic = (str) => {
  return String(str || '').split('').map(char => cyrillicToLatinMap[char] || char).join('')
}

const Shop2Terminal = () => {
  const { names: scrapReasons } = useScrapReasons()

  const handleManualEntry = async (e) => {
    if (e) e.preventDefault()
    if (!manualId) return

    const cleanInput = translateCyrillic(manualId.trim()).replace('CENTRUM_CARD_', '').replace('#', '').trim()

    const isMachineQR = await handleMachineQRScan(cleanInput)
    if (isMachineQR) {
      setManualId('')
      setIsScanning(false)
      return
    }

    setIsProcessing(true)

    let card = workCards.find(c => 
      c.card_info?.includes('[ЦЕХ №2]') && (
        String(c.id).trim() === cleanInput || 
        String(c.id).toUpperCase().startsWith(cleanInput.toUpperCase()) ||
        String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())
      )
    )
    
    if (!card) {
      if (typeof fetchData === 'function') {
        try { await fetchData(['work_cards']) } catch (e) { }
      }
      card = workCards.find(c => 
        c.card_info?.includes('[ЦЕХ №2]') && (
          String(c.id).trim() === cleanInput || 
          String(c.id).toUpperCase().startsWith(cleanInput.toUpperCase()) ||
          String(c.id).toUpperCase().endsWith(cleanInput.toUpperCase())
        )
      )
    }

    if (!card) {
      setScanError(`Картку №${cleanInput} не знайдено в Цеху №2`)
    } else {
      setScannedCardIds(prev => prev.includes(card.id) ? prev : [...prev, card.id])
      setSelectedCardId(card.id)
      setManualId('')
      setIsScanning(false)
      setScanError(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setIsProcessing(false)
  }

  const { workCards, orders, nomenclatures, inventory, startWorkCard, confirmBuffer, fetchData, refreshTable, operators, getFilteredOperators, getFilteredManagers, managers, workCardHistory, handoverToSGP, currentUser, systemUsers, tasks } = useMES()
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [manualId, setManualId] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [scanError, setScanError] = useState(null)

  const [selectedCallMasterId, setSelectedCallMasterId] = useState('')
  const [selectedCallEngineerId, setSelectedCallEngineerId] = useState('')
  const [selectedCallQCId, setSelectedCallQCId] = useState('')

  const callMasters = (systemUsers || []).filter(u => u.access_rights?.master || u.access_rights?.foreman || (u.position && u.position.toLowerCase().includes('майстер')))
  const callEngineers = (systemUsers || []).filter(u => u.access_rights?.engineer || (u.position && u.position.toLowerCase().includes('інженер')))
  const callQCs = (systemUsers || []).filter(u => u.access_rights?.brak || (u.position && (u.position.toLowerCase().includes('вкя') || u.position.toLowerCase().includes('якост'))))

  const [scannedCardIds, setScannedCardIds] = useState(() => {
    try { const saved = localStorage.getItem('centrum_shop2_scanned'); return saved ? JSON.parse(saved) : [] }
    catch (e) { return [] }
  })

  const [isScanning, setIsScanning] = useState(false)
  const [showScrapModal, setShowScrapModal] = useState(false)
  const [scrapCounts, setScrapCounts] = useState({})
  const [detailStage, setDetailStage] = useState(null)
  const [detailTab, setDetailTab] = useState('work')
  const [showStorageExplorer, setShowStorageExplorer] = useState(false)
  const [activeExplorerTab, setActiveExplorerTab] = useState('semi')
  // Admin Manual Card State
  const isAdmin = currentUser?.position === 'Адмін' || currentUser?.role === 'admin'
  const [showAdminCardModal, setShowAdminCardModal] = useState(false)
  const [adminNomId, setAdminNomId] = useState('')
  const [adminTaskId, setAdminTaskId] = useState('')
  const [adminQty, setAdminQty] = useState('')
  const [adminStage, setAdminStage] = useState('Пресування')
  const [nomSearchText, setNomSearchText] = useState('')
  const [showNomDropdown, setShowNomDropdown] = useState(false)

  const handleCreateAdminCard = async () => {
    if (!adminNomId) {
      alert('Будь ласка, оберіть номенклатуру!')
      return
    }
    const finalQty = Number(adminQty) || 0
    if (finalQty <= 0) {
      alert('Кількість має бути більшою за 0!')
      return
    }

    setIsProcessing(true)
    try {
      let selectedTask = null
      let selectedOrder = null
      if (adminTaskId) {
        selectedTask = tasks.find(t => String(t.id) === String(adminTaskId))
        if (selectedTask) {
          selectedOrder = orders.find(o => String(o.id) === String(selectedTask.order_id))
        }
      }

      const orderNum = selectedOrder?.order_num || ''
      const batchIndexText = selectedTask?.batch_index ? `/${selectedTask.batch_index}` : ''
      const orderText = orderNum ? ` Наряд №${orderNum}${batchIndexText}` : ''

      const payload = {
        task_id: adminTaskId || null,
        order_id: selectedTask?.order_id || null,
        nomenclature_id: adminNomId,
        quantity: finalQty,
        operation: adminStage,
        status: 'new',
        machine: '—',
        is_rework: false,
        estimated_time: 0,
        card_info: `[ЦЕХ №2] [ADMIN_MANUAL] [NEED:0] [BZ:0] [РУЧНИЙ ЗАПУСК]${orderText}`
      }

      const { data, error } = await supabase.from('work_cards').insert([payload]).select().single()
      if (error) throw error

      alert(`Картку запуску в Цеху №2 на ${finalQty} шт. створено успішно!`)
      setShowAdminCardModal(false)
      setAdminNomId('')
      setAdminTaskId('')
      setAdminQty('')
      setAdminStage('Пресування')
      setNomSearchText('')
      setShowNomDropdown(false)

      if (typeof fetchData === 'function') {
        await fetchData(['work_cards'])
      }
    } catch (err) {
      alert('Помилка створення картки: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const renderAdminCardModal = () => {
    if (!showAdminCardModal) return null
    const parts = (nomenclatures || []).filter(n => n.type === 'part').sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    const activeShop2Tasks = (tasks || [])
      .filter(t => t.status !== 'completed' && (t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання')))
      .map(t => {
        const o = orders.find(ord => ord.id === t.order_id)
        return {
          id: t.id,
          label: `Наряд №${o?.order_num || '—'}${t.batch_index ? `/${t.batch_index}` : ''} (${o?.customer || '—'})`
        }
      })

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10030, padding: '20px', backdropFilter: 'blur(6px)' }}>
        <div style={{ background: '#111', width: '100%', maxWidth: '550px', borderRadius: '30px', border: '1px solid #333', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181818', borderBottom: '1px solid #222' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 950, color: '#8b5cf6', letterSpacing: '0.5px' }}>СТВОРЕННЯ КАРТКИ ЦЕХУ №2 (АДМІН)</h3>
            <button onClick={() => { setShowAdminCardModal(false); setNomSearchText(''); setShowNomDropdown(false); }} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' }}><X size={24} /></button>
          </div>
          <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ position: 'relative' }}>
              <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Номенклатура (деталь) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="🔍 Оберіть або почніть писати назву деталі..."
                  value={nomSearchText}
                  onFocus={() => setShowNomDropdown(true)}
                  onChange={e => {
                    setNomSearchText(e.target.value)
                    setShowNomDropdown(true)
                    const match = parts.find(p => p.name === e.target.value)
                    if (match) setAdminNomId(match.id)
                    else setAdminNomId('')
                  }}
                  style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', paddingRight: '40px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}
                />
                <div
                  onClick={() => setShowNomDropdown(!showNomDropdown)}
                  style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#8b5cf6', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 900 }}
                >
                  ▼
                </div>
              </div>

              {showNomDropdown && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10039 }} onClick={() => setShowNomDropdown(false)} />
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#111', border: '1px solid #333', borderRadius: '12px', marginTop: '5px', maxHeight: '200px', overflowY: 'auto', zIndex: 10040, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                    {parts.filter(p =>
                      (p.name || '').toLowerCase().includes(nomSearchText.toLowerCase()) ||
                      (p.nomenclature_code || '').toLowerCase().includes(nomSearchText.toLowerCase())
                    ).map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setAdminNomId(p.id)
                          setNomSearchText(p.name)
                          setShowNomDropdown(false)
                        }}
                        style={{ padding: '12px', cursor: 'pointer', fontSize: '0.85rem', color: '#fff', borderBottom: '1px solid #222', background: adminNomId === p.id ? '#8b5cf633' : 'transparent', transition: 'background 0.2s' }}
                      >
                        {p.name} {p.nomenclature_code ? `(${p.nomenclature_code})` : ''}
                      </div>
                    ))}
                    {parts.filter(p =>
                      (p.name || '').toLowerCase().includes(nomSearchText.toLowerCase()) ||
                      (p.nomenclature_code || '').toLowerCase().includes(nomSearchText.toLowerCase())
                    ).length === 0 && (
                      <div style={{ padding: '12px', color: '#555', textAlign: 'center', fontSize: '0.85rem' }}>Нічого не знайдено</div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div>
              <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Наряд / Наказ (необов'язково)</label>
              <select value={adminTaskId} onChange={e => setAdminTaskId(e.target.value)} style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}>
                <option value="">— Без прив'язки до наряду (загальний запас) —</option>
                {activeShop2Tasks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Кількість деталей *</label>
                <input type="number" value={adminQty} onChange={e => setAdminQty(e.target.value)} placeholder="0" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }} />
              </div>
              <div>
                <label style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Технологічний етап *</label>
                <select value={adminStage} onChange={e => setAdminStage(e.target.value)} style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}>
                  <option value="Пресування">Пресування</option>
                  <option value="Фарбування">Фарбування</option>
                  <option value="Доопрацювання">Доопрацювання</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
              <button onClick={() => { setShowAdminCardModal(false); setNomSearchText(''); setShowNomDropdown(false); }} style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#888', padding: '14px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>СКАСУВАТИ</button>
              <button disabled={isProcessing} onClick={handleCreateAdminCard} style={{ flex: 1, background: '#8b5cf6', color: '#fff', border: 'none', padding: '14px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}>СТВОРІТИ КАРТКУ</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Корекція браку ВКЯ
  const [showQCModal, setShowQCModal] = useState(false)
  const [qcScrapCount, setQcScrapCount] = useState(0)
  const [qcInspector, setQcInspector] = useState('')
  const [qcReason, setQcReason] = useState('Биття цанги')
  const [qcCustomReason, setQcCustomReason] = useState('')

  // Етапи лише для Цеху №2
  const shop2Stages = ['Пресування', 'Фарбування', 'Доопрацювання']

  // Emergency Machine Call Modal state
  const [machineCallModal, setMachineCallModal] = useState(null)
  const [machineCallSuccess, setMachineCallSuccess] = useState('')

  const handleMachineQRScan = async (text) => {
    const cleanText = translateCyrillic(text)
    const match = String(cleanText || '').match(/\/machines\/([a-f0-9-]+)\/call/i)
    if (match) {
      const machineId = match[1]
      try {
        const { data: mData, error } = await supabase.from('machines').select('*').eq('id', machineId).maybeSingle()
        if (mData) {
          setMachineCallModal({
            id: mData.id,
            name: mData.name,
            type: mData.type,
            sequence_number: mData.sequence_number,
            floor: mData.floor,
            inventory_no: mData.inventory_no
          })
        } else {
          alert('Верстат з таким ID не знайдено в базі.')
        }
      } catch (err) {
        console.error(err)
      }
      return true
    }
    return false
  }

  const handleCreateCall = async (role, employeeId = null) => {
    try {
      const operatorName = selectedOperator || 'Оператор терміналу'
      const emp = (systemUsers || []).find(u => u.id === employeeId)
      const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : null
      const { error } = await supabase.from('machine_calls').insert({
        machine_id: machineCallModal.id,
        called_role: role === 'qc' ? 'quality' : role, // Map 'qc' to 'quality' for DB consistency
        operator_name: operatorName,
        called_employee_id: employeeId || null,
        called_employee_name: empName || null,
        status: 'pending'
      })
      if (error) throw error
      const label = role === 'master' ? 'Майстра' : role === 'engineer' ? 'Інженера' : 'ВКЯ'
      setMachineCallSuccess(`Виклик для ${label} надіслано!`)
      setTimeout(() => {
        setMachineCallSuccess('')
        setMachineCallModal(null)
      }, 2000)
    } catch (err) {
      alert('Помилка надсилання виклику: ' + err.message)
    }
  }

  useEffect(() => {
    if (!machineCallModal) {
      setSelectedCallMasterId('')
      setSelectedCallEngineerId('')
      setSelectedCallQCId('')
    }
  }, [machineCallModal])

  useEffect(() => { localStorage.setItem('centrum_shop2_scanned', JSON.stringify(scannedCardIds)) }, [scannedCardIds])
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer) }, [])

  // Скидаємо вибір етапу та підставляємо майстра при зміні карти
  useEffect(() => {
    const card = workCards.find(c => String(c.id) === String(selectedCardId))
    if (card) {
      setSelectedStage(card.operation || '')
      const fullName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ')
      const displayName = fullName || currentUser?.login || ''
      const managerName = currentUser?.position ? `${displayName} (${currentUser.position})` : displayName
      if (managerName) setSelectedManager(managerName)
      
      setSelectedShift('')
      setSelectedOperator('')
    } else {
      setSelectedShift('')
      setSelectedOperator('')
    }

    // Скидаємо поля БРАК ВКЯ при кожній зміні картки
    setShowQCModal(false)
    setQcScrapCount(0)
    setQcInspector('')
    setQcReason('Биття цанги')
    setQcCustomReason('')
  }, [selectedCardId, currentUser])

  // ── РЕАЛЬНИЙ ЧАС (ЦЕНТРАЛІЗОВАНО В MESContext) ────────────────
  useEffect(() => {
    // Оновлення тепер приходять через payload в MESContext миттєво
    return () => { }
  }, [])

  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => { })
        setIsScanning(false)
      }
      html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        const isMachineQR = await handleMachineQRScan(decodedText)
        if (isMachineQR) {
          await stopAndClose()
          return
        }

        try {
          const qrData = JSON.parse(decodedText)
          if (qrData.type === 'work_card_shop2') {
            const cardIdStr = qrData.id
            await stopAndClose()
            let foundCard = workCards.find(c => String(c.id).trim() === String(cardIdStr).trim())
            if (!foundCard) {
              setIsSyncing(true)
              try { if (typeof fetchData === 'function') await fetchData('work_cards') } catch (e) { }
              setIsSyncing(false)
              setScanError(`Картку №${cardIdStr} не знайдено в базі.`)
            } else {
              setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
              setSelectedCardId(foundCard.id)
              setScanError(null)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          } else {
            setScanError("Це не картка Цеху №2! Скануйте лише картки другого цеху.")
          }
        } catch (e) {
          setScanError("Невірний формат QR. Це точно картка Цеху №2?")
        }
      }).catch(err => { setScanError("Помилка камери: " + err); setIsScanning(false) })
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => { }) }
  }, [isScanning, workCards])

  // ── Global Scanner Keydown Listener ───────────────────────────────────────
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleGlobalKeyDown = async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      const currentTime = Date.now()
      if (currentTime - lastKeyTime > 100) {
        buffer = ''
      }
      lastKeyTime = currentTime

      if (e.key === 'Enter') {
        if (buffer.length > 3) {
          const scannedText = buffer.trim()
          buffer = ''

          const isMachineQR = await handleMachineQRScan(scannedText)
          if (isMachineQR) {
            e.preventDefault()
            return
          }

          try {
            const qrData = JSON.parse(scannedText)
            if (qrData.type === 'work_card_shop2') {
              const cardIdStr = qrData.id
              let foundCard = workCards.find(c => String(c.id).trim() === String(cardIdStr).trim())
              if (!foundCard) {
                setIsSyncing(true)
                try { if (typeof fetchData === 'function') await fetchData('work_cards') } catch (e) { }
                setIsSyncing(false)
              }
              foundCard = workCards.find(c => String(c.id).trim() === String(cardIdStr).trim())
              if (foundCard) {
                setScannedCardIds(prev => prev.includes(foundCard.id) ? prev : [...prev, foundCard.id])
                setSelectedCardId(foundCard.id)
                setScanError(null)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }
          } catch (e) {
            // Not valid JSON, ignore
          }
        }
        buffer = ''
      } else if (e.key.length === 1) {
        const char = cyrillicToLatinMap[e.key] || e.key
        buffer += char
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [workCards])

  const currentCard = workCards.find(c => String(c.id) === String(selectedCardId))

  const getNomFromCard = (card) => {
    if (!card) return null
    const nom = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
    if (nom) return nom

    // Heuristic Fallback for corrupted cards (previous Number(id) bug)
    // 1. Try to find by quantity and task/order from card_info
    const info = card.card_info || ''
    const orderNumMatch = info.match(/Наряд №(\d+)/)
    const orderNum = orderNumMatch ? orderNumMatch[1] : null

    if (orderNum) {
      const order = orders.find(o => String(o.order_num) === String(orderNum) || String(o.id) === String(orderNum))
      if (order?.order_items) {
        // Find item with same quantity
        const match = order.order_items.find(it => Number(it.quantity) === Number(card.quantity))
        if (match) return nomenclatures.find(n => String(n.id) === String(match.nomenclature_id))
      }
    }

    return null
  }

  const formatElapsedTime = (startIso) => {
    if (!startIso) return '00:00:00'
    const start = new Date(startIso)
    const diff = Math.floor((currentTime - start) / 1000)
    if (isNaN(diff) || diff < 0) return '00:00:00'
    const h = Math.floor(diff / 3600).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
    const s = (diff % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }
  const formatPlanned = (mins) => {
    if (!mins || mins <= 0) return '—'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    if (h > 0) return `${h}год ${m}хв`
    return `${m}хв`
  }
  const getPlannedTime = (card) => {
    if (!card) return 0
    // Priority 1: Direct estimated time (if in minutes)
    if (card.estimated_time) return Number(card.estimated_time)
    // Priority 2: estimated_seconds (from machine module logic)
    if (card.estimated_seconds) return Number(card.estimated_seconds) / 60
    // Priority 3: Calculation from nomenclature
    const nom = getNomFromCard(card)
    if (nom?.time_per_unit) return (Number(nom.time_per_unit) * Number(card.quantity))
    return 0
  }
  const formatMachine = (name) => {
    if (!name) return '—'
    const match = name.match(/№\s*(\S+)/)
    return match ? `№${match[1]}` : name
  }

  const matchesStage = (cardOp, stageName) => {
    const op = (cardOp || '').toLowerCase()
    const sk = (stageName || '').toLowerCase()
    return op === sk || op.includes(sk) || sk.includes(op)
  }

  // Тільки картки Цеху №2
  const queuedCards = workCards.filter(c =>
    c.card_info?.includes('[ЦЕХ №2]') &&
    (c.status === 'new' || c.status === 'at-buffer' || scannedCardIds.some(sid => String(sid) === String(c.id))) &&
    c.status !== 'in-progress' && c.status !== 'waiting-buffer' && c.status !== 'completed'
  )

  const handleStartOperation = async () => {
    if (!currentCard || !selectedOperator) return
    const stage = selectedStage || currentCard.operation
    setIsProcessing(true)
    try {
      await apiService.submitOperatorAction('start', currentCard.task_id, currentCard.id, selectedOperator, {
        stage_name: stage,
        machine_name: selectedMachine,
        manager_name: selectedManager,
        shift_name: selectedShift
      }, startWorkCard)
      if (!scannedCardIds.includes(currentCard.id)) setScannedCardIds(prev => [...prev, currentCard.id])
    } catch (e) { alert('Помилка при старті: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  const submitCompletion = async () => {
    if (!currentCard) return
    const nom = getNomFromCard(currentCard)
    setScrapCounts({ [nom?.id]: 0 })
    setShowScrapModal(true)
  }

  const handleFinalFinish = async () => {
    if (!currentCard) return
    setIsProcessing(true)
    try {
      await apiService.submitBufferConfirmation(currentCard.id, scrapCounts, confirmBuffer)
      setSelectedCardId(null)
      setShowScrapModal(false)
      setScannedCardIds(prev => prev.filter(id => id !== currentCard.id))
      fetchData(['work_cards', 'work_card_history', 'inventory']) // Refresh history for local stats
    } catch (e) { alert('Помилка при завершенні: ' + e.message) }
    finally { setIsProcessing(false) }
  }

  const updateInventoryStock = async (nomId, qty, type = 'semi') => {
    if (!nomId || qty <= 0) return
    try {
      const { data: existing } = await supabase.from('inventory')
        .select('*')
        .eq('nomenclature_id', nomId)
        .eq('type', type)
        .limit(1).maybeSingle()

      if (existing) {
        await supabase.from('inventory').update({
          total_qty: (Number(existing.total_qty) || 0) + Number(qty),
          updated_at: new Date().toISOString()
        }).eq('id', existing.id)
      } else {
        const nom = nomenclatures.find(n => n.id === nomId)
        await supabase.from('inventory').insert([{
          name: nom?.name || 'Деталь',
          unit: nom?.unit || 'шт',
          total_qty: Number(qty),
          type: type,
          nomenclature_id: nomId
        }])
      }
    } catch (e) { console.warn(`Stock update failed for type ${type}:`, e) }
  }

  const handleQCScrapOverride = async () => {
    if (!currentCard || qcScrapCount <= 0) return
    if (qcScrapCount > currentCard.quantity) {
      alert('Кількість браку не може перевищувати поточну кількість деталей у картці!')
      return
    }
    setIsProcessing(true)
    try {
      const reasonText = qcReason === 'Інше (коментар)'
        ? `Інше (${qcCustomReason || 'без коментаря'})`
        : qcReason
      const op = `ВКЯ (${qcInspector || 'відповідальний'}) — Причина: ${reasonText}`
      const newQty = Math.max(0, currentCard.quantity - qcScrapCount)

      const promises = []

      // 1. Запис у work_card_history
      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: 'Контроль ВКЯ',
          operator_name: op,
          qty_at_start: currentCard.quantity,
          qty_completed: newQty,
          scrap_qty: qcScrapCount,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_archived_scrap: true,
          shift_name: currentCard.shift_name,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine,
          qc_scrap_reason: qcReason,
          qc_scrap_comment: qcReason === 'Інше (коментар)' ? qcCustomReason : null
        }])
      )

      // 2. Оновлюємо кількість картки (якщо залишилося 0, закриваємо її)
      const updatePayload = { quantity: newQty }
      if (newQty === 0) {
        updatePayload.status = 'completed'
      }
      promises.push(
        supabase.from('work_cards').update(updatePayload).eq('id', currentCard.id)
      )

      const results = await Promise.all(promises)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setShowQCModal(false)
      setQcScrapCount(0)
      setQcInspector('')
      setQcReason('Биття цанги')
      setQcCustomReason('')
      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']).catch(() => {})
      if (newQty === 0) {
        setSelectedCardId(null)
        setScannedCardIds(prev => prev.filter(id => id !== currentCard.id))
      }
      setIsProcessing(false)
      alert(`✅ Успішно списано ${qcScrapCount} шт у брак за рішенням ВКЯ!`)
    } catch (e) {
      console.error('QC error:', e)
      setIsProcessing(false)
      alert('Помилка фіксації браку ВКЯ: ' + e.message)
    } finally { setIsProcessing(false) }
  }

  const SpecCard = ({ icon: Icon, label, value, color = "#8b5cf6" }) => (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a', padding: '18px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '130px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
        <Icon size={14} /> {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color }}>{value}</div>
    </div>
  )

  const renderQueue = () => (
    <div className="tasks-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 15px 25px' }}>
      {queuedCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#444', fontSize: '0.8rem' }}>Немає карток в черзі для Цеху №2. Відскануйте першу...</div>
      )}
      {queuedCards.map(card => {
        const nom = getNomFromCard(card)
        const isActive = String(selectedCardId) === String(card.id)
        return (
          <div key={card.id} onClick={() => { setSelectedCardId(card.id); setIsDrawerOpen(false); setScanError(null); }} style={{ background: isActive ? '#8b5cf6' : '#1a1a1a', borderRadius: '12px', padding: '15px', marginBottom: '10px', cursor: 'pointer', border: '1px solid', borderColor: isActive ? '#8b5cf6' : '#333', transition: '0.2s', color: isActive ? '#fff' : '#fff' }}>
            <div style={{ marginBottom: '4px' }}>
              <strong style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800 }}>{nom?.name || 'Без назви'}</strong>
              <span style={{ fontSize: '0.65rem', color: '#8b5cf6', fontWeight: 800 }}>#{card.id.slice(-8).toUpperCase()}</span>
              <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{card.quantity} шт | Етап: {card.status === 'at-buffer' ? `Буфер ${card.operation?.toLowerCase()}` : (card.operation || '—')}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '0.6rem', background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(139, 92, 246, 0.1)', color: isActive ? '#fff' : '#8b5cf6', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>ОЧІКУЄ</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{card.estimated_time || 0} хв</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderStorageExplorer = () => {
    const explorerTabs = [
      { id: 'semi', label: 'ДЕТАЛІ (ПОТРЕБА)', icon: <Package size={14} />, color: '#8b5cf6', type: 'semi_shop2' },
      { id: 'bz', label: 'ЗАПАС (БЗ)', icon: <Layers size={14} />, color: '#eab308', type: 'bz_shop2' }
    ]
    const filteredItems = (inventory || []).filter(i => {
      if (activeExplorerTab === 'bz') return i.type === 'bz_shop2'
      return i.type === 'semi_shop2'
    })

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#8b5cf620', padding: '8px', borderRadius: '10px' }}><Package size={20} color="#8b5cf6" /></div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 1000 }}>БУФЕР ЦЕХУ №2</h2>
              <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800, textTransform: 'uppercase' }}>Надходження з дільниці розкрою</div>
            </div>
          </div>
          <button onClick={() => setShowStorageExplorer(false)} style={{ background: '#1a1a1a', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '15px 20px', background: '#0d0d0d' }}>
          {explorerTabs.map(t => (
            <button key={t.id} onClick={() => setActiveExplorerTab(t.id)}
              style={{
                flex: 1, background: activeExplorerTab === t.id ? t.color : '#0a0a0a',
                color: activeExplorerTab === t.id ? '#000' : '#444', border: 'none',
                padding: '12px', borderRadius: '12px', fontWeight: 900, fontSize: '0.65rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s', cursor: 'pointer'
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {Object.values(filteredItems.reduce((acc, item) => {
              if (!acc[item.nomenclature_id]) {
                acc[item.nomenclature_id] = { ...item }
              } else {
                acc[item.nomenclature_id].total_qty = (Number(acc[item.nomenclature_id].total_qty) || 0) + (Number(item.total_qty) || 0)
                if (new Date(item.updated_at) > new Date(acc[item.nomenclature_id].updated_at)) {
                  acc[item.nomenclature_id].updated_at = item.updated_at
                }
              }
              return acc
            }, {})).filter(item => Number(item.total_qty) > 0).map(item => {
              const nom = nomenclatures.find(n => n.id === item.nomenclature_id)
              return (
                <div key={item.id} style={{ background: '#111', borderRadius: '18px', padding: '18px', border: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '2px', color: '#fff' }}>{nom?.name || item.name}</div>
                    <div style={{ fontSize: '0.6rem', color: '#555', fontWeight: 900 }}>{item.unit || 'шт'} | ОНОВЛЕНО: {new Date(item.updated_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '60px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 1000, color: explorerTabs.find(t => t.id === activeExplorerTab).color }}>{item.total_qty}</div>
                    <div style={{ fontSize: '0.5rem', color: '#333', fontWeight: 900 }}>В НАЯВНОСТІ</div>
                  </div>
                </div>
              )
            })}
            {filteredItems.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: '#222' }}>
                <Package size={48} style={{ marginBottom: '15px', opacity: 0.1 }} />
                <div style={{ fontWeight: 800 }}>НЕМАЄ ДЕТАЛЕЙ В БУФЕРІ</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderScrapModal = () => {
    if (!currentCard) return null
    const nom = getNomFromCard(currentCard)
    const currentScrap = scrapCounts[nom?.id] || 0

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10020, padding: '20px' }}>
        <div style={{ background: '#111', width: '100%', maxWidth: '500px', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
          <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 950 }}>ЗАВЕРШЕННЯ ЕТАПУ (ЦЕХ №2)</h3>
            <button onClick={() => setShowScrapModal(false)} style={{ background: 'transparent', border: 'none', color: '#555' }}><X size={26} /></button>
          </div>
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '1.4rem' }}>{nom?.name || 'Деталь'}</h2>
            <div style={{ background: '#000', padding: '25px', borderRadius: '24px' }}>
              <label style={{ color: '#ef4444', fontWeight: 900, display: 'block', marginBottom: '15px', fontSize: '0.75rem' }}>КІЛЬКІСТЬ БРАКОВАНИХ ДЕТАЛЕЙ</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <button onClick={() => setScrapCounts(p => ({ ...p, [nom?.id]: Math.max(0, currentScrap - 1) }))} style={{ width: '60px', height: '60px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '15px', fontSize: '1.5rem' }}>-</button>
                <input type="number" value={currentScrap === 0 ? '' : currentScrap} placeholder="0" onChange={e => { const val = e.target.value; setScrapCounts(p => ({ ...p, [nom?.id]: val === '' ? 0 : (parseInt(val) || 0) })) }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '3.5rem', width: '120px', textAlign: 'center', fontWeight: 900 }} />
                <button onClick={() => setScrapCounts(p => ({ ...p, [nom?.id]: currentScrap + 1 }))} style={{ width: '60px', height: '60px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: '15px', fontSize: '1.5rem' }}>+</button>
              </div>
            </div>
            <button disabled={isProcessing} onClick={handleFinalFinish} style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '20px', borderRadius: '18px', fontSize: '1.3rem', fontWeight: 900, marginTop: '30px', cursor: 'pointer', opacity: isProcessing ? 0.5 : 1 }}>ПІДТВЕРДИТИ</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="operator-terminal-shop2" style={{ background: '#0a0a0a', height: '100vh', display: 'flex', flexDirection: 'column', color: '#fff', overflow: 'hidden' }}>
      <header className="terminal-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '70px', background: '#000', borderBottom: '2px solid #8b5cf6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.85rem' }}>
            <ArrowLeft size={18} /> <span className="hide-mobile">На головну</span>
          </Link>
          <button onClick={() => setIsDrawerOpen(true)} className="burger-btn-labeled mobile-only">
            <Menu size={20} />
            <span>Черга</span>
            {queuedCards.length > 0 && (
              <span className="queue-badge" style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                fontSize: '10px',
                fontWeight: 900,
                width: '18px',
                height: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}>
                {queuedCards.length}
              </span>
            )}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Tablet size={20} color="#8b5cf6" />
          <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }} className="hide-mobile">ТЕРМІНАЛ ЦЕХУ №2 (ОПЕРАТОР)</h1>

          <button
            onClick={() => setShowStorageExplorer(true)}
            style={{
              background: '#8b5cf620', color: '#8b5cf6', border: '1px solid #8b5cf644',
              padding: '6px 12px', borderRadius: '10px', fontSize: '0.65rem',
              fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              marginLeft: '15px'
            }}
          >
            <Package size={14} /> БУФЕР
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAdminCardModal(true)}
              style={{
                background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.4)',
                padding: '6px 12px', borderRadius: '10px', fontSize: '0.65rem',
                fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                marginLeft: '10px'
              }}
            >
              + РУЧНА КАРТКА
            </button>
          )}
        </div>
        <div style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '1.2rem', color: '#8b5cf6' }}>{currentTime.toLocaleTimeString()}</div>
      </header>

      <div className="main-layout-responsive" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div className="side-panel hide-mobile" style={{ width: '300px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '20px', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: '#555', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={16} /> ЧЕРГА ЦЕХ №2 ({queuedCards.length})
          </div>
          {renderQueue()}
          <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setIsScanning(true)}
              style={{ width: '100%', background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#8b5cf6', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Camera size={18} /> СКАНУВАТИ
            </button>
          </div>
        </div>

        {isDrawerOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 99999 }} onClick={() => setIsDrawerOpen(false)} />}
        <div style={{ position: 'fixed', left: isDrawerOpen ? 0 : '-300px', top: 0, bottom: 0, width: '300px', background: '#121212', zIndex: 100000, transition: '0.3s', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>ОБЕРІТЬ КАРТУ</span>
            <X size={20} onClick={() => setIsDrawerOpen(false)} style={{ cursor: 'pointer' }} />
          </div>
          {renderQueue()}
          <div style={{ padding: '15px', borderTop: '1px solid #1a1a1a' }}>
            <button onClick={() => setIsScanning(true)}
              style={{ width: '100%', background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#8b5cf6', padding: '14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Camera size={18} /> СКАНУВАТИ
            </button>
          </div>
        </div>

        <div className="content-panel" style={{ flex: 1, padding: '20px 15px', background: '#0a0a0a', overflowY: 'auto', position: 'relative' }}>

          {scanError && (
            <div style={{ background: '#ef444422', border: '1px solid #ef444455', color: '#ef4444', padding: '15px', borderRadius: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{scanError}</span>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setScanError(null)} />
            </div>
          )}

          {currentCard ? (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    {currentCard.status === 'new' && (
                      <div style={{ background: '#8b5cf6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>НОВА КАРТА ЦЕХ №2</div>
                    )}
                    {currentCard.status === 'at-buffer' && (
                      <div style={{ background: '#eab308', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>ОЧІКУЄ ЕТАПУ</div>
                    )}
                    {currentCard.status === 'in-progress' && (
                      <div style={{ background: '#3b82f6', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 900 }}>У РОБОТІ</div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: '#555', fontWeight: 800 }}>
                      ЗАМОВЛЕННЯ №{orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'} · #{currentCard.id.slice(-8).toUpperCase()}
                    </div>
                  </div>
                  <h2 style={{ fontSize: '2.5rem', margin: 0, fontWeight: 950, letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {getNomFromCard(currentCard)?.name || (currentCard.card_info?.split('] ').pop() || `Картка #${currentCard.id.slice(0, 8)}`)}
                  </h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {currentCard.task_id && (
                    <Link
                      to="/shop2"
                      state={{ taskId: currentCard.task_id }}
                      style={{ background: '#8b5cf615', border: '1px solid #8b5cf640', color: '#8b5cf6', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      title="Перейти до батьківського наряду">
                      📋 <span className="hide-mobile">НАРЯД</span>
                    </Link>
                  )}
                  <button onClick={() => setShowQCModal(true)}
                    style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Внести додатковий брак ВКЯ">
                    🛡️ <span className="hide-mobile">БРАК ВКЯ</span>
                  </button>
                  <button onClick={() => setSelectedCardId(null)} style={{ background: '#111', border: 'none', color: '#555', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '30px' }}>
                <SpecCard icon={ClipboardList} label="Замовлення" value={`№${orders?.find(o => o.id === currentCard.order_id)?.order_num || '—'}`} color="#f43f5e" />
                <SpecCard icon={Layers} label="Матеріал" value={getNomFromCard(currentCard)?.material_type || '—'} color="#10b981" />
                <SpecCard
                  icon={Box}
                  label="Кількість"
                  value={((() => {
                    const need = currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]
                    const bz = currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1] || currentCard.buffer_qty
                    if (need && bz) return `${currentCard.quantity} шт (${need}+${bz} БЗ)`
                    return `${currentCard.quantity} шт`
                  }))()}
                  color="#3b82f6"
                />
                <SpecCard icon={Gauge} label="Етап" value={currentCard.status === 'at-buffer' ? `Буфер ${currentCard.operation?.toLowerCase()}` : (currentCard.operation || '—')} />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '28px', border: '1px solid #1a1a1a', padding: '40px' }}>
                {currentCard.status === 'completed' ? (
                  // ── КАРТКА ЗАВЕРШЕНА — не допускаємо жодних дій ──
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '50%',
                      background: '#10b98122', border: '2px solid #10b98155',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 25px'
                    }}>
                      <CheckCircle size={40} color="#10b981" />
                    </div>
                    <div style={{ color: '#10b981', fontSize: '1.6rem', fontWeight: 950, marginBottom: '10px' }}>
                      ПЕРЕДАНО НА СГП
                    </div>
                    <div style={{ color: '#444', fontSize: '0.85rem', fontWeight: 700, marginBottom: '30px' }}>
                      Ця картка вже завершена і передана на склад готової продукції.
                    </div>
                    <div style={{
                      background: '#ef444411', border: '1px solid #ef444433',
                      borderRadius: '16px', padding: '15px 20px',
                      color: '#ef4444', fontSize: '0.8rem', fontWeight: 800
                    }}>
                      ⛔ Повторні дії по цій картці заблоковані. Наряд закрито.
                    </div>
                    <button
                      onClick={() => { setSelectedCardId(null); setScannedCardIds(prev => prev.filter(id => String(id) !== String(currentCard.id))) }}
                      style={{ marginTop: '25px', background: '#222', border: 'none', color: '#888', padding: '12px 30px', borderRadius: '14px', cursor: 'pointer', fontWeight: 800 }}
                    >
                      Закрити
                    </button>
                  </div>
                ) : (currentCard.status === 'new' || currentCard.status === 'at-buffer') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '500px', margin: '0 auto' }}>
                    {currentCard.status === 'at-buffer' && currentCard.operator_name && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '15px', padding: '15px', color: '#10b981', fontWeight: 800, fontSize: '0.85rem', textAlign: 'center' }}>
                        👤 ВИКОНАВЕЦЬ: {currentCard.operator_name} {currentCard.shift_name ? `(${currentCard.shift_name})` : ''}
                      </div>
                    )}
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Поточний етап (ЦЕХ №2)</label>
                      <select value={selectedStage || currentCard.operation} onChange={(e) => setSelectedStage(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                        {shop2Stages.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Майстер</label>
                      <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                        <option value="">— Оберіть майстра —</option>
                        {getFilteredManagers('Цех №2').map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Зміна</label>
                      <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700 }}>
                        <option value="">— Оберіть зміну —</option>
                        <option value="Зміна 1">Зміна 1</option>
                        <option value="Зміна 2">Зміна 2</option>
                        <option value="Зміна 3">Зміна 3</option>
                        <option value="Зміна 4">Зміна 4</option>
                        <option value="Без зміни">Без зміни</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#555', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Відповідальний оператор</label>
                      <select value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)} disabled={!selectedShift} style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 700, opacity: selectedShift ? 1 : 0.5, cursor: selectedShift ? 'pointer' : 'not-allowed' }}>
                        <option value="">{selectedShift ? '— Оберіть оператора —' : '— Спочатку оберіть зміну —'}</option>
                        {getFilteredOperators('Цех №2', selectedShift, selectedStage || currentCard.operation).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <button
                      disabled={isProcessing || !selectedOperator || (currentCard.status === 'at-buffer' && (selectedStage || currentCard.operation) === currentCard.operation)}
                      onClick={handleStartOperation}
                      style={{
                        background: '#8b5cf6',
                        color: '#fff',
                        border: 'none',
                        padding: '22px',
                        borderRadius: '18px',
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        cursor: (isProcessing || !selectedOperator || (currentCard.status === 'at-buffer' && (selectedStage || currentCard.operation) === currentCard.operation)) ? 'not-allowed' : 'pointer',
                        transition: '0.2s',
                        opacity: (isProcessing || !selectedOperator || (currentCard.status === 'at-buffer' && (selectedStage || currentCard.operation) === currentCard.operation)) ? 0.3 : 1
                      }}
                    >
                      {currentCard.status === 'at-buffer' && (selectedStage || currentCard.operation) === currentCard.operation ? 'ЕТАП ЗАВЕРШЕНО (В БУФЕРІ)' : 'ВЗЯТИ В РОБОТУ'}
                    </button>
                    {currentCard.status === 'at-buffer' && (
                      <button
                        disabled={isProcessing}
                        onClick={async () => {
                          if (isProcessing) return
                          setIsProcessing(true)
                          try {
                            await handoverToSGP(currentCard.id)
                            setSelectedCardId(null)
                            setScannedCardIds(prev => prev.filter(id => String(id) !== String(currentCard.id)))
                          } catch (e) {
                            alert('Помилка передачі: ' + e.message)
                          } finally {
                            setIsProcessing(false)
                          }
                        }}
                        style={{
                          background: isProcessing ? '#555' : '#f43f5e',
                          color: '#fff', border: 'none', padding: '15px',
                          borderRadius: '18px', fontSize: '1rem', fontWeight: 900,
                          cursor: isProcessing ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          opacity: isProcessing ? 0.5 : 1
                        }}
                      >
                        <Package size={18} /> {isProcessing ? 'ПЕРЕДАЧА...' : 'ПЕРЕДАТИ НА СКЛАД СГП'}
                      </button>
                    )}
                    <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#444', fontWeight: 700 }}>Робоча картка автоматично збережеться в базу</div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 800, marginBottom: '20px' }}>ЧАС В РОБОТІ</div>
                    <div style={{ fontSize: '6.5rem', fontWeight: 1000, color: '#fff', fontFamily: 'monospace', letterSpacing: '-2px' }}>{formatElapsedTime(currentCard.started_at)}</div>
                    <div style={{ color: '#555', marginBottom: '30px', fontWeight: 800 }}>ОПЕРАТОР: {currentCard.operator_name}</div>
                    <button onClick={submitCompletion} style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '22px 70px', borderRadius: '18px', fontSize: '1.4rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 40px rgba(236, 72, 153, 0.3)' }}>ЗАВЕРШИТИ ЕТАП</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 950 }}>МОНІТОРИНГ ЦЕХУ №2</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '50px' }}>
                {/* ───── КАРТКА ВХІДНОГО БУФЕРА ───── */}
                {(() => {
                  const streamingIncoming = (workCards || [])
                    .filter(c => c.status === 'at-shop2-buffer')
                    .reduce((a, c) => a + (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0), 0)

                  const totalIncoming = (inventory || [])
                    .filter(i => i.type === 'semi_shop2' || i.type === 'bz_shop2')
                    .reduce((a, i) => a + (Number(i.total_qty) || 0), 0)

                  const totalTaken = workCards
                    .filter(c => c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'in-progress' || c.status === 'at-buffer' || c.status === 'waiting-buffer'))
                    .reduce((a, c) => a + (c.quantity || 0), 0)

                  const bufferQty = Math.max(streamingIncoming, Math.max(0, totalIncoming - totalTaken))

                  return (
                    <div onClick={() => setShowStorageExplorer(true)} style={{ background: '#111', border: '1px solid #8b5cf644', borderRadius: '24px', padding: '20px', cursor: 'pointer', transition: '0.3s', boxShadow: '0 10px 30px -10px rgba(139, 92, 246, 0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: '#8b5cf6', fontSize: '0.7rem', fontWeight: 950, textTransform: 'uppercase' }}>ВХІДНИЙ БУФЕР</span>
                        <Package size={14} color="#8b5cf6" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: '#8b5cf6', fontWeight: 800 }}>ПРИЙНЯТО</div>
                          <div style={{ fontSize: '1.8rem', fontWeight: 1000, color: '#fff', lineHeight: 1 }}>{bufferQty}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px', gridColumn: 'span 2' }}>
                          <div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 800 }}>СТАН БУФЕРА</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: bufferQty > 0 ? '#8b5cf6' : '#444', marginTop: '4px' }}>
                            {bufferQty > 0 ? 'Готові до генерації РК' : 'Буфер порожній'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {shop2Stages.map(stage => {
                  const stageCards = workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && matchesStage(c.operation, stage))
                  const workQty = stageCards.filter(c => c.status === 'in-progress').reduce((acc, c) => acc + (c.quantity || 0), 0)
                  const bufferQty = stageCards.filter(c => ['at-buffer', 'waiting-buffer'].includes(c.status)).reduce((acc, c) => acc + (c.quantity || 0), 0)
                  const scrapQty = workCardHistory.filter(h => h.card_info?.includes('[ЦЕХ №2]') && matchesStage(h.stage_name, stage)).reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)

                  return (
                    <div key={stage} onClick={() => setDetailStage(stage)} style={{ background: '#111', border: '1px solid #222', borderRadius: '24px', padding: '20px', cursor: 'pointer', transition: '0.3s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: '#555', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>{stage}</span>
                        <Layers size={14} color="#8b5cf6" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'flex-end', width: '100%' }}>
                        <div>
                          <div style={{ fontSize: '0.6rem', color: '#3b82f6', fontWeight: 800 }}>В РОБОТІ</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 950, color: workQty > 0 ? '#fff' : '#222' }}>{workQty}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px' }}>
                          <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 800 }}>БУФЕР</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 950, color: bufferQty > 0 ? '#10b981' : '#222' }}>{bufferQty}</div>
                        </div>
                        <div style={{ borderLeft: '1px solid #222', paddingLeft: '8px' }}>
                          <div style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 800 }}>БРАК</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 950, color: scrapQty > 0 ? '#ef4444' : '#222' }}>{scrapQty}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

                <div style={{ background: '#111', borderRadius: '24px', border: '1px solid #222', overflowX: 'auto' }}>
                  <div style={{ padding: '25px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>ДЕТАЛІ В ПРОЦЕСІ (ЦЕХ №2)</h3>
                    {isSyncing && <RefreshCw className="animate-spin" size={16} color="#8b5cf6" />}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
                  <thead style={{ background: '#0a0a0a', fontSize: '0.65rem', fontWeight: 900, color: '#555', textTransform: 'uppercase' }}>
                    <tr><th style={{ padding: '12px 15px' }}>ДЕТАЛЬ</th><th style={{ padding: '12px 15px' }}>ЕТАП</th><th style={{ padding: '12px 15px' }}>К-СТЬ</th><th style={{ padding: '12px 15px' }}>МАЙСТЕР</th><th style={{ padding: '12px 15px' }}>ЗМІНА</th><th style={{ padding: '12px 15px' }}>ОПЕРАТОР</th><th style={{ padding: '12px 15px' }}>ВЕРСТАТ</th><th style={{ padding: '12px 15px' }}>ПЛАН. ЧАС</th><th style={{ padding: '12px 15px' }}>ЧАС</th><th style={{ padding: '12px 15px' }}></th></tr>
                  </thead>
                  <tbody>
                    {workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'in-progress' || c.status === 'at-buffer')).map(card => (
                      <tr key={card.id} 
                        onClick={() => setSelectedCardId(card.id)}
                        style={{ borderBottom: '1px solid #1a1a1a', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <td style={{ padding: '12px 15px', fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                          {getNomFromCard(card)?.name || (card.card_info?.split('] ').pop() || `Картка #${card.id.slice(0, 8)}`)}
                        </td>
                        <td style={{ padding: '12px 15px' }}><span style={{ color: card.status === 'at-buffer' ? '#10b981' : '#8b5cf6', fontWeight: 900, fontSize: '0.7rem' }}>{card.operation?.toUpperCase()}</span></td>
                        <td style={{ padding: '12px 15px', fontWeight: 900 }}>{card.quantity} шт</td>
                        <td style={{ padding: '12px 15px', color: '#888' }}>{card.manager_name || '—'}</td>
                        <td style={{ padding: '12px 15px', color: '#888' }}>{card.shift_name || '—'}</td>
                        <td style={{ padding: '12px 15px', color: '#aaa' }}>{card.operator_name || '—'}</td>
                        <td style={{ padding: '12px 15px', color: '#eab308', fontWeight: 800 }}>{formatMachine(card.machine)}</td>
                        <td style={{ padding: '12px 15px', color: '#3b82f6', fontWeight: 700 }}>{formatPlanned(getPlannedTime(card))}</td>
                        <td style={{ padding: '12px 15px', color: '#10b981' }}>{formatElapsedTime(card.started_at)}</td>
                        <td style={{ padding: '12px 15px', textAlign: 'right' }}>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedCardId(card.id) }}
                            style={{ background: '#eab308', border: 'none', color: '#000', padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Відкрити">
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'in-progress' || c.status === 'at-buffer')).length === 0 && (
                      <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#333', fontSize: '0.8rem' }}>Немає активних процесів у другому цеху</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {isScanning && (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 10001, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setIsScanning(false)} style={{ position: 'absolute', top: 30, right: 30, color: '#fff', background: '#1a1a1a', border: 'none', padding: '15px', borderRadius: '50%' }}><X size={32} /></button>
          <div style={{ width: '90%', maxWidth: '500px', border: '4px solid #8b5cf6', borderRadius: '32px', overflow: 'hidden' }} id="reader"></div>
          <div style={{ marginTop: '20px', color: '#555', fontWeight: 700 }}>Тримайте код в центрі рамки</div>
        </div>
      )}

      {renderScrapModal && currentCard && showScrapModal && renderScrapModal()}
      {showStorageExplorer && renderStorageExplorer()}
      {detailStage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10030, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '700px', background: '#111', borderRadius: '32px', border: '1px solid #333', overflow: 'hidden' }}>
            <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
              <h2 style={{ margin: 0, color: '#8b5cf6', fontSize: '1.2rem', fontWeight: 950 }}>{detailStage.toUpperCase()}</h2>
              <button onClick={() => setDetailStage(null)} style={{ background: '#222', border: 'none', color: '#fff', padding: '10px', borderRadius: '10px' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', padding: '15px', gap: '10px' }}>
              <button onClick={() => setDetailTab('work')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'work' ? '#8b5cf6' : '#222', color: '#fff', fontWeight: 900 }}>В РОБОТІ</button>
              <button onClick={() => setDetailTab('buffer')} style={{ flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: detailTab === 'buffer' ? '#10b981' : '#222', color: '#fff', fontWeight: 900 }}>БУФЕР</button>
            </div>
            <div style={{ padding: '0 15px 25px', maxHeight: '450px', overflowY: 'auto' }}>
              {(() => {
                if (detailTab === 'buffer') {
                  const bufferCards = workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && matchesStage(c.operation, detailStage) && c.status === 'at-buffer');
                  if (bufferCards.length === 0) return <div style={{ textAlign: 'center', padding: '50px', color: '#444', fontSize: '0.85rem' }}>Буфер пустий</div>;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {bufferCards.map((c) => {
                        const nom = getNomFromCard(c);
                        return (
                          <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{nom?.name || 'Деталь'}</div>
                              <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>Картка №{c.id.slice(-8).toUpperCase()}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <div style={{ fontWeight: 1000, fontSize: '1.3rem', color: '#10b981' }}>{c.quantity} <small style={{ fontSize: '0.6rem', opacity: 0.3 }}>шт</small></div>
                              <button
                                disabled={isProcessing}
                                onClick={async () => {
                                  if (isProcessing) return
                                  setIsProcessing(true)
                                  try {
                                    await handoverToSGP(c.id)
                                  } finally {
                                    setIsProcessing(false)
                                  }
                                }}
                                style={{ background: isProcessing ? '#555' : '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1 }}
                              >
                                {isProcessing ? 'ПЕРЕДАЧА...' : 'ВІДПРАВИТИ НА СГП'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                } else {
                  const agg = {};
                  workCards.filter(c => c.card_info?.includes('[ЦЕХ №2]') && matchesStage(c.operation, detailStage) && c.status === 'in-progress').forEach(c => {
                    const nom = getNomFromCard(c);
                    const name = nom?.name || 'Деталь';
                    agg[name] = (agg[name] || 0) + (c.quantity || 0);
                  });
                  const items = Object.entries(agg);
                  if (items.length === 0) return <div style={{ textAlign: 'center', padding: '50px', color: '#444', fontSize: '0.85rem' }}>Дані відсутні</div>;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {items.map(([name, qty], idx) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px 20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1a1a1a' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{name}</div>
                          <div style={{ fontWeight: 1000, fontSize: '1.3rem', color: '#8b5cf6' }}>{qty} <small style={{ fontSize: '0.6rem', opacity: 0.3 }}>шт</small></div>
                        </div>
                      ))}
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .floating-controls-container {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 1000;
          transition: all 0.3s ease;
        }
        @media (max-width: 600px) {
          .floating-controls-container {
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            background: rgba(10, 10, 12, 0.96) !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding: 14px 20px;
            justify-content: space-between;
            border-radius: 0;
            box-shadow: 0 -10px 35px rgba(0,0,0,0.9);
            backdrop-filter: blur(15px);
          }
          .floating-controls-container form {
            flex: 1;
            box-shadow: none !important;
            background: #000 !important;
            border: 1px solid #222 !important;
          }
        }
      `}</style>

      {/* Floating Controls (Search and Scan QR) */}
      <div className="floating-controls-container">
        {/* Floating Search Form */}
        <form onSubmit={handleManualEntry} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(10, 10, 10, 0.95)',
          border: '1px solid #222',
          padding: '10px 14px',
          borderRadius: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          <Search size={16} color="#6b7280" />
          <input
            type="text"
            placeholder="Введіть системний номер..."
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            disabled={isProcessing}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, outline: 'none', width: '100%' }}
          />
          <button type="submit" disabled={isProcessing} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {isProcessing ? <RefreshCw size={12} className="anim-spin" /> : 'ЗНАЙТИ'}
          </button>
        </form>

        {/* Floating Round QR Scan Button */}
        <button onClick={() => setIsScanning(true)}
          className="hover-lift"
          style={{ 
            background: '#8b5cf6', 
            border: 'none', 
            color: '#000', 
            width: '64px',
            height: '64px',
            borderRadius: '50%', 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center', 
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(139,92,246,0.4)',
            transition: 'all 0.2s',
            flexShrink: 0
          }}>
          <QrCode size={32} />
        </button>
      </div>

      {machineCallModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#141414',
            border: '1px solid #333',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '450px',
            padding: '30px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setMachineCallModal(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: '5px'
              }}
            >
              <X size={24} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
              <div style={{ background: '#ef444415', padding: '12px', borderRadius: '16px', color: '#ef4444' }}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                  {machineCallModal.type}
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#f59e0b', fontWeight: 800, fontSize: '0.95rem' }}>
                  Пор. №{machineCallModal.sequence_number || '—'} 
                  {machineCallModal.inventory_no ? ` | Інв. ${machineCallModal.inventory_no}` : ''}
                  {machineCallModal.floor ? ` | Поверх ${machineCallModal.floor}` : ''}
                </p>
              </div>
            </div>

            {machineCallSuccess ? (
              <div style={{
                background: '#10b98115',
                border: '1px solid #10b98130',
                color: '#10b981',
                padding: '20px',
                borderRadius: '16px',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '1.1rem',
                margin: '20px 0'
              }}>
                {machineCallSuccess}
              </div>
            ) : (
              <>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
                  Оберіть кого саме викликати до верстату. Виклик з'явиться на дашборді майстра та інженерів в реальному часі.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Master Call */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => handleCreateCall('master', selectedCallMasterId)}
                      style={{
                        background: '#f59e0b',
                        color: '#000',
                        border: 'none',
                        padding: '16px',
                        borderRadius: '16px',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(245,158,11,0.2)',
                        width: '100%'
                      }}
                    >
                      <span>ВИКЛИКАТИ МАЙСТРА</span>
                    </button>
                    <select
                      value={selectedCallMasterId}
                      onChange={e => setSelectedCallMasterId(e.target.value)}
                      style={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '10px',
                        color: '#fff',
                        padding: '10px',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Всі майстри (Загальний виклик) --</option>
                      {callMasters.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Engineer Call */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => handleCreateCall('engineer', selectedCallEngineerId)}
                      style={{
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        padding: '16px',
                        borderRadius: '16px',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(59,130,246,0.2)',
                        width: '100%'
                      }}
                    >
                      <span>ВИКЛИКАТИ ІНЖЕНЕРА</span>
                    </button>
                    <select
                      value={selectedCallEngineerId}
                      onChange={e => setSelectedCallEngineerId(e.target.value)}
                      style={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '10px',
                        color: '#fff',
                        padding: '10px',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Всі інженери (Загальний виклик) --</option>
                      {callEngineers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* QC Call */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => handleCreateCall('qc', selectedCallQCId)}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        padding: '16px',
                        borderRadius: '16px',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(239,68,68,0.2)',
                        width: '100%'
                      }}
                    >
                      <span>ВИКЛИКАТИ ВКЯ</span>
                    </button>
                    <select
                      value={selectedCallQCId}
                      onChange={e => setSelectedCallQCId(e.target.value)}
                      style={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '10px',
                        color: '#fff',
                        padding: '10px',
                        fontSize: '0.9rem',
                        outline: 'none'
                      }}
                    >
                      <option value="">-- Всі фахівці ВКЯ (Загальний виклик) --</option>
                      {callQCs.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || ''} {u.last_name || ''} {u.position ? ` (${u.position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Модалка корекції браку від ВКЯ ─────────────────────────────────── */}
      {showQCModal && currentCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 10025, padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: '#111', width: '100%', maxWidth: '460px', borderRadius: '26px', border: '1px solid #ef444440', overflow: 'hidden', boxShadow: '0 20px 60px rgba(239,68,68,0.15)', margin: 'auto 0' }}>
            <div style={{ padding: '20px 22px', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ef444420' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 950, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🛡️ ВІДДІЛ ВКЯ · ФІКСАЦІЯ БРАКУ
                </h3>
                <div style={{ fontSize: '0.6rem', color: '#888', marginTop: '2px' }}>
                  Виявлено додатковий дефект на етапі
                </div>
              </div>
              <button onClick={() => setShowQCModal(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{getNomFromCard(currentCard)?.name}</h3>

              {/* Інспектор ВКЯ */}
              <div>
                <label style={{ fontSize: '0.6rem', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>ПІБ Інспектора ВКЯ (або відповідального)</label>
                <input
                  type="text"
                  placeholder="Введіть ваше прізвище..."
                  value={qcInspector}
                  onChange={e => setQcInspector(e.target.value)}
                  style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}
                />
              </div>

              {/* Причина браку */}
              <div>
                <label style={{ fontSize: '0.6rem', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Причина браку</label>
                <select
                  value={qcReason}
                  onChange={e => {
                    setQcReason(e.target.value)
                    if (e.target.value !== 'Інше (коментар)') {
                      setQcCustomReason('')
                    }
                  }}
                  style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}
                >
                  {scrapReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </div>

              {/* Коментар до причини браку */}
              {qcReason === 'Інше (коментар)' && (
                <div>
                  <label style={{ fontSize: '0.6rem', fontWeight: 900, color: '#555', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Опишіть іншу причину браку</label>
                  <input
                    type="text"
                    placeholder="Введіть коментар..."
                    value={qcCustomReason}
                    onChange={e => setQcCustomReason(e.target.value)}
                    style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}
                  />
                </div>
              )}

              {/* Лічильник додаткового браку */}
              <div style={{ background: '#0d0d0d', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #ef444422' }}>
                <label style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                  КІЛЬКІСТЬ ВИЯВЛЕНОГО БРАКУ
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <button onClick={() => setQcScrapCount(v => Math.max(0, v - 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>−</button>
                  <input type="number" min={0} max={currentCard.quantity} value={qcScrapCount === 0 ? '' : qcScrapCount} placeholder="0"
                    onChange={e => {
                      const val = e.target.value;
                      setQcScrapCount(val === '' ? 0 : Math.max(0, Math.min(currentCard.quantity, parseInt(val) || 0)))
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '3.2rem', width: '90px', textAlign: 'center', fontWeight: 900 }} />
                  <button onClick={() => setQcScrapCount(v => Math.min(currentCard.quantity, v + 1))}
                    style={{ width: '46px', height: '46px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: '10px', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#555' }}>
                  Залишиться в картці: <strong style={{ color: '#10b981' }}>{Math.max(0, (currentCard.quantity || 0) - qcScrapCount)} шт</strong>
                </div>
              </div>

              <button onClick={handleQCScrapOverride} disabled={isProcessing || qcScrapCount <= 0}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none', padding: '16px', borderRadius: '14px',
                  fontSize: '1.05rem', fontWeight: 1000, cursor: 'pointer',
                  boxShadow: '0 10px 30px rgba(239,68,68,0.3)',
                  opacity: (isProcessing || qcScrapCount <= 0) ? 0.5 : 1
                }}>
                {isProcessing ? 'ЗБЕРЕЖЕННЯ...' : '⚠️ СПИСАТИ У БРАК ВКЯ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderAdminCardModal()}

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; borderRadius: 3px; }
      `}} />
    </div>
  )
}
export default Shop2Terminal
