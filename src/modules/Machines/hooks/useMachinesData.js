import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useMES } from '../../../MESContext.jsx'
import { apiService } from '../../../services/apiDispatcher.js'
import { supabase } from '../../../supabase.js'
import { isCardAssignedToMachine } from '../utils/machineDashboardUtils.js'
import { parseMachineQRId } from '../../../utils/machineQrUtils.js'

export const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

export function useMachinesData() {
  const { id: urlMachineId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { machines, addMachine, updateMachine, deleteMachine, workCards, workCardHistory, nomenclatures, orders, tasks, loading, machineCalls, currentUser, fetchData } = useMES()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState(urlMachineId || null)
  const [selectedType, setSelectedType] = useState(null)
  const [form, setForm] = useState({ id: null, name: '', type: MACHINE_TYPES[0], capacity: '1', sequence_number: '', inventory_no: '', floor: '', description: '', status: 'idle' })
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    if (urlMachineId && String(urlMachineId) !== String(selectedMachineId)) {
      setSelectedMachineId(urlMachineId)
    } else if (!urlMachineId && location.pathname === '/machines' && selectedMachineId) {
      setSelectedMachineId(null)
    }
  }, [urlMachineId, location.pathname, selectedMachineId])

  const handleSelectMachine = useCallback((id) => {
    setSelectedMachineId(id)
    if (id) {
      if (location.pathname !== `/machines/${id}`) {
        navigate(`/machines/${id}`)
      }
    } else {
      const returnRoute = sessionStorage.getItem('machine_return_route')
      if (returnRoute) {
        sessionStorage.removeItem('machine_return_route')
        navigate(returnRoute)
      } else if (location.pathname !== '/machines') {
        navigate('/machines')
      }
    }
  }, [navigate, location.pathname])
  
  const [maintenanceLogs, setMaintenanceLogs] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState(null)

  const fetchMaintenanceLogs = useCallback(async (machineId) => {
    if (!machineId) return []
    const { data, error } = await supabase.from('machine_maintenance_logs')
      .select('*')
      .eq('machine_id', machineId)
      .order('triggered_at', { ascending: false })
    if (error) throw error
    return data || []
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(async () => {
      try {
        const logs = await fetchMaintenanceLogs(selectedMachineId)
        if (!cancelled) setMaintenanceLogs(logs)
      } catch (error) {
        console.warn('[Machines] Failed to load maintenance history:', error)
      }
    })
    return () => { cancelled = true }
  }, [selectedMachineId, machines, fetchMaintenanceLogs])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("machine-qr-reader", {
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false
      })
      const config = { fps: 20, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => { })
        setIsScanning(false)
      }
      html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        try {
          const machineId = parseMachineQRId(decodedText)
          if (machineId) {
            const foundMach = (machines || []).find(m => String(m.id).trim() === machineId.trim())
            if (foundMach) {
              setSelectedMachineId(foundMach.id)
              setScanError(null)
              await stopAndClose()
            } else {
              setScanError("Верстат не знайдено в базі даних.")
            }
          } else {
            setScanError("Невірний QR-код верстата. Скануйте лише QR-код обладнання.")
          }
        } catch {
          setScanError("Помилка зчитування QR-коду.")
        }
      }).catch(err => {
        setScanError("Помилка камери: " + err)
        setIsScanning(false)
      })
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {})
      }
    }
  }, [isScanning, machines])

  const isCardOnMachine = (c, m) => {
    return isCardAssignedToMachine(c, m)
  }

  const activeWorkForMachine = (m) => {
    return workCards.find(c => c.status === 'in-progress' && String(c.operation || '').trim().toLowerCase() === 'розкрій' && isCardOnMachine(c, m));
  }

  const activeCallsForMachine = useMemo(() => {
    if (!selectedMachineId || !machineCalls) return []
    return machineCalls.filter(c => c.machine_id === selectedMachineId && c.status === 'pending')
  }, [machineCalls, selectedMachineId])

  const handlePrintQR = (machine) => {
    const machineUrl = `${window.location.origin}/machines/${machine.id}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=000000&bgcolor=ffffff&data=${encodeURIComponent(machineUrl)}`
    const printWindow = window.open('', '_blank', 'width=600,height=650')
    printWindow.document.write(`
      <html>
        <head>
          <title>Картка верстата - QR-код - ${machine.name}</title>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #000;
              background: #fff;
            }
            .container {
              border: 4px solid #000;
              padding: 45px;
              border-radius: 28px;
              width: 90%;
              max-width: 440px;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              box-sizing: border-box;
            }
            h1 {
              font-size: 2.5rem;
              margin: 0 0 10px 0;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -0.5px;
              line-height: 1.1;
            }
            .subtitle {
              font-size: 1.1rem;
              margin: 0 0 25px 0;
              color: #333;
              font-weight: 700;
              border-bottom: 2px solid #eee;
              padding-bottom: 15px;
              width: 100%;
            }
            .qr-image {
              width: 280px;
              height: 280px;
              margin: 0 0 20px 0;
              display: block;
            }
            .instructions {
              font-size: 1.1rem;
              font-weight: 800;
              text-transform: uppercase;
              line-height: 1.4;
              margin-top: 10px;
            }
            .instructions span {
              display: inline-block;
              border: 1.5px solid #000;
              padding: 3px 8px;
              border-radius: 6px;
              font-size: 0.85rem;
              margin: 3px;
              font-weight: 900;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .container {
                border: 4px solid #000 !important;
                border-radius: 28px !important;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${machine.name}</h1>
            <div class="subtitle">
              ${machine.type || ''} ${machine.sequence_number ? ' • №' + machine.sequence_number : ''}
            </div>
            <img class="qr-image" src="${qrUrl}" alt="QR Code" />
            <div class="instructions">
              ЗСКАНУЙТЕ ДЛЯ КАРТКИ ВЕРСТАТА:<br/>
              <span>ОБСЛУГОВУВАННЯ</span>
              <span>МАЙСТЕР</span>
              <span>ІНЖЕНЕР</span>
              <span>ВКЯ</span>
              <div style="font-size: 0.82rem; font-weight: 600; color: #555; margin-top: 8px; text-transform: none;">
                Початок ТО, виклик персоналу та моніторинг роботи
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 400);
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const stats = useMemo(() => {
    const total = machines.length
    const repair = machines.filter(m => m.status === 'repair').length
    const busy = machines.filter(m => m.status !== 'repair' && workCards.some(c => c.status === 'in-progress' && String(c.operation || '').trim().toLowerCase() === 'розкрій' && isCardOnMachine(c, m))).length
    return { total, busy, repair, idle: total - busy - repair }
  }, [machines, workCards])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return
    try {
      const payload = {
        name: form.name,
        type: form.type || null,
        sheet_capacity: parseInt(form.capacity) || 0,
        sequence_number: form.sequence_number || null,
        inventory_no: form.inventory_no || null,
        floor: form.floor || null,
        description: form.description || null,
        status: form.status || 'idle'
      }

      if (form.id) {
        await apiService.submitUpdateMachine(form.id, payload, updateMachine)
      } else {
        await apiService.submitMachine(payload, addMachine)
      }
      
      setForm({ id: null, name: '', type: MACHINE_TYPES[0], capacity: '1', sequence_number: '', inventory_no: '', floor: '', description: '', status: 'idle' })
      setShowAdd(false)
    } catch (err) {
      alert('Помилка: ' + err.message)
    }
  }

  const handleEdit = (m) => {
    setForm({ 
      id: m.id, 
      name: m.name, 
      type: m.type || MACHINE_TYPES[0],
      capacity: m.sheet_capacity || '1', 
      sequence_number: m.sequence_number || '',
      inventory_no: m.inventory_no || '', 
      floor: m.floor || '', 
      description: m.description || '',
      status: m.status || 'idle'
    })
    setShowAdd(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id, name) => {
    if (window.confirm(`Видалити верстат "${name}"?`)) {
      try {
        await apiService.submitDelete(id, 'machine', deleteMachine)
      } catch (err) {
        alert('Помилка: ' + err.message)
      }
    }
  }

  const selectedMachine = machines.find(m => String(m.id) === String(selectedMachineId))

  const getCurrentUserName = () => {
    const fullName = currentUser
      ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
      : ''
    return fullName || currentUser?.name || currentUser?.login || 'Співробітник'
  }

  const refreshMachineData = async () => {
    if (typeof fetchData === 'function') await fetchData(['machines', 'machine_calls'])
    const logs = await fetchMaintenanceLogs(selectedMachineId)
    setMaintenanceLogs(logs)
  }

  const updateMaintenanceLogWithFallback = async (queryFactory, payload) => {
    let result = await queryFactory(payload)
    if (!result.error) return result

    const legacyPayload = { ...payload }
    delete legacyPayload.maintenance_type
    delete legacyPayload.machine_head
    delete legacyPayload.spare_part
    delete legacyPayload.notes
    if (Object.keys(legacyPayload).length === Object.keys(payload).length) return result
    result = await queryFactory(legacyPayload)
    return result
  }

  const startMachineMaintenance = async ({ type, machineHead = null, sparePart = null, notes = '' }) => {
    if (!selectedMachine) throw new Error('Верстат не вибрано')
    const nowISO = new Date().toISOString()
    const { error: machineError } = await supabase.from('machines').update({
      status: 'under_maintenance',
      maintenance_started_at: nowISO
    }).eq('id', selectedMachine.id)
    if (machineError) throw machineError

    const { data: pendingLogs, error: pendingError } = await supabase.from('machine_maintenance_logs')
      .select('*')
      .eq('machine_id', selectedMachine.id)
      .eq('status', 'pending')
      .order('triggered_at', { ascending: false })
      .limit(1)
    if (pendingError) throw pendingError

    const pendingLog = pendingLogs?.[0]
    const responseSeconds = pendingLog?.triggered_at
      ? Math.max(0, Math.floor((new Date(nowISO) - new Date(pendingLog.triggered_at)) / 1000))
      : 0
    const payload = {
      status: 'in_progress',
      started_at: nowISO,
      response_duration_seconds: responseSeconds,
      maintenance_type: type,
      machine_head: machineHead,
      spare_part: sparePart,
      notes: String(notes || '').trim() || null
    }

    const result = pendingLog
      ? await updateMaintenanceLogWithFallback(
          values => supabase.from('machine_maintenance_logs').update(values).eq('id', pendingLog.id),
          payload
        )
      : await updateMaintenanceLogWithFallback(
          values => supabase.from('machine_maintenance_logs').insert([{
            machine_id: selectedMachine.id,
            triggered_at: nowISO,
            ...values
          }]),
          payload
        )
    if (result.error) throw result.error
    await refreshMachineData()
  }

  const completeMachineMaintenance = async () => {
    if (!selectedMachine) throw new Error('Верстат не вибрано')
    const nowISO = new Date().toISOString()
    const { error: machineError } = await supabase.from('machines').update({
      status: 'working',
      completed_cards_count_since_maintenance: 0,
      maintenance_pending_since: null,
      maintenance_started_at: null
    }).eq('id', selectedMachine.id)
    if (machineError) throw machineError

    const { data: activeLogs, error: activeError } = await supabase.from('machine_maintenance_logs')
      .select('*')
      .eq('machine_id', selectedMachine.id)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
    if (activeError) throw activeError

    const log = activeLogs?.[0]
    if (log) {
      const durationSeconds = log.started_at
        ? Math.max(0, Math.floor((new Date(nowISO) - new Date(log.started_at)) / 1000))
        : 0
      const { error } = await supabase.from('machine_maintenance_logs').update({
        status: 'completed',
        completed_at: nowISO,
        performed_by: getCurrentUserName(),
        maintenance_duration_seconds: durationSeconds
      }).eq('id', log.id)
      if (error) throw error
    }
    await refreshMachineData()
  }

  const getHistoryForMachine = (m) => {
    if (!m) return [];
    const mid = String(m.id || '');

    const fromHistory = workCardHistory.filter(h => {
      const stage = String(h.stage_name || '').trim().toLowerCase()
      if (stage && !stage.includes('розкрій')) return false
      const info = String(h.card_info || '');
      const taggedId = info.match(/\[MACHINE_ID:([^\]]*)\]/i)?.[1]?.trim()
      if (taggedId) return taggedId === mid
      const taggedName = info.match(/\[MACHINE_NAME:([^\]]*)\]/i)?.[1]?.trim()
      if (taggedName) return isCardOnMachine({ ...h, machine_id: null, machine_name: taggedName }, m)

      return isCardOnMachine(h, m);
    });

    const cuttingCards = workCards.filter(c =>
      String(c.operation || '').trim().toLowerCase() === 'розкрій' && isCardOnMachine(c, m)
    )
    const hasRealOperator = card => {
      const operator = String(card.operator_name || '').trim().toLowerCase()
      return Boolean(operator && !['—', '-', 'не вказано', 'невідомо'].includes(operator))
    }
    const activeCandidates = cuttingCards
      .filter(c => c.status === 'in-progress' && c.started_at && hasRealOperator(c))
      .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0))
    const currentActiveId = activeCandidates[0]?.id

    const fromActive = activeCandidates.map(c => ({
      ...c,
      card_id: c.id,
      qty_completed: c.quantity,
      scrap_qty: 0,
      is_active: c.id === currentActiveId,
      is_conflict: c.id !== currentActiveId
    }));

    return [...fromHistory, ...fromActive].sort((a, b) =>
      new Date(b.completed_at || b.started_at || b.created_at) - new Date(a.completed_at || a.started_at || a.created_at)
    );
  }

  const calculateTotalTime = (m) => {
    const history = getHistoryForMachine(m);
    let totalMs = 0;
    history.forEach(h => {
      if (h.started_at && h.completed_at) {
        totalMs += (new Date(h.completed_at) - new Date(h.started_at));
      }
    });
    
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    
    if (hours === 0 && minutes === 0) return '0г 0хв';
    return `${hours}г ${minutes}хв`;
  }

  const formatElapsed = (startIso) => {
    if (!startIso) return '00:00:00'
    const start = new Date(startIso)
    const diff = Math.floor((currentTime - start) / 1000)
    if (isNaN(diff) || diff < 0) return '00:00:00'
    const h = Math.floor(diff / 3600).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
    const s = (diff % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const formatPlanned = (minutes) => {
    if (!minutes) return '—'
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    if (h > 0) return `${h}год ${m}хв`
    return `${m}хв`
  }

  return {
    machines,
    loading,
    tasks,
    orders,
    workCards,
    nomenclatures,
    currentUser,
    supabase,
    fetchData,
    showAdd,
    setShowAdd,
    selectedMachineId,
    setSelectedMachineId: handleSelectMachine,
    selectedType,
    setSelectedType,
    form,
    setForm,
    currentTime,
    maintenanceLogs,
    isScanning,
    setIsScanning,
    scanError,
    setScanError,
    stats,
    selectedMachine,
    activeCallsForMachine,
    isCardOnMachine,
    activeWorkForMachine,
    handlePrintQR,
    handleSubmit,
    handleEdit,
    handleDelete,
    getHistoryForMachine,
    calculateTotalTime,
    startMachineMaintenance,
    completeMachineMaintenance,
    formatElapsed,
    formatPlanned
  }
}
