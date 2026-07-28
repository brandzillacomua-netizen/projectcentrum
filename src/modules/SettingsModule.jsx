import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Search,
  Cpu,
  X,
  Users as UsersIcon,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Edit3,
  Filter,
  Activity,
  Briefcase,
  UserPlus,
  RefreshCw,
  Building,
  Hammer,
  Truck,
  Users,
  Layers,
  Upload,
  Download,
  Sliders
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMES } from '../MESContext'

const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'ніколи'
  const date = new Date(lastSeen)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return 'щойно'
  
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'щойно'
  if (diffMins < 60) return `${diffMins} хв. тому`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} год. тому`
  
  return date.toLocaleString('uk-UA', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

const SettingsModule = () => {
  const { 
    systemUsers, currentUser, upsertUser, deleteUser, logout,
    fortnetUrl, updateFortnetUrl, accessLogs,
    companyStructure, upsertCompanyStructure, deleteCompanyStructure,
    companyPositions, upsertCompanyPosition, deleteCompanyPosition,
    supabase,
    nomenclatures, bomItems, inventory, refreshTable,
    maintenanceCheckEnabled, updateMaintenanceCheckEnabled
  } = useMES()

  // BZ remnants upload states
  const [bzFile, setBzFile] = useState(null)
  const [bzDelimiter, setBzDelimiter] = useState(';')
  const [bzRecordMode, setBzRecordMode] = useState('add') // 'add' or 'overwrite'
  const [bzUploadStatus, setBzUploadStatus] = useState('idle') // 'idle', 'preview', 'uploading', 'success', 'error'
  const [bzUploadLog, setBzUploadLog] = useState('')
  const [bzActivePreviewTab, setBzActivePreviewTab] = useState('leftovers') // 'kits', 'leftovers', 'unrecognized'
  const [bzAssembledKits, setBzAssembledKits] = useState([])
  const [bzLeftovers, setBzLeftovers] = useState([])
  const [bzUnrecognized, setBzUnrecognized] = useState([])

  // Prepared sheets upload states
  const [sheetsFile, setSheetsFile] = useState(null)
  const [sheetsDelimiter, setSheetsDelimiter] = useState(';')
  const [sheetsRecordMode, setSheetsRecordMode] = useState('add') // 'add' or 'overwrite'
  const [sheetsUploadStatus, setSheetsUploadStatus] = useState('idle') // 'idle', 'preview', 'uploading', 'success', 'error'
  const [sheetsUploadLog, setSheetsUploadLog] = useState('')
  const [sheetsActivePreviewTab, setSheetsActivePreviewTab] = useState('all') // 'all', 'new'
  const [sheetsPreviewList, setSheetsPreviewList] = useState([])

  // Cutter (фрези) stock upload states
  const [cuttersFile, setCuttersFile] = useState(null)
  const [cuttersRecordMode, setCuttersRecordMode] = useState('overwrite')
  const [cuttersUploadStatus, setCuttersUploadStatus] = useState('idle')
  const [cuttersUploadLog, setCuttersUploadLog] = useState('')
  const [cuttersPreviewList, setCuttersPreviewList] = useState([])

  // Fasteners (метизи) stock upload states
  const [fastenersFile, setFastenersFile] = useState(null)
  const [fastenersRecordMode, setFastenersRecordMode] = useState('overwrite')
  const [fastenersUploadStatus, setFastenersUploadStatus] = useState('idle')
  const [fastenersUploadLog, setFastenersUploadLog] = useState('')
  const [fastenersPreviewList, setFastenersPreviewList] = useState([])


  // Tabs: users, structure, system
  const [activeTab, setActiveTab] = useState('users') 
  const [structureSubTab, setStructureSubTab] = useState('departments')
  const [tempFortnetUrl, setTempFortnetUrl] = useState(fortnetUrl)

  // Start pages settings states
  const [savingPosId, setSavingPosId] = useState(null)
  const [sqlErrorPosition, setSqlErrorPosition] = useState(false)

  // CSV Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [csvDelimiter, setCsvDelimiter] = useState(';')
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [columnMapping, setColumnMapping] = useState({
    login: -1,
    password: -1,
    first_name: -1,
    last_name: -1,
    department: -1,
    position: -1,
    shift: -1
  })
  const [defaultValues, setDefaultValues] = useState({
    password: 'password123',
    department: companyStructure?.[0]?.name || 'Цех №1',
    position: companyPositions?.[0]?.name || 'Оператор',
    shift: 'Без зміни',
    access_rights: { operator: true }
  })
  const [duplicatePolicy, setDuplicatePolicy] = useState('skip') // 'skip' or 'update'
  const [importStatus, setImportStatus] = useState('idle') // 'idle', 'preview', 'importing', 'success', 'error'
  const [importLog, setImportLog] = useState('')
  // Snapshot correction state
  const [corrSearchQuery, setCorrSearchQuery] = useState('')
  const [corrFoundTasks, setCorrFoundTasks] = useState([])
  const [corrSelectedTask, setCorrSelectedTask] = useState(null)
  const [corrSnapshotParts, setCorrSnapshotParts] = useState([])
  const [corrIsSaving, setCorrIsSaving] = useState(false)
  const [corrSearchLoading, setCorrSearchLoading] = useState(false)

  const handleSearchTasks = async () => {
    if (!corrSearchQuery.trim()) return
    setCorrSearchLoading(true)
    setCorrFoundTasks([])
    setCorrSelectedTask(null)
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_num, customer')
        .ilike('order_num', `%${corrSearchQuery.trim()}%`)
      
      if (ordersError) throw ordersError
      
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id)
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
          
        if (tasksError) throw tasksError
        
        const mapped = (tasksData || []).map(t => {
          const ord = ordersData.find(o => o.id === t.order_id)
          return {
            ...t,
            order_num: ord ? ord.order_num : 'Невідомо',
            customer: ord ? ord.customer : 'Невідомо'
          }
        })
        setCorrFoundTasks(mapped)
      } else {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*, orders(order_num, customer)')
          .eq('id', corrSearchQuery.trim())
        if (!tasksError && tasksData && tasksData.length > 0) {
          const mapped = tasksData.map(t => ({
            ...t,
            order_num: t.orders ? t.orders.order_num : 'Невідомо',
            customer: t.orders ? t.orders.customer : 'Невідомо'
          }))
          setCorrFoundTasks(mapped)
        }
      }
    } catch (err) {
      console.error(err)
      alert('Помилка пошуку нарядів: ' + err.message)
    } finally {
      setCorrSearchLoading(false)
    }
  }

  const handleSelectTask = (task) => {
    setCorrSelectedTask(task)
    if (task && task.plan_snapshot) {
      const parts = []
      Object.entries(task.plan_snapshot).forEach(([key, val]) => {
        if (key !== 'materialSummary' && key !== 'selectedCutters' && key !== 'consumables' && !key.startsWith('_')) {
          parts.push({
            nomenclature_id: key,
            id: val.id || key,
            name: val.name || 'Без назви',
            code: val.code || 'Без коду',
            need: Number(val.need) || 0,
            stock: Number(val.stock) || 0,
            plan: Number(val.plan) || 0,
            sheets: Number(val.sheets) || 0,
            sheets_t300: Number(val.sheets_t300) || 0,
            sheets_t700: Number(val.sheets_t700) || 0,
            units_per_sheet: Number(val.units_per_sheet) || 1,
            material: val.material || '',
            order_item_id: val.order_item_id || '',
            selected_machine: val.selected_machine || val.machine || '',
            cutter_override: val.cutter_override || '2',
            splits: val.splits || []
          })
        }
      })
      setCorrSnapshotParts(parts)
    } else {
      setCorrSnapshotParts([])
    }
  }

  const handlePartStockChange = (nomId, val) => {
    const newStock = Math.max(0, parseInt(val) || 0)
    setCorrSnapshotParts(prev => prev.map(p => {
      if (p.nomenclature_id === nomId) {
        const newPlan = Math.max(0, p.need - newStock)
        const unitsPerSheet = p.units_per_sheet || 1
        const newSheets = Math.ceil(newPlan / unitsPerSheet)
        const isT700 = (p.material || p.name || '').toLowerCase().includes('т700') || (p.material || p.name || '').toLowerCase().includes('t700')
        return {
          ...p,
          stock: newStock,
          plan: newPlan,
          sheets: newSheets,
          sheets_t300: isT700 ? 0 : newSheets,
          sheets_t700: isT700 ? newSheets : 0
        }
      }
      return p
    }))
  }

  const handlePartSheetsChange = (nomId, val) => {
    const newSheets = Math.max(0, parseInt(val) || 0)
    setCorrSnapshotParts(prev => prev.map(p => {
      if (p.nomenclature_id === nomId) {
        const isT700 = (p.material || p.name || '').toLowerCase().includes('т700') || (p.material || p.name || '').toLowerCase().includes('t700')
        return {
          ...p,
          sheets: newSheets,
          sheets_t300: isT700 ? 0 : newSheets,
          sheets_t700: isT700 ? newSheets : 0
        }
      }
      return p
    }))
  }

  const handleSaveCorrection = async () => {
    if (!corrSelectedTask) return
    if (!window.confirm('Ви впевнені, що хочете зберегти ці зміни снапшоту? Це оновить дані в наряді, запитах матеріалів та картах БЗ.')) return
    
    setCorrIsSaving(true)
    try {
      const taskId = corrSelectedTask.id
      const orderId = corrSelectedTask.order_id
      
      const { data: siblingTasks, error: siblingErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('order_id', orderId)
        
      if (siblingErr) throw siblingErr

      const { data: materialRequests, error: matErr } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', taskId)
        
      if (matErr) throw matErr

      const { data: workCardsData, error: wcErr } = await supabase
        .from('work_cards')
        .select('*')
        .eq('task_id', taskId)
        
      if (wcErr) throw wcErr

      const dbWrites = []

      for (const siblingTask of (siblingTasks || [])) {
        const currentSnap = siblingTask.plan_snapshot || {}
        const newSnap = { ...currentSnap }
        
        corrSnapshotParts.forEach(p => {
          newSnap[p.nomenclature_id] = {
            id: p.id,
            name: p.name,
            code: p.code,
            need: p.need,
            stock: p.stock,
            plan: p.plan,
            sheets: p.sheets,
            sheets_t300: p.sheets_t300,
            sheets_t700: p.sheets_t700,
            material: p.material,
            order_item_id: p.order_item_id,
            selected_machine: p.selected_machine,
            machine: p.selected_machine,
            cutter_override: p.cutter_override,
            splits: p.splits,
            units_per_sheet: p.units_per_sheet
          }
        })
        
        if (newSnap.materialSummary) {
          const newMatSummary = { ...newSnap.materialSummary }
          
          corrSnapshotParts.forEach(p => {
            Object.entries(newMatSummary).forEach(([matId, matInfo]) => {
              if (matInfo.components) {
                const hasComp = matInfo.components.some(c => c.startsWith(p.name + ':'))
                if (hasComp) {
                  newMatSummary[matId] = {
                    ...matInfo,
                    sheets: p.sheets,
                    totalUnits: p.plan,
                    components: [`${p.name}: ${p.plan}шт`]
                  }
                }
              }
            })
          })
          newSnap.materialSummary = newMatSummary
        }
        
        dbWrites.push(
          supabase.from('tasks').update({ plan_snapshot: newSnap }).eq('id', siblingTask.id)
        )
      }

      corrSnapshotParts.forEach(p => {
        const matchingRequest = (materialRequests || []).find(r => 
          r.details && 
          r.details.includes('СКЛАД ОПЕРАТИВНИЙ:') && 
          r.details.includes(p.name)
        )
        if (matchingRequest) {
          const cleanMatName = matchingRequest.details.match(/СКЛАД ОПЕРАТИВНИЙ:\s*(.*?)\s*—/)?.[1] || 'Лист'
          const updatedDetails = `СКЛАД ОПЕРАТИВНИЙ: ${cleanMatName} — ${p.sheets} л. (Разом: ${p.plan} шт | Для: ${p.name}: ${p.plan}шт)`
          
          dbWrites.push(
            supabase.from('material_requests').update({
              quantity: p.sheets,
              details: updatedDetails
            }).eq('id', matchingRequest.id)
          )
        }
      })

      corrSnapshotParts.forEach(p => {
        const bzCard = (workCardsData || []).find(c => 
          String(c.nomenclature_id) === String(p.nomenclature_id) && 
          c.card_info && 
          c.card_info.includes('[ЗІ СКЛАДУ БЗ]')
        )
        
        if (bzCard) {
          if (p.stock > 0) {
            dbWrites.push(
              supabase.from('work_cards').update({ quantity: p.stock }).eq('id', bzCard.id)
            )
            dbWrites.push(
              supabase.from('work_card_history').update({
                qty_at_start: p.stock,
                qty_completed: p.stock
              }).eq('card_id', bzCard.id)
            )
          } else {
            dbWrites.push(
              supabase.from('work_cards').delete().eq('id', bzCard.id)
            )
            dbWrites.push(
              supabase.from('work_card_history').delete().eq('card_id', bzCard.id)
            )
          }
        } else if (p.stock > 0) {
          const createCard = async () => {
            const { data: insertedCard, error: insErr } = await supabase
              .from('work_cards')
              .insert([{
                task_id: taskId,
                order_id: orderId,
                nomenclature_id: p.nomenclature_id,
                quantity: p.stock,
                status: 'completed',
                operation: 'Склад БЗ',
                card_info: '[ЗІ СКЛАДУ БЗ]'
              }])
              .select()
              .single()
            if (!insErr && insertedCard) {
              await supabase.from('work_card_history').insert([{
                card_id: insertedCard.id,
                nomenclature_id: p.nomenclature_id,
                stage_name: 'Склад БЗ',
                operator_name: 'Склад (БРОНЬ)',
                qty_at_start: p.stock,
                qty_completed: p.stock,
                scrap_qty: 0,
                completed_at: new Date().toISOString()
              }])
            }
          }
          dbWrites.push(createCard())
        }
      })


      // 7. Adjust Inventory balances for BZ and Finished/SGP
      const partIds = corrSnapshotParts.map(p => p.nomenclature_id)
      const { data: currentInventory, error: invFetchErr } = await supabase
        .from('inventory')
        .select('*')
        .in('nomenclature_id', partIds)
        
      if (!invFetchErr && currentInventory) {
        corrSnapshotParts.forEach(p => {
          const originalPart = corrSelectedTask.plan_snapshot?.[p.nomenclature_id]
          const oldStock = originalPart ? (Number(originalPart.stock) || 0) : 0
          const diff = p.stock - oldStock
          
          if (diff !== 0) {
            // Adjust BZ stock (type: 'bz')
            const bzItem = currentInventory.find(i => 
              String(i.nomenclature_id) === String(p.nomenclature_id) && 
              i.type === 'bz'
            )
            if (bzItem) {
              dbWrites.push(
                supabase.from('inventory').update({
                  total_qty: Math.max(0, (Number(bzItem.total_qty) || 0) - diff),
                  updated_at: new Date().toISOString()
                }).eq('id', bzItem.id)
              )
            }

            // Adjust Finished stock (type: 'finished')
            const finishedItem = currentInventory.find(i => 
              String(i.nomenclature_id) === String(p.nomenclature_id) && 
              i.type === 'finished'
            )
            if (finishedItem) {
              dbWrites.push(
                supabase.from('inventory').update({
                  total_qty: Math.max(0, (Number(finishedItem.total_qty) || 0) + diff),
                  updated_at: new Date().toISOString()
                }).eq('id', finishedItem.id)
              )
            } else if (diff > 0) {
              dbWrites.push(
                supabase.from('inventory').insert([{
                  nomenclature_id: p.nomenclature_id,
                  name: p.name,
                  unit: 'шт',
                  total_qty: diff,
                  reserved_qty: 0,
                  type: 'finished',
                  updated_at: new Date().toISOString()
                }])
              )
            }
          }
        })
      }
  
      await Promise.all(dbWrites)
      alert('Зміни успішно збережено та застосовано!')
      
      refreshTable('tasks')
      refreshTable('material_requests')
      refreshTable('work_cards')
      refreshTable('inventory')
      
      const { data: updatedTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
        
      if (updatedTask) {
        const ord = siblingTasks[0]?.order_num ? siblingTasks[0] : { order_num: corrSelectedTask.order_num, customer: corrSelectedTask.customer }
        handleSelectTask({
          ...updatedTask,
          order_num: ord.order_num,
          customer: ord.customer
        })
      }
      
      setCorrFoundTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            plan_snapshot: updatedTask.plan_snapshot
          }
        }
        return t
      }))
    } catch (e) {
      console.error(e)
      alert('Помилка збереження змін: ' + e.message)
    } finally {
      setCorrIsSaving(false)
    }
  }


  // BZ Remnants Processing Helpers
  const handleBzFileChange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      
      setBzFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target.result
          const delim = detectDelimiter(text)
          setBzDelimiter(delim)
          
          const parsed = parseCSV(text, delim)
          if (parsed.length > 0) {
            processBzRemnants(parsed)
          } else {
            alert('Помилка: файл порожній або має невірний формат.')
          }
        } catch (innerErr) {
          console.error(innerErr)
          alert('Помилка обробки вмісту файлу залишків БЗ: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу залишків БЗ: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const normalizeHomoglyphs = (str) => {
    if (!str) return ''
    const mapper = {
      'а': 'a', 'в': 'v', 'с': 'c', 'е': 'e', 'н': 'h', 'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x', 'у': 'y', 'і': 'i', 'ї': 'i', 'є': 'e',
      'А': 'a', 'В': 'v', 'С': 'c', 'Е': 'e', 'Н': 'h', 'К': 'k', 'М': 'm', 'О': 'o', 'Р': 'p', 'Т': 't', 'Х': 'x', 'У': 'y', 'І': 'i', 'Ї': 'i', 'Є': 'e'
    }
    return str.toLowerCase().trim().split('').map(c => mapper[c] || c).join('').replace(/[^a-z0-9]/g, '')
  }

  const processBzRemnants = (parsedCsv) => {
    const headers = parsedCsv[0]
    
    const nameColIdx = headers.findIndex(h => {
      const norm = h.toLowerCase().trim()
      return norm.includes('номенклатура') || norm.includes('назва') || norm === 'name'
    })
    
    const qtyColIdx = headers.findIndex(h => {
      const norm = h.toLowerCase().trim()
      return norm.includes('склад') || norm.includes('кількість') || norm === 'qty' || norm === 'quantity'
    })

    if (nameColIdx === -1 || qtyColIdx === -1) {
      alert('Помилка: не знайдено обов\'язкові колонки ("Номенклатура" та "Склад") у CSV файлі.')
      return
    }

    const parsedRows = parsedCsv.slice(1)
    const matchedItems = []
    const unrecognized = []

    const dbNomMap = {}
    ;(nomenclatures || []).forEach(n => {
      dbNomMap[normalizeHomoglyphs(n.name)] = n
    })

    parsedRows.forEach((row, idx) => {
      const nameVal = row[nameColIdx]
      const qtyVal = parseInt(row[qtyColIdx]) || 0

      if (!nameVal || qtyVal <= 0) return

      const normName = normalizeHomoglyphs(nameVal)
      const matchedNom = dbNomMap[normName]

      if (matchedNom) {
        matchedItems.push({
          name: matchedNom.name,
          qty: qtyVal,
          nomenclature_id: matchedNom.id,
          type: matchedNom.type
        })
      } else {
        unrecognized.push({
          name: nameVal,
          qty: qtyVal,
          rowNum: idx + 2
        })
      }
    })

    const initialStock = {}
    matchedItems.forEach(item => {
      initialStock[item.nomenclature_id] = (initialStock[item.nomenclature_id] || 0) + item.qty
    })

    const assembledKits = []
    const componentsLeft = { ...initialStock }

    const leftovers = []
    Object.entries(componentsLeft).forEach(([nomId, qty]) => {
      if (qty <= 0) return
      const nomObj = (nomenclatures || []).find(n => n.id === nomId)
      if (nomObj) {
        leftovers.push({
          nomenclature_id: nomId,
          name: nomObj.name,
          qty,
          type: nomObj.type
        })
      }
    })

    setBzAssembledKits(assembledKits)
    setBzLeftovers(leftovers)
    setBzUnrecognized(unrecognized)
    setBzUploadStatus('preview')
  }

  const executeBzUpload = async () => {
    setBzUploadStatus('uploading')
    setBzUploadLog('Початок обробки залишків...\n')
    
    const existingInventory = inventory || []
    const updates = []
    const inserts = []
    const findOperationalInventory = (nomenclatureId, name, type) =>
      existingInventory.find(i =>
        i.warehouse === 'operational'
        && i.type === type
        && i.pocket_owner == null
        && (
          String(i.nomenclature_id) === String(nomenclatureId)
          || i.name === name
        )
      )

    try {
      setBzUploadLog(prev => prev + `Обробка зібраних комплектів (всього позицій: ${bzAssembledKits.length})...\n`)
      for (const kit of bzAssembledKits) {
        const product = kit.product
        const qtyToSet = kit.qty

        const existing = findOperationalInventory(product.id, product.name, 'finished')

        if (existing) {
          const newTotal = bzRecordMode === 'add' ? (Number(existing.total_qty) || 0) + qtyToSet : qtyToSet
          updates.push({
            id: existing.id,
            nomenclature_id: product.id,
            name: product.name,
            type: 'finished',
            warehouse: 'operational',
            unit: product.unit || 'шт',
            total_qty: newTotal,
            reserved_qty: existing.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[ОНОВИТИ СГП] ${product.name}: ${newTotal} шт (було ${existing.total_qty})\n`)
        } else {
          inserts.push({
            nomenclature_id: product.id,
            name: product.name,
            type: 'finished',
            warehouse: 'operational',
            unit: product.unit || 'шт',
            total_qty: qtyToSet,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[НОВИЙ СГП] ${product.name}: ${qtyToSet} шт\n`)
        }
      }

      setBzUploadLog(prev => prev + `Обробка залишків напівфабрикатів (всього позицій: ${bzLeftovers.length})...\n`)
      for (const left of bzLeftovers) {
        const existing = findOperationalInventory(left.nomenclature_id, left.name, 'bz')

        if (existing) {
          const newTotal = bzRecordMode === 'add' ? (Number(existing.total_qty) || 0) + left.qty : left.qty
          updates.push({
            id: existing.id,
            nomenclature_id: left.nomenclature_id,
            name: left.name,
            type: 'bz',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: newTotal,
            reserved_qty: existing.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[ОНОВИТИ БЗ] ${left.name}: ${newTotal} шт (було ${existing.total_qty})\n`)
        } else {
          inserts.push({
            nomenclature_id: left.nomenclature_id,
            name: left.name,
            type: 'bz',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: left.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setBzUploadLog(prev => prev + `[НОВИЙ БЗ] ${left.name}: ${left.qty} шт\n`)
        }
      }

      // ── UNRECOGNIZED: create in nomenclatures first, then add to BZ inventory ──
      if (bzUnrecognized.length > 0) {
        setBzUploadLog(prev => prev + `\nСтворення нових позицій в номенклатурі (${bzUnrecognized.length} шт)...\n`)
        for (const unr of bzUnrecognized) {
          if (!unr.qty || unr.qty <= 0) continue

          // 1. Insert into nomenclatures
          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: unr.name, type: 'part' }])
            .select()
            .single()

          if (nomErr) {
            setBzUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${unr.name}: ${nomErr.message}\n`)
            continue
          }

          setBzUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)

          // 2. Add to BZ inventory
          const existingInv = findOperationalInventory(newNom.id, newNom.name, 'bz')

          if (existingInv) {
            const newTotal = bzRecordMode === 'add' ? (Number(existingInv.total_qty) || 0) + unr.qty : unr.qty
            updates.push({
              id: existingInv.id,
              nomenclature_id: newNom.id,
              name: newNom.name,
              type: 'bz',
              warehouse: 'operational',
              unit: 'шт',
              total_qty: newTotal,
              reserved_qty: existingInv.reserved_qty || 0,
              updated_at: new Date().toISOString()
            })
            setBzUploadLog(prev => prev + `  [ОНОВИТИ БЗ] ${newNom.name}: ${newTotal} шт\n`)
          } else {
            inserts.push({
              nomenclature_id: newNom.id,
              name: newNom.name,
              type: 'bz',
              warehouse: 'operational',
              unit: 'шт',
              total_qty: unr.qty,
              reserved_qty: 0,
              updated_at: new Date().toISOString()
            })
            setBzUploadLog(prev => prev + `  [НОВИЙ БЗ] ${newNom.name}: ${unr.qty} шт\n`)
          }
        }
      }

      setBzUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      
      const batchOps = []
      if (updates.length > 0) {
        batchOps.push(supabase.from('inventory').upsert(updates))
      }
      if (inserts.length > 0) {
        batchOps.push(supabase.from('inventory').insert(inserts))
      }

      const results = await Promise.all(batchOps)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setBzUploadLog(prev => prev + `✅ Успішно оновлено базу даних!\n`)
      setBzUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setBzUploadLog(prev => prev + `❌ Помилка запису в БД: ${err.message || err}\n`)
      setBzUploadStatus('error')
    }
  }

  // Prepared Sheets Remnants Processing Helpers
  const handleSheetsFileChange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      
      setSheetsFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target.result
          const delim = detectDelimiter(text)
          setSheetsDelimiter(delim)
          
          const parsed = parseCSV(text, delim)
          if (parsed.length > 0) {
            processSheetsRemnants(parsed)
          } else {
            alert('Помилка: файл порожній або має невірний формат.')
          }
        } catch (innerErr) {
          console.error(innerErr)
          alert('Помилка обробки вмісту файлу залишків СО: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу залишків СО: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const processSheetsRemnants = (parsedCsv) => {
    const headers = parsedCsv[0]
    
    const nameColIdx = headers.findIndex(h => {
      const norm = h.toLowerCase().trim()
      return norm.includes('номенклатура') || norm.includes('назва') || norm === 'name'
    })
    
    const qtyColIdx = headers.findIndex(h => {
      const norm = h.toLowerCase().trim()
      return norm.includes('склад') || norm.includes('кількість') || norm === 'qty' || norm === 'quantity'
    })

    if (nameColIdx === -1 || qtyColIdx === -1) {
      alert('Помилка: не знайдено обов\'язкові колонки ("Номенклатура" та "Склад") у CSV файлі.')
      return
    }

    const parsedRows = parsedCsv.slice(1)
    const previewList = []

    const dbNomMap = {}
    ;(nomenclatures || []).forEach(n => {
      dbNomMap[normalizeHomoglyphs(n.name)] = n
    })

    parsedRows.forEach((row, idx) => {
      const nameVal = row[nameColIdx] ? row[nameColIdx].trim() : ''
      const qtyVal = parseInt(row[qtyColIdx]) || 0

      if (!nameVal || qtyVal <= 0) return

      const normName = normalizeHomoglyphs(nameVal)
      const matchedNom = dbNomMap[normName]

      if (matchedNom) {
        previewList.push({
          name: nameVal,
          qty: qtyVal,
          nomenclature_id: matchedNom.id,
          isNew: false,
          rowNum: idx + 2
        })
      } else {
        previewList.push({
          name: nameVal,
          qty: qtyVal,
          nomenclature_id: null,
          isNew: true,
          rowNum: idx + 2
        })
      }
    })

    setSheetsPreviewList(previewList)
    setSheetsUploadStatus('preview')
  }

  const executeSheetsUpload = async () => {
    setSheetsUploadStatus('uploading')
    setSheetsUploadLog('Початок обробки залишків СО (підготовлені листи)...\n')
    
    const existingInventory = inventory || []
    const updates = []
    const inserts = []

    try {
      // Step 1: Auto-create nomenclatures for isNew items
      const newItems = sheetsPreviewList.filter(item => item.isNew)
      const nomCache = {} // name -> ID mapping
      
      if (newItems.length > 0) {
        setSheetsUploadLog(prev => prev + `Створення нових позицій в номенклатурі (${newItems.length} шт)...\n`)
        for (const item of newItems) {
          if (nomCache[item.name]) {
            item.nomenclature_id = nomCache[item.name]
            item.isNew = false
            continue
          }
          
          const normName = normalizeHomoglyphs(item.name)
          const dbNom = (nomenclatures || []).find(n => normalizeHomoglyphs(n.name) === normName)
          if (dbNom) {
            item.nomenclature_id = dbNom.id
            item.isNew = false
            nomCache[item.name] = dbNom.id
            setSheetsUploadLog(prev => prev + `  ℹ️ [ІСНУЄ В БД] ${item.name}\n`)
            continue
          }

          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'raw' }])
            .select()
            .single()

          if (nomErr) {
            setSheetsUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${item.name}: ${nomErr.message}\n`)
            throw new Error(`Не вдалося створити номенклатуру ${item.name}: ${nomErr.message}`)
          }

          setSheetsUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)
          item.nomenclature_id = newNom.id
          nomCache[item.name] = newNom.id

          // Also create unprepared sheet if it is a prepared one
          if (item.name.toLowerCase().includes('підготовлений') && !item.name.toLowerCase().includes('непідготовлений')) {
            const unpreparedName = item.name
              .replace(/\[\s*підготовлений\s*\]/gi, '[Непідготовлений]')
              .replace(/\(\s*підготовлений\s*\)/gi, '(Непідготовлений)')
              .replace(/\bпідготовлений\b/gi, 'Непідготовлений')

            if (unpreparedName && unpreparedName !== item.name) {
              const normUnprepared = normalizeHomoglyphs(unpreparedName)
              const existingUnprepared = (nomenclatures || []).find(n => normalizeHomoglyphs(n.name) === normUnprepared)

              if (!existingUnprepared && !nomCache[unpreparedName]) {
                const { data: newUnprepared, error: unpErr } = await supabase
                  .from('nomenclatures')
                  .insert([{ name: unpreparedName, type: 'raw' }])
                  .select()
                  .single()

                if (unpErr) {
                  setSheetsUploadLog(prev => prev + `  ⚠️ [НОМ НЕПІДГОТОВЛЕНИЙ ПОМИЛКА] ${unpreparedName}: ${unpErr.message}\n`)
                } else {
                  setSheetsUploadLog(prev => prev + `  ✅ [НОМ НЕПІДГОТОВЛЕНИЙ СТВОРЕНО] ${newUnprepared.name} (ID: ${newUnprepared.id})\n`)
                  nomCache[unpreparedName] = newUnprepared.id
                }
              }
            }
          }
        }
      }

      setSheetsUploadLog(prev => prev + `Обробка залишків СО (всього позицій: ${sheetsPreviewList.length})...\n`)
      
      const groupedItems = {}
      sheetsPreviewList.forEach(item => {
        const id = item.nomenclature_id
        if (!id) return
        groupedItems[id] = (groupedItems[id] || 0) + item.qty
      })

      for (const [nomId, qtyVal] of Object.entries(groupedItems)) {
        const nomObj = (nomenclatures || []).find(n => n.id === nomId) || (sheetsPreviewList.find(i => i.nomenclature_id === nomId))
        const nameText = nomObj ? nomObj.name : 'Unknown'
        const unitText = nomObj?.unit || 'шт'
        
        const existing = existingInventory.find(i => 
          i.warehouse === 'operational' && 
          i.nomenclature_id === nomId && 
          i.type === 'raw'
        )

        if (existing) {
          const newTotal = sheetsRecordMode === 'add' ? (Number(existing.total_qty) || 0) + qtyVal : qtyVal
          updates.push({
            id: existing.id,
            nomenclature_id: nomId,
            name: nameText,
            type: 'raw',
            warehouse: 'operational',
            unit: unitText,
            total_qty: newTotal,
            reserved_qty: existing.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setSheetsUploadLog(prev => prev + `[ОНОВИТИ СО] ${nameText}: ${newTotal} шт (було ${existing.total_qty})\n`)
        } else {
          inserts.push({
            nomenclature_id: nomId,
            name: nameText,
            type: 'raw',
            warehouse: 'operational',
            unit: unitText,
            total_qty: qtyVal,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setSheetsUploadLog(prev => prev + `[НОВИЙ СО] ${nameText}: ${qtyVal} шт\n`)
        }
      }

      setSheetsUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      
      const batchOps = []
      if (updates.length > 0) {
        batchOps.push(supabase.from('inventory').upsert(updates))
      }
      if (inserts.length > 0) {
        batchOps.push(supabase.from('inventory').insert(inserts))
      }

      const results = await Promise.all(batchOps)
      for (const res of results) {
        if (res.error) throw res.error
      }

      setSheetsUploadLog(prev => prev + `✅ Успішно оновлено базу даних!\n`)
      setSheetsUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setSheetsUploadLog(prev => prev + `❌ Помилка запису в БД: ${err.message || err}\n`)
      setSheetsUploadStatus('error')
    }
  }

  // ── CUTTER (ФРЕЗИ) UPLOAD HELPERS ──

  const handleCuttersFileChange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      setCuttersFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target.result
          const delim = detectDelimiter(text)
          const parsed = parseCSV(text, delim)
          if (parsed.length > 0) {
            processCuttersCSV(parsed)
          } else {
            alert('Помилка: файл порожній або має невірний формат.')
          }
        } catch (innerErr) {
          console.error(innerErr)
          alert('Помилка обробки вмісту файлу фрез: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу фрез: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const processCuttersCSV = (parsedCsv) => {
    const headers = parsedCsv[0]
    const nameColIdx = headers.findIndex(h => {
      const n = h.toLowerCase().trim()
      return n.includes('номенклатура') || n.includes('назва') || n === 'name'
    })
    const diamColIdx = headers.findIndex(h => {
      const n = h.toLowerCase().trim()
      return n.includes('діаметр') || n.includes('diameter')
    })
    let qtyColIdx = headers.findIndex(h => h.toLowerCase().includes('залишок'))
    if (qtyColIdx === -1) qtyColIdx = headers.findIndex(h => {
      const n = h.toLowerCase().trim()
      return n.includes('склад') || n.includes('кількість') || n === 'qty'
    })
    if (nameColIdx === -1) {
      alert('Помилка: не знайдено колонку «Номенклатура».')
      return
    }
    const rows = parsedCsv.slice(1)
    const items = []
    rows.forEach((row, idx) => {
      const name = row[nameColIdx] ? row[nameColIdx].trim() : ''
      if (!name || !name.toLowerCase().startsWith('фреза')) return
      const rawDiam = diamColIdx !== -1 ? (row[diamColIdx] || '').replace(',', '.').trim() : ''
      const diameter = parseFloat(rawDiam) || 0
      const rawQty = qtyColIdx !== -1 ? (row[qtyColIdx] || '').trim() : ''
      const qty = parseInt(rawQty) || 0
      if (qty <= 0) return
      items.push({ name, diameter, qty, rowNum: idx + 2 })
    })
    items.sort((a, b) => {
      if (a.diameter !== b.diameter) return a.diameter - b.diameter
      return a.name.localeCompare(b.name, 'uk')
    })
    setCuttersPreviewList(items)
    setCuttersUploadStatus('preview')
  }

  const executeCuttersUpload = async () => {
    setCuttersUploadStatus('uploading')
    setCuttersUploadLog('Початок завантаження залишків фрез...\n')
    const existingInventory = inventory || []
    const updates = []
    const inserts = []
    
    // Group preview list by name to avoid duplicate queries or inserts in the same run
    const aggregatedCutters = {}
    cuttersPreviewList.forEach(item => {
      const key = item.name
      if (!aggregatedCutters[key]) {
        aggregatedCutters[key] = { ...item }
      } else {
        aggregatedCutters[key].qty += item.qty
      }
    })
    const groupedList = Object.values(aggregatedCutters)

    try {
      const dbNomMap = {}
      ;(nomenclatures || []).forEach(n => { dbNomMap[normalizeHomoglyphs(n.name)] = n })
      setCuttersUploadLog(prev => prev + `Обробка ${groupedList.length} унікальних позицій фрез...\n`)
      
      for (const item of groupedList) {
        const normName = normalizeHomoglyphs(item.name)
        let nomRecord = dbNomMap[normName]
        if (!nomRecord) {
          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'consumable' }])
            .select().single()
          if (nomErr) {
            setCuttersUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${item.name}: ${nomErr.message}\n`)
            continue
          }
          setCuttersUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)
          nomRecord = newNom
          dbNomMap[normName] = newNom
        }
        
        // Find existing inventory item for this nomenclature on the 'operational' (СО) warehouse
        const existingInv = existingInventory.find(i =>
          i.warehouse === 'operational' &&
          String(i.nomenclature_id) === String(nomRecord.id) &&
          i.type === 'consumable'
        )
        
        if (existingInv) {
          const newTotal = cuttersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id,
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: 'consumable',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: newTotal,
            reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + `[ОНОВИТИ СО] ${item.name}: ${newTotal} шт (Ø${item.diameter})\n`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: 'consumable',
            warehouse: 'operational',
            unit: 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setCuttersUploadLog(prev => prev + `[НОВИЙ СО] ${item.name}: ${item.qty} шт (Ø${item.diameter})\n`)
        }
      }
      
      setCuttersUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      const batchOps = []
      if (updates.length > 0) batchOps.push(supabase.from('inventory').upsert(updates))
      if (inserts.length > 0) batchOps.push(supabase.from('inventory').insert(inserts))
      const results = await Promise.all(batchOps)
      for (const res of results) { if (res.error) throw res.error }
      setCuttersUploadLog(prev => prev + `✅ Успішно оновлено базу даних!\n`)
      setCuttersUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setCuttersUploadLog(prev => prev + `❌ Помилка запису в БД: ${err.message || err}\n`)
      setCuttersUploadStatus('error')
    }
  }

  // ── FASTENERS (МЕТИЗИ) UPLOAD HELPERS ──

  const handleFastenersFileChange = async (e) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      setFastenersFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const text = event.target.result
          const delim = detectDelimiter(text)
          const parsed = parseCSV(text, delim)
          if (parsed.length > 0) {
            processFastenersCSV(parsed)
          } else {
            alert('Помилка: файл порожній або має невірний формат.')
          }
        } catch (innerErr) {
          console.error(innerErr)
          alert('Помилка обробки вмісту файлу метизів: ' + innerErr.message)
        }
        e.target.value = ''
      }
      reader.readAsText(file, 'UTF-8')
    } catch (err) {
      console.error(err)
      alert('Помилка завантаження файлу метизів: ' + err.message)
      if (e?.target) e.target.value = ''
    }
  }

  const processFastenersCSV = (parsedCsv) => {
    const headers = parsedCsv[0]
    const nameColIdx = headers.findIndex(h => {
      const n = h.toLowerCase().trim()
      return n.includes('номенклатура') || n.includes('назва') || n === 'name'
    })
    let qtyColIdx = headers.findIndex(h => h.toLowerCase().includes('залишок'))
    if (qtyColIdx === -1) qtyColIdx = headers.findIndex(h => {
      const n = h.toLowerCase().trim()
      return n.includes('склад') || n.includes('кількість') || n === 'qty'
    })
    if (nameColIdx === -1) {
      alert('Помилка: не знайдено колонку «Номенклатура».')
      return
    }
    const rows = parsedCsv.slice(1)
    const items = []
    rows.forEach((row, idx) => {
      const name = row[nameColIdx] ? row[nameColIdx].trim() : ''
      if (!name) return
      const rawQty = qtyColIdx !== -1 ? (row[qtyColIdx] || '').trim() : ''
      const qty = parseInt(rawQty) || 0
      if (qty <= 0) return
      items.push({ name, qty, rowNum: idx + 2 })
    })
    items.sort((a, b) => a.name.localeCompare(b.name, 'uk'))
    setFastenersPreviewList(items)
    setFastenersUploadStatus('preview')
  }

  const executeFastenersUpload = async () => {
    setFastenersUploadStatus('uploading')
    setFastenersUploadLog('Початок завантаження залишків метизів на СВ...\n')
    const existingInventory = inventory || []
    const updates = []
    const inserts = []

    // Group preview list by name
    const aggregatedFasteners = {}
    fastenersPreviewList.forEach(item => {
      const key = item.name
      if (!aggregatedFasteners[key]) {
        aggregatedFasteners[key] = { ...item }
      } else {
        aggregatedFasteners[key].qty += item.qty
      }
    })
    const groupedList = Object.values(aggregatedFasteners)

    try {
      const dbNomMap = {}
      ;(nomenclatures || []).forEach(n => { dbNomMap[normalizeHomoglyphs(n.name)] = n })
      setFastenersUploadLog(prev => prev + `Обробка ${groupedList.length} унікальних позицій метизів...\n`)

      for (const item of groupedList) {
        const normName = normalizeHomoglyphs(item.name)
        let nomRecord = dbNomMap[normName]
        if (!nomRecord) {
          const { data: newNom, error: nomErr } = await supabase
            .from('nomenclatures')
            .insert([{ name: item.name, type: 'hardware' }])
            .select().single()
          if (nomErr) {
            setFastenersUploadLog(prev => prev + `  ⚠️ [НОМ ПОМИЛКА] ${item.name}: ${nomErr.message}\n`)
            continue
          }
          setFastenersUploadLog(prev => prev + `  ✅ [НОМ СТВОРЕНО] ${newNom.name} (ID: ${newNom.id})\n`)
          nomRecord = newNom
          dbNomMap[normName] = newNom
        }

        // Find existing inventory item on SV ('production') warehouse
        const existingInv = existingInventory.find(i =>
          i.warehouse === 'production' &&
          String(i.nomenclature_id) === String(nomRecord.id)
        )

        if (existingInv) {
          const newTotal = fastenersRecordMode === 'add'
            ? (Number(existingInv.total_qty) || 0) + item.qty
            : item.qty
          updates.push({
            id: existingInv.id,
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: existingInv.type || 'hardware',
            warehouse: 'production',
            unit: existingInv.unit || 'шт',
            total_qty: newTotal,
            reserved_qty: existingInv.reserved_qty || 0,
            updated_at: new Date().toISOString()
          })
          setFastenersUploadLog(prev => prev + `[ОНОВИТИ СВ] ${item.name}: ${newTotal} шт\n`)
        } else {
          inserts.push({
            nomenclature_id: nomRecord.id,
            name: item.name,
            type: 'hardware',
            warehouse: 'production',
            unit: 'шт',
            total_qty: item.qty,
            reserved_qty: 0,
            updated_at: new Date().toISOString()
          })
          setFastenersUploadLog(prev => prev + `[НОВИЙ СВ] ${item.name}: ${item.qty} шт\n`)
        }
      }

      setFastenersUploadLog(prev => prev + `\nНадсилання змін до Supabase...\n`)
      const batchOps = []
      if (updates.length > 0) batchOps.push(supabase.from('inventory').upsert(updates))
      if (inserts.length > 0) batchOps.push(supabase.from('inventory').insert(inserts))
      const results = await Promise.all(batchOps)
      for (const res of results) { if (res.error) throw res.error }
      setFastenersUploadLog(prev => prev + `✅ Успішно оновлено базу даних!\n`)
      setFastenersUploadStatus('success')
      refreshTable('inventory')
      refreshTable('nomenclatures')
    } catch (err) {
      setFastenersUploadLog(prev => prev + `❌ Помилка запису в БД: ${err.message || err}\n`)
      setFastenersUploadStatus('error')
    }
  }


  const parseCSV = (text, delimiter = ';') => {
    const lines = []
    let row = [""]
    let inQuotes = false
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const nextChar = text[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        row.push("")
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++
        }
        lines.push(row.map(cell => cell.trim()))
        row = [""]
      } else {
        row[row.length - 1] += char
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row.map(cell => cell.trim()))
    }
    return lines.filter(line => line.length > 0 && line.some(cell => cell !== ""))
  }

  const detectDelimiter = (text) => {
    // Only scan the first line to avoid commas inside quoted field values skewing the result
    const firstLine = text.split(/\r?\n/)[0] || text
    const commaCount = (firstLine.match(/,/g) || []).length
    const semicolonCount = (firstLine.match(/;/g) || []).length
    return semicolonCount >= commaCount ? ';' : ','
  }

  const autoDetectMapping = (headers) => {
    const mapping = {
      login: -1,
      password: -1,
      first_name: -1,
      last_name: -1,
      department: -1,
      position: -1,
      shift: -1
    }
    
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-zа-яєіїґ0-9]/g, '')
    
    headers.forEach((h, index) => {
      const norm = normalize(h)
      if (norm === 'login' || norm === 'логин' || norm === 'логін' || norm === 'юзернейм' || norm === 'username') {
        mapping.login = index
      } else if (norm === 'password' || norm === 'пароль' || norm === 'pass' || norm === 'pwd') {
        mapping.password = index
      } else if (norm === 'firstname' || norm === 'имя' || norm === 'імя' || norm === 'ім’я' || norm === 'first_name' || norm === 'firstname' || norm === 'name') {
        mapping.first_name = index
      } else if (norm === 'lastname' || norm === 'фамилия' || norm === 'прізвище' || norm === 'last_name' || norm === 'lastname' || norm === 'surname') {
        mapping.last_name = index
      } else if (norm === 'department' || norm === 'цех' || norm === 'відділ' || norm === 'подразделение' || norm === 'департамент') {
        mapping.department = index
      } else if (norm === 'position' || norm === 'посада' || norm === 'роль' || norm === 'должность' || norm === 'фах') {
        mapping.position = index
      } else if (norm === 'shift' || norm === 'зміна' || norm === 'смена' || norm === 'бригада') {
        mapping.shift = index
      }
    })
    return mapping
  }

  const matchDepartment = (rawVal, companyStructure, defaultVal) => {
    if (!rawVal) return defaultVal
    const clean = rawVal.trim().toLowerCase()
    
    let found = (companyStructure || []).find(s => s.name.toLowerCase() === clean)
    if (found) return found.name
    
    const rawNum = clean.replace(/[^0-9]/g, '')
    if (rawNum) {
      found = (companyStructure || []).find(s => s.name.replace(/[^0-9]/g, '') === rawNum)
      if (found) return found.name
    }
    
    found = (companyStructure || []).find(s => s.name.toLowerCase().includes(clean) || clean.includes(s.name.toLowerCase()))
    if (found) return found.name

    return defaultVal
  }

  const matchPosition = (rawVal, companyPositions, defaultVal) => {
    if (!rawVal) return defaultVal
    const clean = rawVal.trim().toLowerCase()
    
    let found = (companyPositions || []).find(p => p.name.toLowerCase() === clean)
    if (found) return found.name
    
    found = (companyPositions || []).find(p => p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase()))
    if (found) return found.name

    return defaultVal
  }

  const downloadTemplateExcel = () => {
    const headers = ['login', 'password', 'first_name', 'last_name', 'department', 'position', 'shift']
    const row = ['ivan_operator', 'pass123', 'Іван', 'Петренко', 'Цех №1', 'Оператор', 'Зміна 1']
    const ws = XLSX.utils.aoa_to_sheet([headers, row])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'employees_template.xlsx')
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setCsvFile(file)
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const parsed = XLSX.utils.sheet_to_json(ws, { header: 1 })
      
      const filtered = parsed.filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== ''))
      if (filtered.length > 0) {
        const headers = filtered[0].map(h => String(h || ''))
        const rows = filtered.slice(1).map(row => row.map(cell => String(cell || '')))
        
        setCsvHeaders(headers)
        setCsvRows(rows)
        const initialMapping = autoDetectMapping(headers)
        setColumnMapping(initialMapping)
        setImportStatus('preview')
      } else {
        alert('Помилка: файл порожній або має невірний формат.')
      }
    } else {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target.result
        const delim = detectDelimiter(text)
        setCsvDelimiter(delim)
        
        const parsed = parseCSV(text, delim)
        if (parsed.length > 0) {
          const headers = parsed[0]
          const rows = parsed.slice(1)
          
          setCsvHeaders(headers)
          setCsvRows(rows)
          
          const initialMapping = autoDetectMapping(headers)
          setColumnMapping(initialMapping)
          
          setImportStatus('preview')
        } else {
          alert('Помилка: файл порожній або має невірний формат.')
        }
      }
      reader.readAsText(file, 'UTF-8')
    }
  }

  const handleDelimiterChange = (newDelim) => {
    setCsvDelimiter(newDelim)
    if (csvFile) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target.result
        const parsed = parseCSV(text, newDelim)
        if (parsed.length > 0) {
          const headers = parsed[0]
          const rows = parsed.slice(1)
          setCsvHeaders(headers)
          setCsvRows(rows)
          const initialMapping = autoDetectMapping(headers)
          setColumnMapping(initialMapping)
        }
      }
      reader.readAsText(csvFile, 'UTF-8')
    }
  }

  const previewData = useMemo(() => {
    if (importStatus !== 'preview' || csvRows.length === 0) return []
    
    return csvRows.map((row, rowIndex) => {
      const getVal = (fieldIndex) => {
        if (fieldIndex === undefined || fieldIndex === -1 || fieldIndex >= row.length) return ''
        return (row[fieldIndex] || '').trim()
      }
      
      const rawLogin = getVal(columnMapping.login)
      const cleanLogin = rawLogin.replace(/@/g, '').toLowerCase().replace(/[^a-z0-9_.-]/g, '')
      
      const rawPassword = getVal(columnMapping.password)
      const password = rawPassword || defaultValues.password
      
      const first_name = getVal(columnMapping.first_name)
      const last_name = getVal(columnMapping.last_name)
      
      const rawDept = getVal(columnMapping.department)
      const department = matchDepartment(rawDept, companyStructure, defaultValues.department)
      
      const rawPos = getVal(columnMapping.position)
      const position = matchPosition(rawPos, companyPositions, defaultValues.position)
      
      const rawShift = getVal(columnMapping.shift)
      let shift = 'Без зміни'
      if (rawShift) {
        const match = ['Зміна 1', 'Зміна 2', 'Зміна 3', 'Зміна 4', 'Без зміни'].find(
          s => s.toLowerCase() === rawShift.toLowerCase() || s.replace(/[^0-9]/g, '') === rawShift.replace(/[^0-9]/g, '')
        )
        if (match) shift = match
      } else {
        shift = defaultValues.shift
      }
      
      let status = 'insert'
      let message = 'Буде створено'
      
      if (!cleanLogin) {
        status = 'error'
        message = 'Помилка: відсутній логін'
      } else {
        const existing = (systemUsers || []).find(u => u.login.toLowerCase() === cleanLogin)
        if (existing) {
          if (duplicatePolicy === 'skip') {
            status = 'skip'
            message = 'Пропустити (дублікат)'
          } else {
            status = 'update'
            message = `Оновити (ID: ${existing.id})`
          }
        }
      }
      
      return {
        key: rowIndex,
        rawRow: row,
        login: cleanLogin || rawLogin,
        password,
        first_name,
        last_name,
        department,
        position,
        shift,
        status,
        message
      }
    })
  }, [csvRows, columnMapping, defaultValues, duplicatePolicy, systemUsers, companyStructure, companyPositions, importStatus])

  const executeImport = async () => {
    const rowsToProcess = previewData.filter(r => r.status === 'insert' || r.status === 'update')
    if (rowsToProcess.length === 0) {
      alert('Немає записів для імпорту.')
      return
    }
    
    setImportStatus('importing')
    setImportLog('Початок імпорту...\n')
    
    const payloads = rowsToProcess.map(row => {
      const payload = {
        login: row.login,
        password: row.password,
        first_name: row.first_name,
        last_name: row.last_name,
        department: row.department,
        position: row.position,
        shift: row.shift,
      }
      
      if (row.status === 'update') {
        const existing = (systemUsers || []).find(u => u.login.toLowerCase() === row.login)
        payload.id = existing.id
        payload.access_rights = existing.access_rights || defaultValues.access_rights
      } else {
        payload.access_rights = defaultValues.access_rights
      }
      
      return payload
    })
    
    try {
      setImportLog(prev => prev + `Надсилання ${payloads.length} записів до Supabase...\n`)
      const { data: resultData, error } = await supabase.from('system_users').upsert(payloads).select()
      
      if (error) throw error
      
      setImportLog(prev => prev + `Успішно імпортовано/оновлено ${resultData?.length || payloads.length} користувачів.\n`)
      setImportStatus('success')
    } catch (err) {
      setImportLog(prev => prev + `Помилка запису в БД: ${err.message || err}\n`)
      setImportStatus('error')
    }
  }

  const toggleDefaultRight = (key) => {
    setDefaultValues(prev => ({
      ...prev,
      access_rights: {
        ...prev.access_rights,
        [key]: !prev.access_rights[key]
      }
    }))
  }
  
  // User Form State
  const [userForm, setUserForm] = useState({
    id: null,
    login: '',
    password: '',
    first_name: '',
    last_name: '',
    position: companyPositions?.[0]?.name || 'Оператор',
    department: companyStructure?.[0]?.name || 'Цех №1',
    shift: 'Без зміни',
    access_rights: {
      dashboard: false, foreman_dashboard: false, manager: false, chat: false, master: false, warehouse: false, warehouse_boxes: false, cutter_restoration: false, preparation_dashboard: false, engineer: false,
      director: false, foreman: false, foreman2: false, operator: true, shipping: false, 
      supply: false, procurement: false, nomenclature: false, nomenclature_v2: false, shop2: false, machines: false, settings: false, packaging: false, kanban: false, reports: false, tumbling_terminal: false, tumbling_dashboard: false, reception_terminal: false, sorting_terminal: false, painting_terminal: false, pressing_terminal: false
    }
  })

  // Structure Form State
  const [structureForm, setStructureForm] = useState({
    id: null,
    name: '',
    type: 'shop'
  })

  // Position Form State
  const [positionForm, setPositionForm] = useState({ id: null, name: '', department_id: '' })

  // Filters for Dossier
  const [userSearch, setUserSearch] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterPosition, setFilterPosition] = useState('all')
  const [filterShift, setFilterShift] = useState('all')
  const [filterOnlyOnline, setFilterOnlyOnline] = useState(false)
  const [showMobileUserForm, setShowMobileUserForm] = useState(false)

  const handleSaveUser = async (e) => {
    e.preventDefault()
    if (!userForm.login || (!userForm.id && !userForm.password)) return

    const cleanLogin = userForm.login.trim()
    const cleanPassword = userForm.password.trim()

    // Client-side uniqueness checks to prevent database errors
    if (!userForm.id) {
      const loginExists = (systemUsers || []).some(u => u.login.toLowerCase().trim() === cleanLogin.toLowerCase())
      if (loginExists) {
        alert(`⚠️ Помилка: Користувач з логіном "${cleanLogin}" вже існує в системі!\nБудь ласка, вкажіть інший унікальний логін.`)
        return
      }
    } else {
      const loginConflict = (systemUsers || []).some(u => u.id !== userForm.id && u.login.toLowerCase().trim() === cleanLogin.toLowerCase())
      if (loginConflict) {
        alert(`⚠️ Помилка: Логін "${cleanLogin}" вже зайнятий іншим користувачем!\nБудь ласка, вкажіть інший унікальний логін.`)
        return
      }
    }

    const payload = {
      login: cleanLogin,
      password: cleanPassword,
      first_name: userForm.first_name || '',
      last_name: userForm.last_name || '',
      position: userForm.position,
      department: userForm.department,
      shift: userForm.shift || 'Без зміни',
      access_rights: userForm.access_rights,
      avatar: userForm.avatar || null
    }

    if (userForm.id) {
      payload.id = userForm.id
    }
    
    const { error } = await upsertUser(payload)
    
    if (error) {
      alert(`❌ Помилка збереження: ${error.message || 'Конфлікт даних в базі'}`)
      return
    }

    setUserForm({
      id: null, login: '', password: '', first_name: '', last_name: '', 
      position: companyPositions?.[0]?.name || 'Оператор', department: companyStructure?.[0]?.name || 'Цех №1', shift: 'Без зміни',
      access_rights: { dashboard: false, foreman_dashboard: false, manager: false, chat: false, master: false, warehouse: false, warehouse_boxes: false, cutter_restoration: false, preparation_dashboard: false, engineer: false, director: false, foreman: false, foreman2: false, operator: true, prep_terminal: false, shipping: false, supply: false, procurement: false, nomenclature: false, nomenclature_v2: false, shop2: false, machines: false, settings: false, kanban: false, reports: false, tumbling_terminal: false, tumbling_dashboard: false, reception_terminal: false, sorting_terminal: false, painting_terminal: false, pressing_terminal: false }
    })
    setShowMobileUserForm(false)
  }

  const editUser = (user) => {
    setUserForm({ 
      ...user, 
      password: '••••••••',
      access_rights: {
        dashboard: false, foreman_dashboard: false, manager: false, chat: false, master: false, warehouse: false, warehouse_boxes: false, cutter_restoration: false, preparation_dashboard: false, engineer: false,
        director: false, foreman: false, foreman2: false, operator: false, prep_terminal: false, shipping: false, 
        supply: false, procurement: false, nomenclature: false, nomenclature_v2: false, shop2: false, machines: false, settings: false, packaging: false, kanban: false, reports: false, tumbling_terminal: false, tumbling_dashboard: false, reception_terminal: false, sorting_terminal: false, painting_terminal: false, pressing_terminal: false,
        ...(user.access_rights || {})
      }
    })
    setActiveTab('users')
    setShowMobileUserForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleRight = (key) => {
    setUserForm(prev => ({
      ...prev,
      access_rights: {
        ...prev.access_rights,
        [key]: !prev.access_rights[key]
      }
    }))
  }

  const handleSaveStructure = async (e) => {
    e.preventDefault()
    if (!structureForm.name.trim()) return

    const nameClean = structureForm.name.trim()
    const exists = (companyStructure || []).some(s => s.id !== structureForm.id && s.name.toLowerCase().trim() === nameClean.toLowerCase())
    if (exists) {
      alert(`⚠️ Помилка: Елемент структури з назвою "${nameClean}" вже існує.`)
      return
    }

    const { error } = await upsertCompanyStructure({
      id: structureForm.id,
      name: nameClean,
      type: structureForm.type
    })

    if (error) {
      alert(`⚠️ Збережено локально. Помилка БД: ${error.message || 'Перевірте, чи додано таблицю company_structure'}`)
    } else {
      alert(structureForm.id ? `✅ Елемент структури успішно оновлено!` : `✅ Елемент структури успішно додано!`)
    }

    setStructureForm({ id: null, name: '', type: 'shop' })
  }

  const editStructure = (node) => {
    setStructureForm({
      id: node.id,
      name: node.name,
      type: node.type
    })
  }

  const handleDeleteStructure = async (id, name) => {
    const activeUsersCount = (systemUsers || []).filter(u => u.department === name).length
    if (activeUsersCount > 0) {
      alert(`⚠️ Неможливо видалити: ${activeUsersCount} користувачів призначено в "${name}". Будь ласка, перепризначте їх спочатку.`)
      return
    }

    if (!window.confirm(`Ви дійсно бажаєте видалити елемент структури "${name}"?`)) return

    const { error } = await deleteCompanyStructure(id)
    if (error) {
      alert(`⚠️ Видалено локально. Помилка БД: ${error.message}`)
    } else {
      alert(`✅ Елемент структури видалено.`)
    }
  }

  const handleSavePosition = async (e) => {
    e.preventDefault()
    if (!positionForm.name.trim()) return

    const nameClean = positionForm.name.trim()
    const exists = (companyPositions || []).some(p => p.id !== positionForm.id && p.name.toLowerCase().trim() === nameClean.toLowerCase())
    if (exists) {
      alert(`⚠️ Помилка: Посада "${nameClean}" вже існує.`)
      return
    }

    const { error } = await upsertCompanyPosition({
      id: positionForm.id,
      name: nameClean,
      department_id: positionForm.department_id || null
    })

    if (error) {
      alert(`⚠️ Збережено локально. Помилка БД: ${error.message || 'Перевірте, чи додано таблицю company_positions'}`)
    } else {
      alert(positionForm.id ? `✅ Посаду успішно оновлено!` : `✅ Посаду успішно додано!`)
    }

    setPositionForm({ id: null, name: '', department_id: '' })
  }

  const editPosition = (pos) => {
    setPositionForm({
      id: pos.id,
      name: pos.name,
      department_id: pos.department_id || ''
    })
  }

  const handleDeletePosition = async (id, name) => {
    const activeUsersCount = (systemUsers || []).filter(u => u.position === name).length
    if (activeUsersCount > 0) {
      alert(`⚠️ Неможливо видалити: ${activeUsersCount} користувачів мають посаду "${name}". Будь ласка, перепризначте їх спочатку.`)
      return
    }

    if (!window.confirm(`Ви дійсно бажаєте видалити посаду "${name}"?`)) return

    const { error } = await deleteCompanyPosition(id)
    if (error) {
      alert(`⚠️ Видалено локально. Помилка БД: ${error.message}`)
    } else {
      alert(`✅ Посаду видалено.`)
    }
  }

  // Filtered & Sorted Users List
  const filteredUsers = useMemo(() => {
    const list = (systemUsers || []).filter(u => {
      const matchSearch = 
        u.login.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.first_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.last_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.position || '').toLowerCase().includes(userSearch.toLowerCase())

      const matchDept = filterDepartment === 'all' || u.department === filterDepartment
      const matchPos = filterPosition === 'all' || u.position === filterPosition
      const matchShift = filterShift === 'all' || u.shift === filterShift

      const isOnline = u.last_seen && (Date.now() - new Date(u.last_seen).getTime() < 120000)
      const matchOnline = !filterOnlyOnline || isOnline

      return matchSearch && matchDept && matchPos && matchShift && matchOnline
    })

    // Sort: Online users first, then alphabetically (by last name, first name, or login)
    return [...list].sort((a, b) => {
      const aOnline = a.last_seen && (Date.now() - new Date(a.last_seen).getTime() < 120000)
      const bOnline = b.last_seen && (Date.now() - new Date(b.last_seen).getTime() < 120000)
      
      if (aOnline && !bOnline) return -1
      if (!aOnline && bOnline) return 1
      
      const aName = `${a.last_name || ''} ${a.first_name || ''} ${a.login || ''}`.trim()
      const bName = `${b.last_name || ''} ${b.first_name || ''} ${b.login || ''}`.trim()
      return aName.localeCompare(bName, 'uk')
    })
  }, [systemUsers, userSearch, filterDepartment, filterPosition, filterShift, filterOnlyOnline])

  // Get distinct roles/positions for the filter dropdown
  const distinctPositions = useMemo(() => {
    const roles = (systemUsers || []).map(u => u.position).filter(Boolean)
    return Array.from(new Set(roles))
  }, [systemUsers])

  const availableFilterPositions = useMemo(() => {
    if (filterDepartment === 'all') return companyPositions || []
    const deptNode = (companyStructure || []).find(d => d.name === filterDepartment)
    if (!deptNode) return companyPositions || []
    return (companyPositions || []).filter(p => !p.department_id || p.department_id === deptNode.id)
  }, [companyPositions, companyStructure, filterDepartment])

  const availableFormPositions = useMemo(() => {
    if (!userForm.department) return companyPositions || []
    const deptNode = (companyStructure || []).find(d => d.name === userForm.department)
    if (!deptNode) return companyPositions || []
    return (companyPositions || []).filter(p => !p.department_id || p.department_id === deptNode.id)
  }, [companyPositions, companyStructure, userForm.department])

  const moduleList = [
    { id: 'dashboard', label: 'Дашборд WIP' },
    { id: 'foreman_dashboard', label: 'ДАШБОРД 2.0' },
    { id: 'kanban', label: 'Задачі (Внутрішні)' },
    { id: 'chat', label: 'Чат (Внутрішній)' },
    { id: 'manager', label: 'Менеджер' },
    { id: 'master', label: 'Мастер (Цех)' },
    { id: 'warehouse', label: 'Склад Оперативний' },
    { id: 'warehouse_boxes', label: 'Бокси фрез (СО)' },
    { id: 'cutter_restoration', label: 'Відновлення фрез' },
    { id: 'preparation_dashboard', label: 'Дашборд підготовки (TV)' },
    { id: 'engineer', label: 'Інженер' },
    { id: 'director', label: 'Директор' },
    { id: 'foreman', label: 'Майстер дільниці' },
    { id: 'foreman2', label: 'Foreman 2.0' },
    { id: 'operator', label: 'Термінал оператора' },
    { id: 'prep_terminal', label: 'Термінал Підготовки' },
    { id: 'shop1', label: 'Цех №1 (Розкрій→Прийомка)' },
    { id: 'tumbling_terminal', label: 'Екран Галтовки' },
    { id: 'tumbling_dashboard', label: 'Дашборд Галтовки (TV)' },
    { id: 'reception_terminal', label: 'Екран Прийомки' },
    { id: 'sorting_terminal', label: 'Екран Сортування' },
    { id: 'pressing_terminal', label: 'Екран Пресування' },
    { id: 'painting_terminal', label: 'Екран Фарбування' },
    { id: 'shop1_foreman', label: 'Кабінет Нач. Цеху №1' },
    { id: 'shop2', label: 'Цех №2 (Черга)' },
    { id: 'shop2_terminal', label: 'Цех №2 · Термінал' },
    { id: 'packaging', label: 'Пакування' },
    { id: 'shipping', label: 'Логістика' },
    { id: 'supply', label: 'Склад Виробництва' },
    { id: 'procurement', label: 'Постачання (Закупівля)' },
    { id: 'nomenclature_v2', label: 'Номенклатура (Нова)' },
    { id: 'nomenclature', label: 'База номенклатур (Old)' },
    { id: 'machines', label: 'Налаштування станків' },
    { id: 'analytics', label: 'Аналітика' },
    { id: 'brak', label: 'ВКЯ (Контроль якості)' },
    { id: 'access', label: 'Система Доступу' },
    { id: 'reports', label: 'Звіти та Аналітика (1C)' },
    { id: 'settings', label: 'Система (Адмін)' }
  ]

  // Type Mappings for Structure Items
  const typeLabels = {
    shop: 'Виробничий цех',
    warehouse: 'Оперативний склад',
    tumbling: 'Дільниця',
    quality: 'Контроль якості (ВКЯ)',
    management: 'Керівництво',
    other: 'Інший підрозділ'
  }

  const typeColors = {
    shop: '#ff9000',
    warehouse: '#10b981',
    tumbling: '#06b6d4',
    quality: '#ef4444',
    management: '#a855f7',
    other: '#6b7280'
  }

  const getStructureTypeIcon = (type) => {
    switch (type) {
      case 'shop': return <Building size={16} color="#ff9000" />
      case 'warehouse': return <Truck size={16} color="#10b981" />
      case 'tumbling': return <Hammer size={16} color="#06b6d4" />
      case 'management': return <ShieldCheck size={16} color="#a855f7" />
      case 'quality': return <AlertCircle size={16} color="#ef4444" />
      default: return <Building2 size={16} color="#6b7280" />
    }
  }

  // Get Initials for Avatar
  const getInitials = (user) => {
    const f = (user.first_name || '').charAt(0).toUpperCase()
    const l = (user.last_name || '').charAt(0).toUpperCase()
    return f || l ? `${f}${l}` : (user.login || '??').substring(0, 2).toUpperCase()
  }

  const renderUserAvatar = (user) => {
    const initials = getInitials(user)
    if (user.avatar && user.avatar.startsWith('data:image/')) {
      return (
        <img 
          src={user.avatar} 
          alt={initials} 
          style={{ 
            width: '46px', 
            height: '46px', 
            borderRadius: '14px', 
            objectFit: 'cover', 
            border: user.position === 'Адмін' ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.08)' 
          }} 
        />
      )
    }
    const getGradient = (name) => {
      switch (name) {
        case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)';
        case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)';
        case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)';
        case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)';
        case 'orange': return 'linear-gradient(135deg, #ff9000, #ff5500)';
        default: return null;
      }
    }
    const grad = getGradient(user.avatar) || (user.position === 'Адмін' ? 'linear-gradient(135deg, #442a00, #221400)' : 'linear-gradient(135deg, #1c1c24, #0a0a0f)')
    return (
      <div style={{ 
        width: '46px', 
        height: '46px', 
        borderRadius: '14px', 
        background: grad, 
        border: user.position === 'Адмін' ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: '0.9rem',
        color: '#fff',
        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.05)'
      }}>
        {initials}
      </div>
    )
  }

  // Role pill background and text color
  const getRoleStyle = (position) => {
    switch (position) {
      case 'Адмін': return { bg: 'rgba(255,144,0,0.15)', border: '1px solid #ff9000', color: '#ff9000' }
      case 'Директор виробництва':
      case 'Начальник цеху': return { bg: 'rgba(168,85,247,0.15)', border: '1px solid #a855f7', color: '#c084fc' }
      case 'Майстер цеху':
      case 'Майстер дільниці': return { bg: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#60a5fa' }
      case 'Працівник складу': return { bg: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#34d399' }
      case 'Контроль браку': return { bg: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#f87171' }
      default: return { bg: 'rgba(255,255,255,0.05)', border: '1px solid #222', color: '#aaa' }
    }
  }

  const isAdmin = currentUser?.position === 'Адмін'

  return (
    <div className="settings-module-v2" style={{ background: '#070708', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav className="module-nav" style={{ 
        flexShrink: 0, 
        padding: '0 24px', 
        height: '72px', 
        background: 'rgba(10,10,12,0.85)', 
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/" style={{ color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, transition: '0.2s' }} className="nav-back-link">
            <ArrowLeft size={16} /> <span className="hide-mobile">На головну</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255,144,0,0.1)', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center' }}>
              <ShieldCheck size={20} color="#ff9000" />
            </div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0 }}>Адмін-Панель MES</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right', lineHeight: 1.2 }} className="hide-mobile">
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f3f4f6' }}>{currentUser?.first_name} {currentUser?.last_name}</div>
            <div style={{ fontSize: '0.65rem', color: '#ff9000', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{currentUser?.position}</div>
          </div>
          <button onClick={logout} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px 18px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', transition: '0.2s' }} className="logout-btn">ВИЙТИ</button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="module-content" style={{ padding: '24px', overflowY: 'auto', flex: 1, maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
        
        {/* Navigation Tabs */}
        <div className="settings-tabs" style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '6px', borderRadius: '18px', marginBottom: '30px', gap: '4px' }}>
           {isAdmin && (
             <button onClick={() => setActiveTab('users')} className={`tab-btn-v2 ${activeTab === 'users' ? 'active' : ''}`}>
               <UsersIcon size={16} /> КОРИСТУВАЧІ & ДОСЬЄ
             </button>
           )}
           {isAdmin && (
             <button onClick={() => setActiveTab('structure')} className={`tab-btn-v2 ${activeTab === 'structure' ? 'active' : ''}`}>
               <Building2 size={16} /> СТРУКТУРА КОМПАНІЇ
             </button>
           )}
           {isAdmin && (
             <button onClick={() => setActiveTab('system')} className={`tab-btn-v2 ${activeTab === 'system' ? 'active' : ''}`}>
               <Cpu size={16} /> СИСТЕМНІ НАЛАШТУВАННЯ
             </button>
           )}
            {isAdmin && (
              <button onClick={() => setActiveTab('corrections')} className={`tab-btn-v2 ${activeTab === 'corrections' ? 'active' : ''}`}>
                <Sliders size={16} /> КОРЕКЦІЯ СНАПШОТІВ
              </button>
            )}
        </div>

        {/* ── TAB 1: USERS & DOSSIER ── */}
        {activeTab === 'users' && isAdmin && (
          <div className="admin-users-layout" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '30px', alignItems: 'start' }}>
            
            {/* Left Column: Form Editor */}
            <section className={`glass-panel user-editor-panel ${showMobileUserForm ? 'mobile-open' : ''}`} style={{ background: '#0e0e11', padding: '28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', position: 'sticky', top: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000', letterSpacing: '0.02em' }}>
                  <UserPlus size={18} /> {userForm.id ? 'РЕДАГУВАННЯ ДОСЬЄ' : 'СТВОРИТИ НОВОГО ПРАЦІВНИКА'}
                </h3>
                <button
                  type="button"
                  className="mobile-user-form-close"
                  onClick={() => setShowMobileUserForm(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', width: '38px', height: '38px', borderRadius: '10px', display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  title="Закрити форму"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label">ЛОГІН (англ)</label>
                    <input style={inputStyle} value={userForm.login} onChange={e => setUserForm({...userForm, login: e.target.value})} placeholder="ivanov_p" required />
                  </div>
                  <div>
                    <label className="form-label">ПАРОЛЬ</label>
                    <input type="text" style={inputStyle} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder={userForm.id ? "новий пароль (опціонально)..." : "пароль..."} required={!userForm.id} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label">ІМ'Я</label>
                    <input style={inputStyle} value={userForm.first_name} onChange={e => setUserForm({...userForm, first_name: e.target.value})} placeholder="Петро" />
                  </div>
                  <div>
                    <label className="form-label">ПРІЗВИЩЕ</label>
                    <input style={inputStyle} value={userForm.last_name} onChange={e => setUserForm({...userForm, last_name: e.target.value})} placeholder="Іванов" />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label">ЦЕХ / СКЛАД / ВІДДІЛ</label>
                    <select style={inputStyle} value={userForm.department} onChange={e => {
                      const deptName = e.target.value
                      const deptNode = (companyStructure || []).find(d => d.name === deptName)
                      const availableForNewDept = (companyPositions || []).filter(p => !p.department_id || (deptNode && p.department_id === deptNode.id))
                      const isCurrentPosValid = availableForNewDept.some(p => p.name === userForm.position)
                      setUserForm({
                        ...userForm,
                        department: deptName,
                        position: isCurrentPosValid ? userForm.position : (availableForNewDept[0]?.name || '')
                      })
                    }}>
                      {(companyStructure || []).map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">РОБОЧА ЗМІНА</label>
                    <select style={inputStyle} value={userForm.shift || 'Без зміни'} onChange={e => setUserForm({...userForm, shift: e.target.value})}>
                      <option value="Зміна 1">Зміна 1</option>
                      <option value="Зміна 2">Зміна 2</option>
                      <option value="Зміна 3">Зміна 3</option>
                      <option value="Зміна 4">Зміна 4</option>
                      <option value="Без зміни">Без зміни</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">ШТАТНА ПОСАДА / РОЛЬ</label>
                  <select style={inputStyle} value={userForm.position} onChange={e => setUserForm({...userForm, position: e.target.value})}>
                    {(availableFormPositions || []).map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: '6px' }}>
                  <label className="form-label" style={{ marginBottom: '12px', color: '#ff9000', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} /> ДОСТУПНІ МОДУЛІ В МЕС:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    {moduleList.map(mod => (
                      <div key={mod.id} 
                        onClick={() => toggleRight(mod.id)}
                        style={{ 
                          padding: '8px 10px', 
                          background: userForm.access_rights[mod.id] ? 'rgba(255,144,0,0.08)' : '#000', 
                          border: userForm.access_rights[mod.id] ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          transition: '0.15s'
                        }}
                        className="permission-item"
                      >
                        {userForm.access_rights[mod.id] ? <CheckCircle2 size={14} color="#ff9000" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }}></div>}
                        <span style={{ color: userForm.access_rights[mod.id] ? '#fff' : '#666', fontWeight: userForm.access_rights[mod.id] ? 700 : 500 }}>{mod.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <button type="submit" style={{ 
                    background: 'linear-gradient(135deg, #ff9000, #ff6a00)', 
                    color: '#000', 
                    border: 'none', 
                    padding: '14px', 
                    borderRadius: '12px', 
                    fontWeight: 900, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px', 
                    fontSize: '0.9rem',
                    transition: '0.2s',
                    boxShadow: '0 4px 15px rgba(255,144,0,0.2)'
                  }} className="primary-btn">
                    <Save size={18} /> {userForm.id ? 'ОНОВИТИ КАРТКУ' : 'ЗБЕРЕГТИ ПРАЦІВНИКА'}
                  </button>
                  {userForm.id && (
                    <button type="button" 
                      onClick={() => setUserForm({ id: null, login: '', password: '', first_name: '', last_name: '', position: companyPositions?.[0]?.name || 'Оператор', department: companyStructure?.[0]?.name || 'Цех №1', shift: 'Без зміни', access_rights: { operator: true } })} 
                      style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
                    >
                      СКАСУВАТИ
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* Right Column: Dossier Card Registry */}
            <section className="registry-area" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Dossier Search and Filters Panel */}
              <div className="glass-panel" style={{ background: '#0e0e11', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '0.9rem', color: '#888', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={18} color="#ff9000" /> КАРТОТЕКА ПРАЦІВНИКІВ ({systemUsers.length})
                    </h3>
                    <button
                      onClick={() => {
                        setUserForm({ id: null, login: '', password: '', first_name: '', last_name: '', position: companyPositions?.[0]?.name || 'Оператор', department: companyStructure?.[0]?.name || 'Цех №1', shift: 'Без зміни', access_rights: { operator: true } })
                        setShowMobileUserForm(true)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #ff9000, #ff6a00)',
                        border: 'none',
                        color: '#000',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'none',
                        alignItems: 'center',
                        gap: '6px',
                        transition: '0.2s'
                      }}
                      className="mobile-new-user-btn"
                      type="button"
                    >
                      <Plus size={14} /> Новий користувач
                    </button>
                    <button 
                      onClick={() => {
                        setCsvFile(null)
                        setCsvHeaders([])
                        setCsvRows([])
                        setImportStatus('idle')
                        setIsImportModalOpen(true)
                      }}
                      style={{ 
                        background: 'rgba(255,144,0,0.1)', 
                        border: '1px solid rgba(255,144,0,0.2)', 
                        color: '#ff9000', 
                        padding: '6px 12px', 
                        borderRadius: '8px', 
                        fontSize: '0.72rem', 
                        fontWeight: 800, 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        transition: '0.2s'
                      }}
                      className="import-csv-btn"
                      type="button"
                    >
                      <Upload size={14} /> Імпорт з CSV
                    </button>
                  </div>
                  <div style={{ position: 'relative', width: '260px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
                    <input 
                      style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '8px 12px 8px 36px', color: '#fff', fontSize: '0.8rem', width: '100%', outline: 'none' }} 
                      placeholder="Пошук по імені, логіну..." 
                      value={userSearch} 
                      onChange={e => setUserSearch(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Filters Row */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Filter size={12} color="#444" />
                    <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 900, textTransform: 'uppercase' }}>Фільтри:</span>
                  </div>
                  
                  {/* Department Filter */}
                  <select 
                    style={filterSelectStyle} 
                    value={filterDepartment} 
                    onChange={e => setFilterDepartment(e.target.value)}
                  >
                    <option value="all">Всі цехи / склади ({companyStructure.length})</option>
                    {(companyStructure || []).map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>

                  {/* Position Filter */}
                  <select 
                    style={filterSelectStyle} 
                    value={filterPosition} 
                    onChange={e => setFilterPosition(e.target.value)}
                  >
                    <option value="all">Всі посади ({availableFilterPositions.length})</option>
                    {(availableFilterPositions || []).map(pos => (
                      <option key={pos.id} value={pos.name}>{pos.name}</option>
                    ))}
                  </select>

                  {/* Shift Filter */}
                  <select 
                    style={filterSelectStyle} 
                    value={filterShift} 
                    onChange={e => setFilterShift(e.target.value)}
                  >
                    <option value="all">Всі зміни</option>
                    <option value="Зміна 1">Зміна 1</option>
                    <option value="Зміна 2">Зміна 2</option>
                    <option value="Зміна 3">Зміна 3</option>
                    <option value="Зміна 4">Зміна 4</option>
                    <option value="Без зміни">Без зміни</option>
                  </select>
 
                  {/* Only Online Toggle */}
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: 'pointer', 
                    background: filterOnlyOnline ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)', 
                    border: filterOnlyOnline ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.05)', 
                    padding: '6px 12px', 
                    borderRadius: '10px', 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    color: filterOnlyOnline ? '#34d399' : '#888',
                    transition: '0.2s' 
                  }}>
                    <input 
                      type="checkbox" 
                      checked={filterOnlyOnline} 
                      onChange={e => setFilterOnlyOnline(e.target.checked)} 
                      style={{ accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    Тільки онлайн
                  </label>

                  {/* Reset Filters */}
                  {(filterDepartment !== 'all' || filterPosition !== 'all' || filterShift !== 'all' || userSearch !== '' || filterOnlyOnline) && (
                    <button 
                      onClick={() => { setFilterDepartment('all'); setFilterPosition('all'); setFilterShift('all'); setUserSearch(''); setFilterOnlyOnline(false) }}
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#aaa', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <X size={12} /> скинути
                    </button>
                  )}
                </div>
              </div>

              {/* Dossier Card Grid */}
              <div className="dossier-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '20px' }}>
                {filteredUsers.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', background: '#0e0e11', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '24px', color: '#555' }}>
                    <UsersIcon size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Нікого не знайдено</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Спробуйте змінити параметри пошуку або фільтри</div>
                  </div>
                ) : (
                  filteredUsers.map(user => {
                    const roleStyle = getRoleStyle(user.position)
                    // Find the user's department type to get appropriate icon
                    const deptNode = (companyStructure || []).find(s => s.name === user.department)
                    const allowedModulesCount = Object.values(user.access_rights || {}).filter(Boolean).length
                    const isOnline = user.last_seen && (Date.now() - new Date(user.last_seen).getTime() < 120000)

                    return (
                      <div key={user.id} className="dossier-card" style={{ 
                        background: '#0e0e11', 
                        border: userForm.id === user.id ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '20px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '15px',
                        transition: 'all 0.25s ease',
                        position: 'relative',
                        boxShadow: userForm.id === user.id ? '0 0 20px rgba(255,144,0,0.1)' : 'none',
                        cursor: 'pointer'
                      }} onClick={() => editUser(user)}>
                        
                        {/* Dossier Card Header */}
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                          <div style={{ position: 'relative' }}>
                            {/* Avatar Icon */}
                            {renderUserAvatar(user)}
                            {/* Online / Active indicator */}
                            <div style={{ 
                              position: 'absolute', 
                              bottom: '-2px', 
                              right: '-2px', 
                              width: '12px', 
                              height: '12px', 
                              borderRadius: '50%', 
                              background: isOnline ? '#10b981' : '#6b7280', 
                              border: '2px solid #0e0e11' 
                            }} title={isOnline ? "В мережі" : "Не в мережі"} />
                          </div>
 
                          <div style={{ overflow: 'hidden', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>ID: {user.id || 'new'}</span>
                              <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 600 }}>@{user.login}</span>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Без імені'}
                            </div>
                          </div>
                        </div>

                        {/* Badges Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* Presence Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              width: '6px', 
                              height: '6px', 
                              borderRadius: '50%', 
                              background: isOnline ? '#10b981' : '#6b7280' 
                            }} />
                            <span style={{ fontSize: '0.72rem', color: isOnline ? '#34d399' : '#888', fontWeight: 600 }}>
                              {isOnline ? 'В мережі' : `Візит: ${formatLastSeen(user.last_seen)}`}
                            </span>
                          </div>

                          {/* Role Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Briefcase size={12} color="#555" />
                            <span style={{ 
                              fontSize: '0.7rem', 
                              padding: '3px 8px', 
                              borderRadius: '8px',
                              fontWeight: 800,
                              ...roleStyle
                            }}>{user.position}</span>
                          </div>

                          {/* Department Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {getStructureTypeIcon(deptNode?.type || 'other')}
                            <span style={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 700, 
                              color: typeColors[deptNode?.type || 'other'] || '#fff' 
                            }}>{user.department || 'Не призначено'}</span>
                          </div>

                          {/* Shift Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={12} color="#555" />
                            <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600 }}>
                              {user.shift || 'Без зміни'}
                            </span>
                          </div>
                        </div>

                        {/* Perms Dots & Actions */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          borderTop: '1px solid rgba(255,255,255,0.03)', 
                          paddingTop: '12px',
                          marginTop: '4px'
                        }}>
                          {/* Permissions Indicator */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.6rem', color: '#444', fontWeight: 800, textTransform: 'uppercase' }}>Модулі ({allowedModulesCount})</span>
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '120px' }}>
                              {Object.entries(user.access_rights || {}).filter(([k,v]) => v === true).map(([k]) => (
                                 <div key={k} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ff9000' }} title={k}></div>
                              ))}
                              {allowedModulesCount === 0 && <span style={{ fontSize: '0.65rem', color: '#555' }}>немає</span>}
                            </div>
                          </div>

                          {/* Quick Actions (Prevent card click propagation where needed) */}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); editUser(user) }} 
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', color: '#aaa', padding: '8px', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center' }}
                              title="Редагувати деталі"
                              className="card-action-btn"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); if (window.confirm(`Видалити досьє працівника ${user.first_name || ''} (@${user.login})?`)) deleteUser(user.id) }} 
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.1)', color: '#f87171', padding: '8px', borderRadius: '10px', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center' }}
                              title="Видалити досьє"
                              className="card-action-btn"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                      </div>
                    )
                  })
                )}
              </div>

            </section>
          </div>
        )}

              {/* ── TAB 2: COMPANY STRUCTURE ── */}
        {activeTab === 'structure' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            
            {/* Sub-tab Navigation */}
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              <button 
                onClick={() => setStructureSubTab('departments')}
                style={{
                  background: structureSubTab === 'departments' ? 'rgba(255,144,0,0.08)' : 'transparent',
                  color: structureSubTab === 'departments' ? '#ff9000' : '#888',
                  border: structureSubTab === 'departments' ? '1px solid rgba(255,144,0,0.15)' : '1px solid transparent',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: '0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Building size={14} /> ПІДРОЗДІЛИ ТА ЦЕХИ
              </button>
              <button 
                onClick={() => setStructureSubTab('positions')}
                style={{
                  background: structureSubTab === 'positions' ? 'rgba(255,144,0,0.08)' : 'transparent',
                  color: structureSubTab === 'positions' ? '#ff9000' : '#888',
                  border: structureSubTab === 'positions' ? '1px solid rgba(255,144,0,0.15)' : '1px solid transparent',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: '0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Briefcase size={14} /> ШТАТНІ ПОСАДИ
              </button>
            </div>

            {structureSubTab === 'departments' ? (
              <div className="admin-structure-layout" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '30px', alignItems: 'start', animation: 'fadeIn 0.2s ease' }}>
                
                {/* Left: Add Structure Node Form */}
                <section className="glass-panel" style={{ background: '#0e0e11', padding: '28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                    {structureForm.id ? <Edit3 size={18} /> : <Plus size={18} />} {structureForm.id ? 'РЕДАГУВАТИ ПІДРОЗДІЛ' : 'ДОДАТИ ПІДРОЗДІЛ СТРУКТУРИ'}
                  </h3>
                  
                  <form onSubmit={handleSaveStructure} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                      <label className="form-label">НАЗВА ЦЕХУ / СКЛАДУ / ВІДДІЛУ</label>
                      <input 
                        style={inputStyle} 
                        value={structureForm.name} 
                        onChange={e => setStructureForm({...structureForm, name: e.target.value})} 
                        placeholder="напр. Цех №3, Склад готової продукції" 
                        required 
                      />
                    </div>
                    
                    <div>
                      <label className="form-label">ТИП ДІЛЬНИЦІ / ПІДРОЗДІЛУ</label>
                      <select 
                        style={inputStyle} 
                        value={structureForm.type} 
                        onChange={e => setStructureForm({...structureForm, type: e.target.value})}
                      >
                        <option value="shop">Цех (Виробництво / Порізка)</option>
                        <option value="warehouse">Склад (Оперативний / Сировини / СГП)</option>
                        <option value="tumbling">Дільниця</option>
                        <option value="quality">ВКЯ (Контроль якості / Браку)</option>
                        <option value="management">Керівництво (Офіс / Майстри)</option>
                        <option value="other">Інше</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button type="submit" style={{ 
                        background: 'linear-gradient(135deg, #ff9000, #ff6a00)', 
                        color: '#000', 
                        border: 'none', 
                        padding: '14px', 
                        borderRadius: '12px', 
                        fontWeight: 900, 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px', 
                        fontSize: '0.9rem',
                        marginTop: '10px'
                      }}>
                        {structureForm.id ? <Save size={18} /> : <Plus size={18} />} {structureForm.id ? 'ЗБЕРЕГТИ ЗМІНИ' : 'ДОДАТИ В СТРУКТУРУ'}
                      </button>
                      {structureForm.id && (
                        <button type="button" 
                          onClick={() => setStructureForm({ id: null, name: '', type: 'shop' })} 
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
                        >
                          СКАСУВАТИ
                        </button>
                      )}
                    </div>
                  </form>
                </section>

                {/* Right: Structure Nodes List */}
                <section className="structure-list-area">
                  <h3 style={{ fontSize: '0.9rem', color: '#888', marginBottom: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} color="#ff9000" /> ПОТОЧНА СТРУКТУРА ПІДПРИЄМСТВА ({companyStructure.length})
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                    {(companyStructure || []).map(node => (
                      <div key={node.id} style={{ 
                        background: '#0e0e11', 
                        border: '1px solid rgba(255,255,255,0.04)', 
                        borderRadius: '16px', 
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease'
                      }} className="structure-node-card">
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ background: 'rgba(255,255,255,0.02)', width: '38px', height: '38px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                            {getStructureTypeIcon(node.type)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>{node.name}</div>
                            <div style={{ fontSize: '0.68rem', color: '#555', fontWeight: 600, marginTop: '2px' }}>{typeLabels[node.type] || node.type}</div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button 
                            onClick={() => editStructure(node)}
                            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', transition: '0.2s', padding: '6px' }}
                            title="Редагувати підрозділ"
                            className="edit-node-btn"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStructure(node.id, node.name)}
                            style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', transition: '0.2s', padding: '6px' }}
                            title="Видалити підрозділ"
                            className="delete-node-btn"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="admin-structure-layout" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '30px', alignItems: 'start', animation: 'fadeIn 0.2s ease' }}>
                
                {/* Left: Add Position Form */}
                <section className="glass-panel" style={{ background: '#0e0e11', padding: '28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                    {positionForm.id ? <Edit3 size={18} /> : <Plus size={18} />} {positionForm.id ? 'РЕДАГУВАТИ ПОСАДУ' : 'СТВОРЕННЯ ШТАТНОЇ ПОСАДИ'}
                  </h3>
                  
                  <form onSubmit={handleSavePosition} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                      <label className="form-label">НАЗВА ПОСАДИ</label>
                      <input 
                        style={inputStyle} 
                        value={positionForm.name} 
                        onChange={e => setPositionForm({ ...positionForm, name: e.target.value })} 
                        placeholder="напр. Наладчик, Оператор ЧПУ, Конструктор" 
                        required 
                      />
                    </div>

                    <div>
                      <label className="form-label">ПРИВ'ЯЗКА ДО ВІДДІЛУ / ЦЕХУ</label>
                      <select 
                        style={inputStyle} 
                        value={positionForm.department_id || ''} 
                        onChange={e => setPositionForm({ ...positionForm, department_id: e.target.value })}
                      >
                        <option value="">Всі відділи / без прив'язки</option>
                        {(companyStructure || []).map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button type="submit" style={{ 
                        background: 'linear-gradient(135deg, #ff9000, #ff6a00)', 
                        color: '#000', 
                        border: 'none', 
                        padding: '14px', 
                        borderRadius: '12px', 
                        fontWeight: 900, 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px', 
                        fontSize: '0.9rem',
                        marginTop: '10px'
                      }}>
                        {positionForm.id ? <Save size={18} /> : <Plus size={18} />} {positionForm.id ? 'ЗБЕРЕГТИ ЗМІНИ' : 'ДОДАТИ ПОСАДУ'}
                      </button>
                      {positionForm.id && (
                        <button type="button" 
                          onClick={() => setPositionForm({ id: null, name: '', department_id: '' })} 
                          style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
                        >
                          СКАСУВАТИ
                        </button>
                      )}
                    </div>
                  </form>
                </section>
                
                {/* Right: Positions List */}
                <section className="structure-list-area">
                  <h3 style={{ fontSize: '0.9rem', color: '#888', marginBottom: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={18} color="#ff9000" /> ПОТОЧНІ ШТАТНІ ПОСАДИ ({companyPositions.length})
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                    {(companyPositions || []).map(pos => {
                      const linkedDept = pos.department_id ? (companyStructure || []).find(d => d.id === pos.department_id) : null
                      return (
                        <div key={pos.id} style={{ 
                          background: '#0e0e11', 
                          border: '1px solid rgba(255,255,255,0.04)', 
                          borderRadius: '16px', 
                          padding: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease'
                        }} className="structure-node-card">
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', width: '38px', height: '38px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <Briefcase size={16} color="#ff9000" />
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>{pos.name}</div>
                              {linkedDept && (
                                <div style={{ fontSize: '0.68rem', color: '#ff9000', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase' }}>
                                  {linkedDept.name}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button 
                              onClick={() => editPosition(pos)}
                              style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', transition: '0.2s', padding: '6px' }}
                              title="Редагувати посаду"
                              className="edit-node-btn"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button 
                              onClick={() => handleDeletePosition(pos.id, pos.name)}
                              style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', transition: '0.2s', padding: '6px' }}
                              title="Видалити посаду"
                              className="delete-node-btn"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: SYSTEM CONFIG ── */}
        {activeTab === 'system' && isAdmin && (
          <div className="system-settings-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '30px', alignItems: 'start' }}>
            
            {/* Left Panel: Fortnet & API settings */}
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Cpu size={20} /> КОНФІГУРАЦІЯ СИСТЕМИ & FORTNET
              </h3>
              
              <div style={{ marginBottom: '30px' }}>
                <label className="form-label">АДРЕСА СЕРВЕРА FORTNET (API / СИНХРОНІЗАЦІЯ)</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <input 
                    style={inputStyle} 
                    value={tempFortnetUrl} 
                    onChange={e => setTempFortnetUrl(e.target.value)} 
                    placeholder="http://192.168.1.100:8090" 
                  />
                  <button 
                    onClick={() => {
                      updateFortnetUrl(tempFortnetUrl)
                      alert('Адресу Fortnet успішно оновлено!')
                    }}
                    style={{ 
                      background: '#ff9000', 
                      color: '#000', 
                      border: 'none', 
                      padding: '0 24px', 
                      borderRadius: '12px', 
                      fontWeight: 900, 
                      cursor: 'pointer',
                      transition: '0.2s'
                    }}
                    className="primary-btn"
                  >
                    ЗБЕРЕГТИ
                  </button>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#555', marginTop: '10px', lineHeight: '1.4' }}>
                  Ця адреса локального API сервера Fortnet використовується для реального зчитування подій зчитувачів та прохідних карток співробітників цехів.
                </p>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '24px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#888', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>СТАТУС ПОДІЙ ПРОХОДУ</h4>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.2)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                  <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                    Останніх подій у базі логів проходів: <strong style={{ color: '#fff' }}>{accessLogs.length}</strong>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '24px', marginTop: '24px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#888', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ТЕХНОЛОГІЧНЕ ОБСЛУГОВУВАННЯ</h4>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Контроль чистки стола верстата</span>
                    <span style={{ fontSize: '0.7rem', color: '#555' }}>Блокування запуску після 5-ї виконаної карти розкрою</span>
                  </div>
                  
                  <div 
                    onClick={() => updateMaintenanceCheckEnabled(!maintenanceCheckEnabled)}
                    style={{
                      width: '50px',
                      height: '26px',
                      borderRadius: '13px',
                      background: maintenanceCheckEnabled ? 'linear-gradient(135deg, #ff9000, #ff6a00)' : '#222',
                      padding: '3px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: maintenanceCheckEnabled ? 'flex-end' : 'flex-start',
                      transition: 'all 0.2s ease',
                      boxShadow: maintenanceCheckEnabled ? '0 0 12px rgba(255,144,0,0.3)' : 'none'
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: maintenanceCheckEnabled ? '#000' : '#888',
                      transition: 'all 0.2s ease'
                    }} />
                  </div>
                </div>
              </div>
            </section>

            {/* Right Panel: Start Pages by Position */}
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Sliders size={20} /> СТАРТОВІ СТОРІНКИ ДЛЯ ПОСАД
              </h3>
              
              {sqlErrorPosition && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '20px',
                  fontSize: '0.78rem',
                  lineHeight: '1.5'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontWeight: 800, marginBottom: '6px' }}>
                    <AlertCircle size={16} /> УВАГА: ПОТРІБНО ДОДАТИ КОЛОНКУ В БД
                  </div>
                  <div style={{ color: '#aaa', marginBottom: '10px' }}>
                    Таблиця <code>company_positions</code> не містить колонку <code>start_page</code>. Налаштування збережено тимчасово в пам'яті. Для постійного збереження виконайте SQL-запит у Supabase SQL Editor:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <pre style={{
                      margin: 0,
                      background: '#000',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: '#00ff66',
                      flex: 1,
                      overflowX: 'auto'
                    }}>
                      ALTER TABLE company_positions ADD COLUMN IF NOT EXISTS start_page TEXT;
                    </pre>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('ALTER TABLE company_positions ADD COLUMN IF NOT EXISTS start_page TEXT;')
                        alert('SQL-запит скопійовано в буфер обміну!')
                      }}
                      style={{
                        background: 'rgba(255, 144, 0, 0.1)',
                        border: '1px solid rgba(255, 144, 0, 0.2)',
                        color: '#ff9000',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                      type="button"
                    >
                      Копіювати
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(companyPositions || []).map(pos => {
                  const isSaving = savingPosId === pos.id;
                  return (
                    <div 
                      key={pos.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '12px 18px',
                        borderRadius: '14px',
                        border: '1px solid rgba(255,255,255,0.03)',
                        gap: '12px'
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{pos.name}</div>
                        <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>
                          ID: {pos.id}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {isSaving && (
                          <div className="spinner-mes" style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                        )}
                        <select
                          style={{
                            background: '#000',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '10px',
                            padding: '6px 12px',
                            color: '#aaa',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            outline: 'none',
                            cursor: 'pointer',
                            maxWidth: '220px'
                          }}
                          value={pos.start_page || ''}
                          onChange={async (e) => {
                            const newStartPage = e.target.value || null;
                            setSavingPosId(pos.id);
                            
                            const payload = {
                              id: pos.id,
                              name: pos.name,
                              department_id: pos.department_id || null,
                              start_page: newStartPage
                            };
                            
                            const { error } = await upsertCompanyPosition(payload);
                            
                            setSavingPosId(null);
                            if (error) {
                              if (error.message === 'MISSING_START_PAGE_COLUMN') {
                                setSqlErrorPosition(true);
                              } else {
                                alert(`Помилка збереження: ${error.message}`);
                              }
                            } else {
                              setSqlErrorPosition(false);
                            }
                          }}
                        >
                          <option value="">За замовчуванням (перший доступний)</option>
                          {startPageModules.map(mod => (
                            <option key={mod.path} value={mod.path}>
                              {mod.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* BZ Remnants Upload — full-width row */}
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ БЗ
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
                Завантажте CSV-файл із залишками незавершеного виробництва (БЗ). Система автоматично підбере з яких деталей можна зібрати готові комплекти → переведе їх на <strong style={{ color: '#ff9000' }}>СГП (склад готової продукції)</strong>, а решту залишить на <strong style={{ color: '#60a5fa' }}>БЗ</strong>.
              </p>

              {/* ── IDLE: Upload zone ── */}
              {bzUploadStatus === 'idle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Drop zone */}
                  <div style={{
                    border: '2px dashed rgba(255,144,0,0.3)',
                    borderRadius: '18px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'rgba(255,144,0,0.01)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    maxWidth: '520px'
                  }}
                  >
                    <input
                      id="bz-file-input"
                      type="file"
                      accept=".csv"
                      onChange={handleBzFileChange}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>Очікуваний формат: колонка «Номенклатура» та колонка «Склад» (кількість)</p>
                  </div>

                  {/* Record mode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[{ v: 'add', label: '+ Додати до наявного' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                        <button key={opt.v} onClick={() => setBzRecordMode(opt.v)} type="button" style={{
                          background: bzRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                          border: bzRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                          color: bzRecordMode === opt.v ? '#ff9000' : '#888',
                          padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                        }}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PREVIEW: Results tabs ── */}
              {bzUploadStatus === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Stats summary */}
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Комплектів на СГП', val: bzAssembledKits.length, color: '#10b981' },
                      { label: 'Залишків на БЗ', val: bzLeftovers.length, color: '#60a5fa' },
                      { label: 'Не розпізнано', val: bzUnrecognized.length, color: '#ef4444' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Preview tabs */}
                  <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '5px', borderRadius: '14px', gap: '4px' }}>
                    {[
                      { id: 'kits', label: `🏭 Комплекти СГП (${bzAssembledKits.length})` },
                      { id: 'leftovers', label: `📦 Залишки БЗ (${bzLeftovers.length})` },
                      { id: 'unrecognized', label: `⚠️ Не розпізнано (${bzUnrecognized.length})` },
                    ].map(t => (
                      <button key={t.id} onClick={() => setBzActivePreviewTab(t.id)} type="button" className={`tab-btn-v2 ${bzActivePreviewTab === t.id ? 'active' : ''}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Kits tab */}
                  {bzActivePreviewTab === 'kits' && (
                    <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                            <th style={{ padding: '10px 16px' }}>Виріб (СГП)</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center' }}>К-сть комплектів</th>
                            <th style={{ padding: '10px 16px' }}>Деталі що увійшли</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bzAssembledKits.map((kit, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 800, color: '#10b981' }}>{kit.product.name}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, fontSize: '1.0rem', color: '#fff' }}>{kit.qty}</td>
                              <td style={{ padding: '10px 16px', color: '#888', fontSize: '0.68rem', lineHeight: '1.6' }}>
                                {kit.consumed.map((c, ci) => <span key={ci} style={{ display: 'inline-block', marginRight: '8px' }}>{c.name} ×{c.qty}</span>)}
                              </td>
                            </tr>
                          ))}
                          {bzAssembledKits.length === 0 && (
                            <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>Жодного комплекту зібрати не вдалося</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Leftovers tab */}
                  {bzActivePreviewTab === 'leftovers' && (
                    <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                            <th style={{ padding: '10px 16px' }}>Номенклатура</th>
                            <th style={{ padding: '10px 16px' }}>Тип</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center' }}>Кількість (шт)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bzLeftovers.map((l, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 700, color: '#60a5fa' }}>{l.name}</td>
                              <td style={{ padding: '10px 16px', color: '#888', fontSize: '0.68rem' }}>{l.type || '—'}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{l.qty}</td>
                            </tr>
                          ))}
                          {bzLeftovers.length === 0 && (
                            <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>Залишків немає</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Unrecognized tab */}
                  {bzActivePreviewTab === 'unrecognized' && (
                    <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                            <th style={{ padding: '10px 16px' }}>Назва у файлі</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center' }}>Рядок</th>
                            <th style={{ padding: '10px 16px', textAlign: 'center' }}>К-сть</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bzUnrecognized.map((u, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '10px 16px', color: '#ef4444', fontWeight: 700 }}>{u.name}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', color: '#666' }}>{u.rowNum}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{u.qty}</td>
                            </tr>
                          ))}
                          {bzUnrecognized.length === 0 && (
                            <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>Всі позиції розпізнано ✅</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Record mode + action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[{ v: 'add', label: '+ Додати' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                          <button key={opt.v} onClick={() => setBzRecordMode(opt.v)} type="button" style={{
                            background: bzRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                            border: bzRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                            color: bzRecordMode === opt.v ? '#ff9000' : '#888',
                            padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                          }}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => { setBzUploadStatus('idle'); setBzFile(null); setBzAssembledKits([]); setBzLeftovers([]); setBzUnrecognized([]) }}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >← НАЗАД</button>
                      <button
                        type="button"
                        onClick={executeBzUpload}
                        disabled={bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0}
                        style={{
                          background: (bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0) ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)',
                          border: 'none', color: (bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0) ? '#555' : '#000',
                          padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900,
                          cursor: (bzAssembledKits.length === 0 && bzLeftovers.length === 0 && bzUnrecognized.filter(u => u.qty > 0).length === 0) ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                      >
                        <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({bzAssembledKits.length + bzLeftovers.length + bzUnrecognized.filter(u => u.qty > 0).length} позицій)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── UPLOADING ── */}
              {bzUploadStatus === 'uploading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
                  <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис даних у базу...</div>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{bzUploadLog}</pre>
                </div>
              )}

              {/* ── SUCCESS ── */}
              {bzUploadStatus === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <CheckCircle2 size={52} color="#10b981" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Склад оновлено: комплекти передано на СГП, залишки оприбутковано на БЗ.</p>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{bzUploadLog}</pre>
                  <button type="button" onClick={() => { setBzUploadStatus('idle'); setBzFile(null); setBzAssembledKits([]); setBzLeftovers([]); setBzUnrecognized([]); setBzUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
                    ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
                  </button>
                </div>
              )}

              {/* ── ERROR ── */}
              {bzUploadStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <AlertCircle size={52} color="#ef4444" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
                  <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{bzUploadLog}</pre>
                  <button type="button" onClick={() => { setBzUploadStatus('preview') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
                    ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
                  </button>
                </div>
              )}

            </section>

            {/* Prepared Sheets Remnants Upload — full-width row */}
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ СО (ПІДГОТОВЛЕНІ ЛИСТИ)
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
                Завантажте CSV-файл із залишками підготовлених листів на складі СО. Нові номенклатури будуть створені автоматично як сировина (тип <code>raw</code>), а кількості будуть записані на <strong style={{ color: '#ff9000' }}>СО склад</strong>.
              </p>

              {/* ── IDLE: Upload zone ── */}
              {sheetsUploadStatus === 'idle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Drop zone */}
                  <div style={{
                    border: '2px dashed rgba(255,144,0,0.3)',
                    borderRadius: '18px',
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'rgba(255,144,0,0.01)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    maxWidth: '520px'
                  }}
                  >
                    <input
                      id="sheets-file-input"
                      type="file"
                      accept=".csv"
                      onChange={handleSheetsFileChange}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    />
                    <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>Очікуваний формат: колонка «Номенклатура» та колонка «Склад» (кількість)</p>
                  </div>

                  {/* Record mode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[{ v: 'add', label: '+ Додати до наявного' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                        <button key={opt.v} onClick={() => setSheetsRecordMode(opt.v)} type="button" style={{
                          background: sheetsRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                          border: sheetsRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                          color: sheetsRecordMode === opt.v ? '#ff9000' : '#888',
                          padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                        }}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PREVIEW: Results tabs ── */}
              {sheetsUploadStatus === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Stats summary */}
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Усього позицій', val: sheetsPreviewList.length, color: '#60a5fa' },
                      { label: 'Буде створено номенклатур', val: sheetsPreviewList.filter(s => s.isNew).length, color: '#ff9000' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Preview tabs */}
                  <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '5px', borderRadius: '14px', gap: '4px' }}>
                    {[
                      { id: 'all', label: `📋 Всі позиції (${sheetsPreviewList.length})` },
                      { id: 'new', label: `✨ Будуть створені (${sheetsPreviewList.filter(s => s.isNew).length})` },
                    ].map(t => (
                      <button key={t.id} onClick={() => setSheetsActivePreviewTab(t.id)} type="button" className={`tab-btn-v2 ${sheetsActivePreviewTab === t.id ? 'active' : ''}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Preview list table */}
                  <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                          <th style={{ padding: '10px 16px' }}>Номенклатура у файлі</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center' }}>Рядок</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center' }}>Кількість (шт)</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center' }}>Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheetsPreviewList
                          .filter(item => sheetsActivePreviewTab === 'all' || (sheetsActivePreviewTab === 'new' && item.isNew))
                          .map((l, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 700, color: l.isNew ? '#ff9000' : '#60a5fa' }}>{l.name}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', color: '#666' }}>{l.rowNum}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800 }}>{l.qty}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                {l.isNew ? (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 850, padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,144,0,0.15)', color: '#ff9000', border: '1px solid rgba(255,144,0,0.2)' }}>[БУДЕ СТВОРЕНО]</span>
                                ) : (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 850, padding: '3px 8px', borderRadius: '6px', background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>Розпізнано</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        {sheetsPreviewList.filter(item => sheetsActivePreviewTab === 'all' || (sheetsActivePreviewTab === 'new' && item.isNew)).length === 0 && (
                          <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#555', fontSize: '0.75rem' }}>Немає позицій для відображення</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Record mode + action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[{ v: 'add', label: '+ Додати' }, { v: 'overwrite', label: '✎ Перезаписати' }].map(opt => (
                          <button key={opt.v} onClick={() => setSheetsRecordMode(opt.v)} type="button" style={{
                            background: sheetsRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                            border: sheetsRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                            color: sheetsRecordMode === opt.v ? '#ff9000' : '#888',
                            padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                          }}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => { setSheetsUploadStatus('idle'); setSheetsFile(null); setSheetsPreviewList([]) }}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >← НАЗАД</button>
                      <button
                        type="button"
                        onClick={executeSheetsUpload}
                        disabled={sheetsPreviewList.length === 0}
                        style={{
                          background: sheetsPreviewList.length === 0 ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)',
                          border: 'none', color: sheetsPreviewList.length === 0 ? '#555' : '#000',
                          padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900,
                          cursor: sheetsPreviewList.length === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}
                      >
                        <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({sheetsPreviewList.length} позицій)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── UPLOADING ── */}
              {sheetsUploadStatus === 'uploading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
                  <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис залишків СО у базу...</div>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{sheetsUploadLog}</pre>
                </div>
              )}

              {/* ── SUCCESS ── */}
              {sheetsUploadStatus === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <CheckCircle2 size={52} color="#10b981" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Склад СО оновлено: підготовлені листи успішно оприбутковано.</p>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{sheetsUploadLog}</pre>
                  <button type="button" onClick={() => { setSheetsUploadStatus('idle'); setSheetsFile(null); setSheetsPreviewList([]); setSheetsUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
                    ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
                  </button>
                </div>
              )}

              {/* ── ERROR ── */}
              {sheetsUploadStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <AlertCircle size={52} color="#ef4444" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
                  <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{sheetsUploadLog}</pre>
                  <button type="button" onClick={() => { setSheetsUploadStatus('preview') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
                    ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
                  </button>
                </div>
              )}
            </section>

            {/* ── ЗАВАНТАЖЕННЯ ЗАЛИШКІВ ФРЕЗ (СКЛАД) ── */}
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ ФРЕЗ (СКЛАД)
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
                Завантажте CSV-файл залишків фрез зі складу. Колонки: <strong style={{ color: '#ff9000' }}>«Номенклатура»</strong>, <strong style={{ color: '#60a5fa' }}>«Діаметр ріжучої частини»</strong>, <strong style={{ color: '#10b981' }}>«Залишок на складі»</strong>. Сортуються автоматично за діаметром.
              </p>

              {cuttersUploadStatus === 'idle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}
                  >
                    <input 
                      id="cutters-file-input" 
                      type="file" 
                      accept=".csv" 
                      onChange={handleCuttersFileChange} 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
                    />
                    <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>«Номенклатура» | «Діаметр ріжучої частини» | «Залишок на складі»</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[{ v: 'overwrite', label: '✎ Перезаписати (рекомендовано)' }, { v: 'add', label: '+ Додати до наявного' }].map(opt => (
                        <button key={opt.v} onClick={() => setCuttersRecordMode(opt.v)} type="button" style={{
                          background: cuttersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                          border: cuttersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                          color: cuttersRecordMode === opt.v ? '#ff9000' : '#888',
                          padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                        }}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {cuttersUploadStatus === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Всього фрез', val: cuttersPreviewList.length, color: '#ff9000' },
                      { label: 'Унікальних діаметрів', val: new Set(cuttersPreviewList.map(i => i.diameter)).size, color: '#60a5fa' },
                      { label: 'Загальна кількість', val: cuttersPreviewList.reduce((s, i) => s + i.qty, 0), color: '#10b981' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                          <th style={{ padding: '10px 16px' }}>Назва фрези</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', color: '#60a5fa' }}>Ø Діаметр (мм)</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', color: '#10b981' }}>Залишок (шт)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuttersPreviewList.map((item, i) => {
                          const prevDiam = i > 0 ? cuttersPreviewList[i - 1].diameter : null
                          const isNewGroup = prevDiam !== item.diameter
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: isNewGroup && i > 0 ? 'rgba(255,144,0,0.02)' : 'transparent' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 700, color: '#eee' }}>{item.name}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', color: '#60a5fa', fontWeight: 900 }}>
                                {isNewGroup && <span style={{ display: 'inline-block', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px', padding: '2px 10px' }}>Ø {item.diameter}</span>}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, color: '#10b981', fontSize: '1rem' }}>{item.qty}</td>
                            </tr>
                          )
                        })}
                        {cuttersPreviewList.length === 0 && <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Жодної фрези не знайдено</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[{ v: 'overwrite', label: '✎ Перезаписати' }, { v: 'add', label: '+ Додати' }].map(opt => (
                          <button key={opt.v} onClick={() => setCuttersRecordMode(opt.v)} type="button" style={{
                            background: cuttersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                            border: cuttersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                            color: cuttersRecordMode === opt.v ? '#ff9000' : '#888',
                            padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                          }}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="button" onClick={() => { setCuttersUploadStatus('idle'); setCuttersFile(null); setCuttersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
                      <button type="button" onClick={executeCuttersUpload} disabled={cuttersPreviewList.length === 0} style={{ background: cuttersPreviewList.length === 0 ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)', border: 'none', color: cuttersPreviewList.length === 0 ? '#555' : '#000', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: cuttersPreviewList.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({cuttersPreviewList.length} фрез)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {cuttersUploadStatus === 'uploading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
                  <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис залишків фрез у базу...</div>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
                </div>
              )}

              {cuttersUploadStatus === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <CheckCircle2 size={52} color="#10b981" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Залишки фрез оновлено. Нач. цеху може обрати фрезу зі складу при формуванні наряду.</p>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
                  <button type="button" onClick={() => { setCuttersUploadStatus('idle'); setCuttersFile(null); setCuttersPreviewList([]); setCuttersUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
                    ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
                  </button>
                </div>
              )}

              {cuttersUploadStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <AlertCircle size={52} color="#ef4444" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
                  <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{cuttersUploadLog}</pre>
                  <button type="button" onClick={() => setCuttersUploadStatus('preview')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
                    ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
                  </button>
                </div>
              )}

            </section>

            {/* ── ЗАВАНТАЖЕННЯ ЗАЛИШКІВ МЕТИЗІВ (СВ) ── */}
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Layers size={20} /> ЗАВАНТАЖЕННЯ ЗАЛИШКІВ МЕТИЗІВ (СВ)
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#555', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
                Завантажте CSV-файл залишків метизів для Складу Виробництва (СВ). Колонки: <strong style={{ color: '#ff9000' }}>«Номенклатура»</strong>, <strong style={{ color: '#10b981' }}>«Залишок на складі»</strong>.
              </p>

              {fastenersUploadStatus === 'idle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ border: '2px dashed rgba(255,144,0,0.3)', borderRadius: '18px', padding: '36px 20px', textAlign: 'center', background: 'rgba(255,144,0,0.01)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', maxWidth: '520px' }}
                  >
                    <input 
                      id="fasteners-file-input" 
                      type="file" 
                      accept=".csv" 
                      onChange={handleFastenersFileChange} 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
                    />
                    <Upload size={38} color="#ff9000" style={{ marginBottom: '14px', opacity: 0.8, marginLeft: 'auto', marginRight: 'auto' }} />
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть або перетягніть CSV файл</h4>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>«Номенклатура» | «Залишок на складі»</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[{ v: 'overwrite', label: '✎ Перезаписати (рекомендовано)' }, { v: 'add', label: '+ Додати до наявного' }].map(opt => (
                        <button key={opt.v} onClick={() => setFastenersRecordMode(opt.v)} type="button" style={{
                          background: fastenersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                          border: fastenersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                          color: fastenersRecordMode === opt.v ? '#ff9000' : '#888',
                          padding: '6px 14px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                        }}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {fastenersUploadStatus === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Всього метизів', val: fastenersPreviewList.length, color: '#ff9000' },
                      { label: 'Загальна кількість', val: fastenersPreviewList.reduce((s, i) => s + i.qty, 0), color: '#10b981' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${s.color}22`, borderRadius: '14px', padding: '12px 20px', minWidth: '160px' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '0.68rem', color: '#888', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', background: 'rgba(0,0,0,0.12)' }} className="custom-scroll">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                          <th style={{ padding: '10px 16px' }}>Назва метизу</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', color: '#10b981' }}>Залишок (шт)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fastenersPreviewList.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '10px 16px', fontWeight: 700, color: '#eee' }}>{item.name}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 900, color: '#10b981', fontSize: '1rem' }}>{item.qty}</td>
                          </tr>
                        ))}
                        {fastenersPreviewList.length === 0 && <tr><td colSpan={2} style={{ padding: '24px', textAlign: 'center', color: '#555' }}>Жодних метизів не знайдено</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>Режим запису:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[{ v: 'overwrite', label: '✎ Перезаписати' }, { v: 'add', label: '+ Додати' }].map(opt => (
                          <button key={opt.v} onClick={() => setFastenersRecordMode(opt.v)} type="button" style={{
                            background: fastenersRecordMode === opt.v ? 'rgba(255,144,0,0.12)' : 'transparent',
                            border: fastenersRecordMode === opt.v ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.07)',
                            color: fastenersRecordMode === opt.v ? '#ff9000' : '#888',
                            padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', transition: '0.2s'
                          }}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="button" onClick={() => { setFastenersUploadStatus('idle'); setFastenersFile(null); setFastenersPreviewList([]) }} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#aaa', padding: '12px 22px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>← НАЗАД</button>
                      <button type="button" onClick={executeFastenersUpload} disabled={fastenersPreviewList.length === 0} style={{ background: fastenersPreviewList.length === 0 ? '#222' : 'linear-gradient(135deg, #ff9000, #ff6a00)', border: 'none', color: fastenersPreviewList.length === 0 ? '#555' : '#000', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 900, cursor: fastenersPreviewList.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Upload size={16} /> ЗАПИСАТИ В СИСТЕМУ ({fastenersPreviewList.length} метизів)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {fastenersUploadStatus === 'uploading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', padding: '30px 0' }}>
                  <div className="spinner-mes" style={{ width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                  <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Запис залишків метизів у базу...</div>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{fastenersUploadLog}</pre>
                </div>
              )}

              {fastenersUploadStatus === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <CheckCircle2 size={52} color="#10b981" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ЗАВАНТАЖЕННЯ ЗАВЕРШЕНО УСПІШНО!</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Залишки метизів на складі СВ оновлено.</p>
                  <pre style={{ background: '#000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{fastenersUploadLog}</pre>
                  <button type="button" onClick={() => { setFastenersUploadStatus('idle'); setFastenersFile(null); setFastenersPreviewList([]); setFastenersUploadLog('') }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
                    ЗАВАНТАЖИТИ НАСТУПНИЙ ФАЙЛ
                  </button>
                </div>
              )}

              {fastenersUploadStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                  <AlertCircle size={52} color="#ef4444" />
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ЗАПИСІ</h4>
                  <pre style={{ background: '#000', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '14px', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.7rem', width: '100%', maxWidth: '640px', maxHeight: '180px', overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }} className="custom-scroll">{fastenersUploadLog}</pre>
                  <button type="button" onClick={() => setFastenersUploadStatus('preview')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 28px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
                    ← ПОВЕРНУТИСЬ ДО ПЕРЕГЛЯДУ
                  </button>
                </div>
              )}

            </section>


          </div>
        )}

        {/* ── TAB 4: SNAPSHOT CORRECTIONS ── */}
        {activeTab === 'corrections' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <section className="settings-panel glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 900, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', color: '#ff9000' }}>
                <Sliders size={20} /> Адмін-корекція запусків та БЗ снапшотів
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#888', marginTop: 0, marginBottom: '24px', lineHeight: '1.5' }}>
                Тут ви можете скоригувати зафіксовані в нарядах дані по БЗ (Буферній Зоні). Система автоматично перерахує кількість деталей до випуску та необхідні листи, а також оновить відповідні запити матеріалів на складі й робочі картки БЗ.
              </p>
              
              <div style={{ display: 'flex', gap: '12px', maxWidth: '600px', marginBottom: '24px' }}>
                <input
                  style={{
                    width: '100%',
                    background: '#000',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: '#fff',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    fontFamily: 'inherit'
                  }}
                  value={corrSearchQuery}
                  onChange={e => setCorrSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchTasks()}
                  placeholder="Введіть номер наряду (напр: 30062026-01)"
                />
                <button
                  onClick={handleSearchTasks}
                  disabled={corrSearchLoading}
                  style={{
                    background: 'linear-gradient(135deg, #ff9000, #ff6a00)',
                    color: '#000',
                    border: 'none',
                    padding: '0 24px',
                    borderRadius: '12px',
                    fontWeight: 900,
                    cursor: corrSearchLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Search size={16} /> Пошук
                </button>
              </div>

              {corrSearchLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0' }}>
                  <div className="spinner-mes" style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.78rem', color: '#aaa' }}>Пошук нарядів...</span>
                </div>
              )}

              {corrFoundTasks.length > 0 && !corrSelectedTask && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Знайдені наряди:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                    {corrFoundTasks.map(t => (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTask(t)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '16px',
                          padding: '16px',
                          cursor: 'pointer',
                          transition: '0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,144,0,0.3)'; e.currentTarget.style.background = 'rgba(255,144,0,0.02)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>№ {t.order_num}{t.batch_index ? `/${t.batch_index}` : ''}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Клієнт: {t.customer}</div>
                        <div style={{ fontSize: '0.7rem', color: '#ff9000', marginTop: '8px', fontWeight: 700 }}>Етап: {t.step} | Стан: {t.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {corrFoundTasks.length === 0 && corrSearchQuery && !corrSearchLoading && (
                <div style={{ fontSize: '0.8rem', color: '#555', padding: '10px 0' }}>Нарядів не знайдено. Спробуйте інший пошуковий запит.</div>
              )}
            </section>

            {corrSelectedTask && (
              <section className="glass-panel" style={{ background: '#0e0e11', padding: '30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 950, color: '#fff' }}>
                      Редагування наряду № {corrSelectedTask.order_num}{corrSelectedTask.batch_index ? `/${corrSelectedTask.batch_index}` : ''}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '4px' }}>
                      Клієнт: {corrSelectedTask.customer} | Поточний крок: <strong style={{ color: '#ff9000' }}>{corrSelectedTask.step}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setCorrSelectedTask(null)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Назад до списку
                  </button>
                </div>

                <div style={{ border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', background: 'rgba(0,0,0,0.12)', overflowX: 'auto', marginBottom: '24px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                        <th style={{ padding: '12px 16px' }}>Деталь / Код</th>
                        <th style={{ padding: '12px 16px' }}>Матеріал</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>Потреба</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', color: '#ff9000' }}>Взято з БЗ (Запас)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>План до виготовлення</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>В листі (шт)</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', color: '#60a5fa' }}>Листів</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corrSnapshotParts.map(p => (
                        <tr key={p.nomenclature_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 800, color: '#fff' }}>{p.name}</div>
                            <div style={{ fontSize: '0.68rem', color: '#444', marginTop: '2px' }}>{p.code}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#888' }}>{p.material}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>{p.need}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={p.stock}
                              onChange={e => handlePartStockChange(p.nomenclature_id, e.target.value)}
                              style={{
                                background: '#000',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#ff9000',
                                padding: '6px 10px',
                                width: '100px',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                              }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#aaa' }}>{p.plan}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', color: '#666' }}>{p.units_per_sheet}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={p.sheets}
                              onChange={e => handlePartSheetsChange(p.nomenclature_id, e.target.value)}
                              style={{
                                background: '#000',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#60a5fa',
                                padding: '6px 10px',
                                width: '80px',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem'
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    onClick={() => handleSelectTask(corrSelectedTask)}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: '#aaa',
                      padding: '12px 24px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Скинути зміни
                  </button>
                  <button
                    onClick={handleSaveCorrection}
                    disabled={corrIsSaving}
                    style={{
                      background: 'linear-gradient(135deg, #ff9000, #ff6a00)',
                      color: '#000',
                      border: 'none',
                      padding: '12px 30px',
                      borderRadius: '12px',
                      fontWeight: 900,
                      cursor: corrIsSaving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {corrIsSaving ? 'Збереження...' : 'Зберегти зміни'}
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

      </div>

      {/* ── CSV IMPORT WIZARD MODAL ── */}
      {isImportModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5,5,7,0.85)',
          backdropFilter: 'blur(16px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: "'Outfit', sans-serif"
        }}>
          <div style={{
            background: '#0d0d11',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
            overflow: 'hidden',
            animation: 'fadeIn 0.25s ease'
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: '20px 28px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(255,144,0,0.1)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
                  <Upload size={18} color="#ff9000" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>ІМПОРТ ПРАЦІВНИКІВ З CSV</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.68rem', color: '#666', fontWeight: 600 }}>Швидке масове створення та оновлення облікових записів</p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#666'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }} className="custom-scroll">
              
              {/* PHASE 1: IDLE / FILE UPLOAD */}
              {importStatus === 'idle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '30px 0' }}>
                  <div style={{
                    width: '100%',
                    maxWidth: '500px',
                    border: '2px dashed rgba(255,144,0,0.3)',
                    borderRadius: '20px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    background: 'rgba(255,144,0,0.01)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#ff9000'; e.currentTarget.style.background = 'rgba(255,144,0,0.03)' }}
                    onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,144,0,0.3)'; e.currentTarget.style.background = 'rgba(255,144,0,0.01)' }}
                    onDrop={e => {
                      e.preventDefault()
                      const file = e.dataTransfer.files[0]
                      if (file && file.name.endsWith('.csv')) {
                        const fakeEvent = { target: { files: [file] } }
                        handleFileChange(fakeEvent)
                      } else {
                        alert('Будь ласка, завантажте файл у форматі .csv')
                      }
                    }}
                  >
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleFileChange} 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
                    />
                    <Upload size={40} color="#ff9000" style={{ marginBottom: '16px', opacity: 0.8 }} />
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 800 }}>Оберіть файл CSV для імпорту</h4>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#666', fontWeight: 600 }}>Перетягніть файл сюди або натисніть для вибору</p>
                  </div>

                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700 }}>Розділювач колонок:</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => handleDelimiterChange(';')} 
                        style={{
                          background: csvDelimiter === ';' ? '#ff9000' : 'rgba(255,255,255,0.03)',
                          color: csvDelimiter === ';' ? '#000' : '#888',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >крапка з комою (;)</button>
                      <button 
                        onClick={() => handleDelimiterChange(',')} 
                        style={{
                          background: csvDelimiter === ',' ? '#ff9000' : 'rgba(255,255,255,0.03)',
                          color: csvDelimiter === ',' ? '#000' : '#888',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >кома (,)</button>
                    </div>
                  </div>

                  <div style={{ maxWidth: '500px', width: '100%', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#ff9000', fontWeight: 800 }}>📌 Рекомендований формат CSV:</h5>
                      <p style={{ margin: 0, fontSize: '0.68rem', color: '#888', lineHeight: '1.5' }}>
                        Файл має містити рядок заголовків. Система автоматично визначить команди/колонки з назвами:<br />
                        <code>login</code>, <code>password</code>, <code>first_name</code>, <code>last_name</code>, <code>department</code> (цех), <code>position</code> (посада), <code>shift</code> (зміна).
                      </p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <button 
                        onClick={downloadTemplateExcel}
                        style={{
                          background: 'rgba(255,144,0,0.1)',
                          border: '1px solid rgba(255,144,0,0.2)',
                          color: '#ff9000',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,144,0,0.2)'; e.currentTarget.style.borderColor = 'rgba(255,144,0,0.4)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,144,0,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,144,0,0.2)' }}
                        type="button"
                      >
                        <Download size={14} /> ЗАВАНТАЖИТИ ШАБЛОН EXCEL (.XLSX)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PHASE 2: COLUMNS MAPPING & PREVIEW */}
              {importStatus === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Setup Columns and Defaults Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    
                    {/* Left: Columns Mapping */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        🔗 Відповідність колонок
                      </h4>
                      
                      {[
                        { key: 'login', label: 'Логін (англ, обов\'язково)*' },
                        { key: 'password', label: 'Пароль' },
                        { key: 'first_name', label: 'Ім\'я' },
                        { key: 'last_name', label: 'Прізвище' },
                        { key: 'department', label: 'Цех / Відділ' },
                        { key: 'position', label: 'Посада / Роль' },
                        { key: 'shift', label: 'Робоча зміна' },
                      ].map(field => (
                        <div key={field.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 600 }}>{field.label}</span>
                          <select 
                            style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 12px', color: '#fff', fontSize: '0.75rem', width: '200px', outline: 'none' }}
                            value={columnMapping[field.key]}
                            onChange={e => setColumnMapping({ ...columnMapping, [field.key]: parseInt(e.target.value) })}
                          >
                            <option value={-1}>-- Немає / За замовч. --</option>
                            {csvHeaders.map((h, i) => (
                              <option key={i} value={i}>Колонка {i + 1}: "{h}"</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Right: Default fallbacks & strategy */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderLeft: '1px solid rgba(255,255,255,0.04)', paddingLeft: '30px' }}>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '0.8rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ⚙️ Значення за замовчуванням
                      </h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label className="form-label">Пароль (якщо немає)</label>
                          <input style={{ ...inputStyle, padding: '8px 10px', fontSize: '0.75rem' }} value={defaultValues.password} onChange={e => setDefaultValues({...defaultValues, password: e.target.value})} placeholder="пароль..." />
                        </div>
                        <div>
                          <label className="form-label">Зміна (якщо немає)</label>
                          <select style={{ ...inputStyle, padding: '8px 10px', fontSize: '0.75rem' }} value={defaultValues.shift} onChange={e => setDefaultValues({...defaultValues, shift: e.target.value})}>
                            <option value="Зміна 1">Зміна 1</option>
                            <option value="Зміна 2">Зміна 2</option>
                            <option value="Зміна 3">Зміна 3</option>
                            <option value="Зміна 4">Зміна 4</option>
                            <option value="Без зміни">Без зміни</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label className="form-label">Цех / Відділ (якщо немає)</label>
                          <select style={{ ...inputStyle, padding: '8px 10px', fontSize: '0.75rem' }} value={defaultValues.department} onChange={e => setDefaultValues({...defaultValues, department: e.target.value})}>
                            {(companyStructure || []).map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Посада (якщо немає)</label>
                          <select style={{ ...inputStyle, padding: '8px 10px', fontSize: '0.75rem' }} value={defaultValues.position} onChange={e => setDefaultValues({...defaultValues, position: e.target.value})}>
                            {(companyPositions || []).map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Duplicate policy selection */}
                      <div>
                        <label className="form-label" style={{ marginBottom: '8px' }}>При знаходженні дубліката логіну</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => setDuplicatePolicy('skip')}
                            style={{
                              flex: 1,
                              background: duplicatePolicy === 'skip' ? 'rgba(255,144,0,0.1)' : 'transparent',
                              border: duplicatePolicy === 'skip' ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.06)',
                              color: duplicatePolicy === 'skip' ? '#ff9000' : '#888',
                              padding: '8px',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: '0.2s'
                            }}
                            type="button"
                          >Пропускати рядки</button>
                          <button 
                            onClick={() => setDuplicatePolicy('update')}
                            style={{
                              flex: 1,
                              background: duplicatePolicy === 'update' ? 'rgba(255,144,0,0.1)' : 'transparent',
                              border: duplicatePolicy === 'update' ? '1px solid #ff9000' : '1px solid rgba(255,255,255,0.06)',
                              color: duplicatePolicy === 'update' ? '#ff9000' : '#888',
                              padding: '8px',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: '0.2s'
                            }}
                            type="button"
                          >Оновлювати дані</button>
                        </div>
                      </div>

                      {/* Default Module access */}
                      <div>
                        <label className="form-label" style={{ marginBottom: '6px' }}>Права доступу для нових працівників</label>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          maxHeight: '75px',
                          overflowY: 'auto',
                          background: 'rgba(0,0,0,0.2)',
                          padding: '6px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.04)'
                        }} className="custom-scroll">
                          {moduleList.map(mod => (
                            <div key={mod.id} 
                              onClick={() => toggleDefaultRight(mod.id)}
                              style={{
                                padding: '3px 8px',
                                background: defaultValues.access_rights[mod.id] ? 'rgba(255,144,0,0.15)' : 'transparent',
                                border: defaultValues.access_rights[mod.id] ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.05)',
                                color: defaultValues.access_rights[mod.id] ? '#ff9000' : '#666',
                                borderRadius: '6px',
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: '0.15s'
                              }}
                            >
                              {mod.label}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Bottom: Preview Grid */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#ff9000', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📋 Попередній перегляд (Всього рядків: {csvRows.length})
                    </h4>
                    
                    <div style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      background: 'rgba(0,0,0,0.1)'
                    }} className="custom-scroll">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#666' }}>
                            <th style={{ padding: '8px 12px' }}>#</th>
                            <th style={{ padding: '8px 12px' }}>Логін</th>
                            <th style={{ padding: '8px 12px' }}>Пароль</th>
                            <th style={{ padding: '8px 12px' }}>Ім'я та Прізвище</th>
                            <th style={{ padding: '8px 12px' }}>Підрозділ / Посада</th>
                            <th style={{ padding: '8px 12px' }}>Зміна</th>
                            <th style={{ padding: '8px 12px' }}>Статус операції</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.slice(0, 100).map((row, idx) => {
                            let badgeColor = '#10b981'
                            let badgeBg = 'rgba(16,185,129,0.1)'
                            if (row.status === 'update') {
                              badgeColor = '#ff9000'
                              badgeBg = 'rgba(255,144,0,0.1)'
                            } else if (row.status === 'skip') {
                              badgeColor = '#888'
                              badgeBg = 'rgba(255,255,255,0.05)'
                            } else if (row.status === 'error') {
                              badgeColor = '#ef4444'
                              badgeBg = 'rgba(239,68,68,0.1)'
                            }
                            
                            return (
                              <tr key={row.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', color: row.status === 'error' ? '#888' : '#fff' }}>
                                <td style={{ padding: '8px 12px', color: '#555' }}>{idx + 1}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 700 }}>{row.login || '---'}</td>
                                <td style={{ padding: '8px 12px', color: '#666' }}>••••••••</td>
                                <td style={{ padding: '8px 12px' }}>{row.first_name} {row.last_name}</td>
                                <td style={{ padding: '8px 12px' }}>{row.department} / <span style={{ color: '#aaa' }}>{row.position}</span></td>
                                <td style={{ padding: '8px 12px', color: '#888' }}>{row.shift}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                    color: badgeColor,
                                    background: badgeBg
                                  }}>{row.message}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {csvRows.length > 100 && (
                        <div style={{ padding: '10px', textAlign: 'center', color: '#555', fontSize: '0.68rem', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                          Показано перші 100 записів із {csvRows.length}.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px' }}>
                    <button 
                      onClick={() => { setCsvFile(null); setCsvRows([]); setCsvHeaders([]); setImportStatus('idle') }}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#aaa', padding: '12px 24px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                      type="button"
                    >
                      НАЗАД ДО ФАЙЛУ
                    </button>
                    
                    <button 
                      onClick={executeImport}
                      style={{ background: 'linear-gradient(135deg, #ff9000, #ff6a00)', border: 'none', color: '#000', padding: '12px 30px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}
                      type="button"
                    >
                      ПОЧАТИ ІМПОРТ ({previewData.filter(r => r.status === 'insert' || r.status === 'update').length} користувачів)
                    </button>
                  </div>

                </div>
              )}

              {/* PHASE 3 & 4: IMPORTING, SUCCESS, ERROR LOG */}
              {(importStatus === 'importing' || importStatus === 'success' || importStatus === 'error') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '20px 0' }}>
                  
                  {importStatus === 'importing' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                      <div className="spinner-mes" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,144,0,0.15)', borderTopColor: '#ff9000', animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 700 }}>Здійснюється запис користувачів у базу даних...</div>
                    </div>
                  ) : importStatus === 'success' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle2 size={50} color="#10b981" />
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ІМПОРТ ЗАВЕРШЕНО УСПІШНО!</h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', textAlign: 'center' }}>Дані успішно внесено до Supabase. Локальна картотека автоматично оновиться.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <AlertCircle size={50} color="#ef4444" />
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>ПОМИЛКА ПРИ ІМПОРТІ</h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#ef4444', textAlign: 'center' }}>Запис деяких рядків не був завершений успішно.</p>
                    </div>
                  )}

                  <div style={{ width: '100%', maxWidth: '600px' }}>
                    <label className="form-label" style={{ marginBottom: '6px' }}>Лог імпорту</label>
                    <pre style={{
                      margin: 0,
                      background: '#000',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                      padding: '16px',
                      color: '#00ff66',
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      height: '180px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap'
                    }} className="custom-scroll">
                      {importLog}
                    </pre>
                  </div>

                  {importStatus !== 'importing' && (
                    <button 
                      onClick={() => setIsImportModalOpen(false)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', padding: '12px 30px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', marginTop: '10px' }}
                      type="button"
                    >
                      ЗАКРИТИ ВІКНО
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        .form-label { display: block; font-size: 0.65rem; color: #555; text-transform: uppercase; margin-bottom: 6px; font-weight: 900; letter-spacing: 0.05em; }
        
        .tab-btn-v2 { 
          padding: 10px 18px; 
          border: 1px solid transparent; 
          background: transparent; 
          color: #6b7280; 
          font-weight: 800; 
          font-size: 0.72rem; 
          border-radius: 12px; 
          cursor: pointer; 
          transition: all 0.2s ease; 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .tab-btn-v2.active { 
          background: rgba(255,144,0,0.08); 
          color: #ff9000; 
          border: 1px solid rgba(255,144,0,0.15);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15); 
        }
        .tab-btn-v2:hover:not(.active) { 
          color: #fff; 
          background: rgba(255,255,255,0.02); 
        }
        
        .dossier-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255,144,0,0.3) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        
        .card-action-btn:hover {
          background: rgba(255,255,255,0.08) !important;
          color: #fff !important;
        }
        
        .structure-node-card:hover {
          border-color: rgba(255,144,0,0.2) !important;
          background: #111115 !important;
        }
        
        .delete-node-btn:hover {
          color: #f87171 !important;
        }
        
        .primary-btn:hover {
          filter: brightness(1.1);
        }
        
        .logout-btn:hover {
          background: rgba(239,68,68,0.2) !important;
        }
        
        .nav-back-link:hover {
          color: #fff !important;
        }
        
        .custom-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: #ff9000;
          border-radius: 4px;
        }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 900px) {
          .settings-module-v2 {
            min-height: 100dvh !important;
            overflow-x: hidden !important;
          }

          .settings-module-v2 .module-nav {
            height: auto !important;
            min-height: 64px !important;
            padding: 10px 12px !important;
            gap: 10px !important;
            align-items: center !important;
          }

          .settings-module-v2 .module-nav h1 {
            font-size: 0.86rem !important;
            line-height: 1.15 !important;
            max-width: 46vw !important;
            white-space: normal !important;
          }

          .settings-module-v2 .module-nav > div {
            gap: 10px !important;
            min-width: 0 !important;
          }

          .settings-module-v2 .module-content {
            width: 100% !important;
            max-width: none !important;
            padding: 12px !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }

          .settings-module-v2 .settings-tabs {
            display: flex !important;
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            margin-bottom: 16px !important;
            border-radius: 14px !important;
            padding: 5px !important;
            gap: 5px !important;
            scrollbar-width: none;
          }

          .settings-module-v2 .settings-tabs::-webkit-scrollbar {
            display: none;
          }

          .settings-module-v2 .tab-btn-v2 {
            flex: 0 0 auto !important;
            min-height: 42px !important;
            padding: 10px 12px !important;
            font-size: 0.68rem !important;
            border-radius: 10px !important;
            white-space: nowrap !important;
          }

          .settings-module-v2 .admin-users-layout,
          .settings-module-v2 .system-settings-layout {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }

          .settings-module-v2 .user-editor-panel {
            display: none !important;
          }

          .settings-module-v2 .user-editor-panel.mobile-open {
            display: block !important;
          }

          .settings-module-v2 .mobile-new-user-btn,
          .settings-module-v2 .mobile-user-form-close {
            display: flex !important;
          }

          .settings-module-v2 section,
          .settings-module-v2 .settings-panel,
          .settings-module-v2 .glass-panel {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
            padding: 16px !important;
            border-radius: 16px !important;
            position: static !important;
            top: auto !important;
            overflow-x: auto !important;
          }

          .settings-module-v2 form {
            gap: 14px !important;
          }

          .settings-module-v2 form > div,
          .settings-module-v2 section > div,
          .settings-module-v2 .settings-panel > div {
            min-width: 0 !important;
          }

          .settings-module-v2 form div[style*="grid-template-columns"],
          .settings-module-v2 section div[style*="grid-template-columns"],
          .settings-module-v2 .settings-panel div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }

          .settings-module-v2 div[style*="display: flex"] {
            min-width: 0 !important;
          }

          .settings-module-v2 input,
          .settings-module-v2 select,
          .settings-module-v2 textarea {
            max-width: 100% !important;
            min-height: 44px !important;
            font-size: 16px !important;
            box-sizing: border-box !important;
          }

          .settings-module-v2 button {
            min-height: 42px !important;
            touch-action: manipulation;
          }

          .settings-module-v2 .primary-btn,
          .settings-module-v2 .logout-btn {
            padding: 10px 12px !important;
            white-space: nowrap !important;
          }

          .settings-module-v2 section h3,
          .settings-module-v2 .settings-panel h3 {
            font-size: 0.92rem !important;
            line-height: 1.25 !important;
            margin-bottom: 14px !important;
            flex-wrap: wrap !important;
          }

          .settings-module-v2 section h4,
          .settings-module-v2 .settings-panel h4 {
            font-size: 0.76rem !important;
            line-height: 1.3 !important;
          }

          .settings-module-v2 p {
            font-size: 0.76rem !important;
            line-height: 1.45 !important;
          }

          .settings-module-v2 table {
            min-width: 680px !important;
          }

          .settings-module-v2 pre,
          .settings-module-v2 code {
            white-space: pre-wrap !important;
            overflow-wrap: anywhere !important;
          }

          .settings-module-v2 .dossier-card {
            transform: none !important;
          }
        }

        @media (max-width: 560px) {
          .hide-mobile { display: none !important; }

          .settings-module-v2 .module-nav {
            position: sticky !important;
            top: 0 !important;
          }

          .settings-module-v2 .module-nav h1 {
            font-size: 0.78rem !important;
            max-width: 52vw !important;
          }

          .settings-module-v2 .module-content {
            padding: 10px !important;
          }

          .settings-module-v2 .settings-tabs {
            width: calc(100vw - 20px) !important;
            max-width: calc(100vw - 20px) !important;
            margin-bottom: 12px !important;
          }

          .settings-module-v2 .tab-btn-v2 {
            min-height: 40px !important;
            padding: 9px 10px !important;
            font-size: 0.64rem !important;
            gap: 6px !important;
          }

          .settings-module-v2 section,
          .settings-module-v2 .settings-panel,
          .settings-module-v2 .glass-panel {
            padding: 14px !important;
            border-radius: 14px !important;
          }

          .settings-module-v2 .admin-users-layout,
          .settings-module-v2 .system-settings-layout {
            gap: 12px !important;
          }

          .settings-module-v2 section div[style*="justify-content: space-between"],
          .settings-module-v2 .settings-panel div[style*="justify-content: space-between"] {
            align-items: stretch !important;
            flex-wrap: wrap !important;
          }

          .settings-module-v2 section div[style*="display: flex"],
          .settings-module-v2 .settings-panel div[style*="display: flex"] {
            flex-wrap: wrap !important;
          }

          .settings-module-v2 .primary-btn {
            width: 100% !important;
          }

          .settings-module-v2 select {
            width: 100% !important;
          }

          .settings-module-v2 table {
            min-width: 620px !important;
            font-size: 0.7rem !important;
          }
        }
      `}} />
    </div>
  )
}

const inputStyle = { 
  width: '100%', 
  background: '#000', 
  border: '1px solid rgba(255,255,255,0.05)', 
  color: '#fff', 
  padding: '12px 14px', 
  borderRadius: '12px', 
  fontSize: '0.85rem', 
  outline: 'none',
  transition: 'border-color 0.2s',
  fontFamily: 'inherit'
}

const filterSelectStyle = {
  background: '#000',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '10px',
  padding: '6px 12px',
  color: '#aaa',
  fontSize: '0.72rem',
  fontWeight: 700,
  outline: 'none',
  cursor: 'pointer'
}

const startPageModules = [
  { path: '/dashboard', label: 'Дашборд WIP' },
  { path: '/manager', label: 'Менеджер' },
  { path: '/tasks', label: 'Задачі (Внутрішні)' },
  { path: '/master', label: 'Цех №1 (Управління)' },
  { path: '/shop1', label: 'Цех №1 · Термінал (Розкрій→Прийомка)' },
  { path: '/shop2', label: 'Цех №2 (Черга нарядів)' },
  { path: '/shop2-terminal', label: 'Цех №2 · Термінал (Прес→Малярка)' },
  { path: '/operator', label: 'Термінал оператора' },
  { path: '/warehouse', label: 'Склад ... Оперативний' },
  { path: '/supply', label: 'Склад Виробництва' },
  { path: '/procurement', label: 'Постачання (Закупівля)' },
  { path: '/packaging', label: 'Пакування' },
  { path: '/shipping', label: 'Логістика (Відвантаження)' },
  { path: '/engineer', label: 'Інженер' },
  { path: '/director', label: 'Директор Виробництва' },
  { path: '/foreman', label: 'Майстер цеху (Розподіл)' },
  { path: '/foreman2', label: 'Foreman 2.0' },
  { path: '/nomenclature-v2', label: 'Номенклатура (Нова)' },
  { path: '/nomenclature', label: 'База номенклатур (Old)' },
  { path: '/machines', label: 'Станки' },
  { path: '/analytics', label: 'Аналітика' },
  { path: '/brak', label: 'ВКЯ (Контроль якості)' },
  { path: '/access', label: 'Система Доступу (Fortnet)' },
  { path: '/reports', label: 'Звіти (1С)' }
]

export default SettingsModule
