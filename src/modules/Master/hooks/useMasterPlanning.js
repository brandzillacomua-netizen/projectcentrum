import { useState, useMemo } from 'react'
import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'

export function useMasterPlanning() {
  const { nomenclatures, bomItems, inventory, tasks, orders } = useMES()

  const [activeNaryadOrder, setActiveNaryadOrder] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState(null)
  const [rowMachines, setRowMachines] = useState({}) 
  const [rowMachinesSplits, setRowMachinesSplits] = useState({}) 
  const [isReprintMode, setIsReprintMode] = useState(false)
  const [reprintTask, setReprintTask] = useState(null)
  const [selectedCutters, setSelectedCutters] = useState({}) 
  const [partCutterOverrides, setPartCutterOverrides] = useState({}) 
  const [allOrdersMap, setAllOrdersMap] = useState({})
  const [showAuxiliary, setShowAuxiliary] = useState(false)

  // Quick Plan state
  const [quickPlanOrder, setQuickPlanOrder] = useState(null)
  const [tempSets, setTempSets] = useState('')
  const [tempDeadline, setTempDeadline] = useState('')

  // Detailed modal states
  const [naryadQtys, setNaryadQtys] = useState({}) 
  const [naryadDeadline, setNaryadDeadline] = useState('')
  const [naryadParts, setNaryadParts] = useState({}) 
  const [partSearchQueries, setPartSearchQueries] = useState({}) 
  const [openDropdownRowKey, setOpenDropdownRowKey] = useState(null) 
  const [materialSplits, setMaterialSplits] = useState({}) 
  const [stockInfoModalData, setStockInfoModalData] = useState(null)

  return {
    activeNaryadOrder, setActiveNaryadOrder,
    isSubmitting, setIsSubmitting,
    selectedMachine, setSelectedMachine,
    rowMachines, setRowMachines,
    rowMachinesSplits, setRowMachinesSplits,
    isReprintMode, setIsReprintMode,
    reprintTask, setReprintTask,
    selectedCutters, setSelectedCutters,
    partCutterOverrides, setPartCutterOverrides,
    allOrdersMap, setAllOrdersMap,
    showAuxiliary, setShowAuxiliary,
    quickPlanOrder, setQuickPlanOrder,
    tempSets, setTempSets,
    tempDeadline, setTempDeadline,
    naryadQtys, setNaryadQtys,
    naryadDeadline, setNaryadDeadline,
    naryadParts, setNaryadParts,
    partSearchQueries, setPartSearchQueries,
    openDropdownRowKey, setOpenDropdownRowKey,
    materialSplits, setMaterialSplits,
    stockInfoModalData, setStockInfoModalData
  }
}
