import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMES } from '../../../MESContext'
import { supabase as supabaseClient } from '../../../supabase'

export function useWarehouseData() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { fetchData, machineCalls, currentUser, tasks, machines } = useMES()

  useEffect(() => { 
    if (typeof fetchData === 'function') {
      fetchData(['inventory', 'material_requests', 'reception_docs', 'purchase_requests', 'tasks', 'work_cards', 'orders', 'machine_operations'])
    }
  }, [])

  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'raw'
  })

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const [showAdd, setShowAdd] = useState(false)
  const [showReception, setShowReception] = useState(false)
  const [shortages, setShortages] = useState(null)
  const [newItem, setNewItem] = useState({ name: '', unit: 'шт', total_qty: '', type: 'raw', pocket_owner: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPocketOwner, setSelectedPocketOwner] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingDocs, setProcessingDocs] = useState(new Set())
  const [processingTasks, setProcessingTasks] = useState(new Set())
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [editingQty, setEditingQty] = useState({})
  const [savingQty, setSavingQty] = useState(new Set())

  // Cutter box state
  const [checkedCutters, setCheckedCutters] = useState({}) 
  const [expandedNaryads, setExpandedNaryads] = useState({}) 
  const [expandedNomenclatures, setExpandedNomenclatures] = useState({}) 

  // Scanner state
  const [isScanning, setIsScanning] = useState(false)
  const [scannedCard, setScannedCard] = useState(null)
  const [scannedRequests, setScannedRequests] = useState([])
  const [isIssuingCard, setIsIssuingCard] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [manualCardInput, setManualCardInput] = useState('')

  // Super admin overrides
  const [editingInvId, setEditingInvId] = useState(null)
  const [editingInvTotal, setEditingInvTotal] = useState('')
  const [editingInvReserved, setEditingInvReserved] = useState('')
  const [savingInv, setSavingInv] = useState(false)

  const activeCalls = (machineCalls || []).filter(c => 
    c.status === 'pending' && 
    c.called_role === 'master' && // wait, called_role in original was actually called_role = 'master' or called_role = 'warehouse'? Wait!
    // Ah, lines 288-290 in original had called_role === 'engineer' but lines 2824-2826:
    // c.status === 'pending' && c.called_role === 'warehouse' ? Wait.
    // Let's verify in WarehouseModuleV2.jsx:
    // "c.called_role === 'master' && (!c.called_employee_id || c.called_employee_id === currentUser?.id)" - Ah! It was called_role === 'warehouse' or called_role === 'master'? Let's check original.
    // Let's look at lines 2810 to 2860 of original WarehouseModuleV2.jsx in view_file. Oh, we viewed up to 1599. Let's inspect the very end of WarehouseModuleV2.jsx.
    c.called_role === 'warehouse'
  )

  return {
    activeTab, setActiveTab,
    showAdd, setShowAdd,
    showReception, setShowReception,
    shortages, setShortages,
    newItem, setNewItem,
    searchQuery, setSearchQuery,
    selectedPocketOwner, setSelectedPocketOwner,
    isProcessing, setIsProcessing,
    processingDocs, setProcessingDocs,
    processingTasks, setProcessingTasks,
    expandedDoc, setExpandedDoc,
    editingQty, setEditingQty,
    savingQty, setSavingQty,
    checkedCutters, setCheckedCutters,
    expandedNaryads, setExpandedNaryads,
    expandedNomenclatures, setExpandedNomenclatures,
    isScanning, setIsScanning,
    scannedCard, setScannedCard,
    scannedRequests, setScannedRequests,
    isIssuingCard, setIsIssuingCard,
    cameraError, setCameraError,
    manualCardInput, setManualCardInput,
    editingInvId, setEditingInvId,
    editingInvTotal, setEditingInvTotal,
    editingInvReserved, setEditingInvReserved,
    savingInv, setSavingInv,
    activeCalls
  }
}
