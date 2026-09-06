import { useState, useMemo, useEffect } from 'react'
import { useMES } from '../../../MESContext.jsx'
import { apiService } from '../../../services/apiDispatcher.js'
import { supabase } from '../../../supabase.js'

export const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

export function useMachinesData() {
  const { machines, addMachine, updateMachine, deleteMachine, workCards, workCardHistory, nomenclatures, orders, tasks, loading, machineCalls, currentUser, fetchData } = useMES()
  const [showAdd, setShowAdd] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [form, setForm] = useState({ id: null, name: '', type: MACHINE_TYPES[0], capacity: '1', sequence_number: '', inventory_no: '', floor: '', description: '', status: 'idle' })
  const [currentTime, setCurrentTime] = useState(new Date())
  
  const [maintenanceLogs, setMaintenanceLogs] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState(null)

  useEffect(() => {
    if (selectedMachineId) {
      supabase.from('machine_maintenance_logs')
        .select('*')
        .eq('machine_id', selectedMachineId)
        .order('triggered_at', { ascending: false })
        .then(({ data }) => {
          if (data) setMaintenanceLogs(data)
        })
    } else {
      setMaintenanceLogs([])
    }
  }, [selectedMachineId, machines])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let html5QrCode = null
    if (isScanning && window.Html5Qrcode) {
      html5QrCode = new window.Html5Qrcode("machine-qr-reader")
      const config = { fps: 15, qrbox: { width: 260, height: 260 } }
      const stopAndClose = async () => {
        if (html5QrCode && html5QrCode.isScanning) await html5QrCode.stop().catch(() => { })
        setIsScanning(false)
      }
      html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        try {
          const match = String(decodedText || '').match(/\/machines\/([a-f0-9-]+)/i)
          if (match) {
            const machineId = match[1]
            const foundMach = (machines || []).find(m => String(m.id).trim() === machineId.trim())
            if (foundMach) {
              setSelectedMachineId(foundMach.id)
              setScanError(null)
              await stopAndClose()
            } else {
              setScanError("Верстат не знайдено в базі даних.")
            }
          } else {
            setScanError("Невірний QR-код верстата.")
          }
        } catch (e) {
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
    if (!c || !m) return false;
    if (c.machine_id === m.id) return true;

    const cardMachineTxt = String(c.machine || '').toLowerCase().trim();
    if (!cardMachineTxt || cardMachineTxt === 'не вказано') return false;

    const machName = String(m.name || '').toLowerCase().trim();
    const machInv = String(m.inventory_no || '').toLowerCase().trim();
    const machSeq = String(m.sequence_number || '').toLowerCase().trim();
    const machType = String(m.type || '').toLowerCase().trim();

    if (machName && cardMachineTxt === machName) return true;
    if (machInv && cardMachineTxt === machInv) return true;
    
    if (machType && machSeq && cardMachineTxt.includes(machType) && (cardMachineTxt.includes(`№${machSeq}`) || cardMachineTxt.includes(` ${machSeq}`))) return true;

    if (machInv && (cardMachineTxt.includes(`№${machInv}`) || cardMachineTxt.includes(` ${machInv}`))) return true;

    if (machSeq && machType && cardMachineTxt.includes(machType) && cardMachineTxt.endsWith(machSeq)) return true;

    return false;
  }

  const activeWorkForMachine = (m) => {
    return workCards.find(c => c.status === 'in-progress' && String(c.operation || '').trim().toLowerCase() === 'розкрій' && isCardOnMachine(c, m));
  }

  const activeCallsForMachine = useMemo(() => {
    if (!selectedMachineId || !machineCalls) return []
    return machineCalls.filter(c => c.machine_id === selectedMachineId && c.status === 'pending')
  }, [machineCalls, selectedMachineId])

  const handlePrintQR = (machine) => {
    const callUrl = `${window.location.origin}/machines/${machine.id}/call`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=000000&bgcolor=ffffff&data=${encodeURIComponent(callUrl)}`
    const printWindow = window.open('', '_blank', 'width=600,height=650')
    printWindow.document.write(`
      <html>
        <head>
          <title>Друк QR-коду - ${machine.name}</title>
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
              ЗКСАНУЙТЕ ДЛЯ ВИКЛИКУ:<br/>
              <span>МАЙСТЕР</span>
              <span>ІНЖЕНЕР</span>
              <span>ВКЯ</span>
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

  const selectedMachine = machines.find(m => m.id === selectedMachineId)

  const getHistoryForMachine = (m) => {
    if (!m) return [];
    const mid = String(m.id || '');

    const fromHistory = workCardHistory.filter(h => {
      const hMid = String(h.machine_id || '');
      if (hMid && hMid === mid) return true;
      
      const info = String(h.card_info || '');
      if (info.includes(`[MACHINE_ID:${mid}]`)) return true;
      if (m.name && info.includes(`[MACHINE_NAME:${m.name}]`)) return true;

      return isCardOnMachine(h, m);
    });

    const fromWaiting = workCards.filter(c => 
      c.status === 'waiting-buffer' && String(c.operation || '').trim().toLowerCase() === 'розкрій' && isCardOnMachine(c, m)
    ).map(c => ({
      ...c,
      card_id: c.id,
      qty_completed: c.quantity,
      scrap_qty: 0,
      is_pending: true
    }));

    const fromActive = workCards.filter(c => 
      (c.status === 'in-progress' || c.status === 'new') && String(c.operation || '').trim().toLowerCase() === 'розкрій' && isCardOnMachine(c, m)
    ).map(c => ({
      ...c,
      card_id: c.id,
      qty_completed: c.quantity,
      scrap_qty: 0,
      is_active: true
    }));

    return [...fromHistory, ...fromWaiting, ...fromActive].sort((a, b) => 
      new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at)
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
    nomenclatures,
    currentUser,
    supabase,
    showAdd,
    setShowAdd,
    selectedMachineId,
    setSelectedMachineId,
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
    formatElapsed,
    formatPlanned
  }
}
