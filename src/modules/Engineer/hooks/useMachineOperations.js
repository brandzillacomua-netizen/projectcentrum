import { useState, useEffect } from 'react'
import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'

const MACHINE_TYPES = [
  'CNC 1200x800 - 4 листи (Малий)',
  'CNC 3050(16)х16 - 3-12 листів (швидкісний)',
  'CNC 3060х1600 - 3-36 листів (Три Головий)',
  'CNC 6000x2000 - 4 - 96 листів (Дракон)',
  'CNC KE XIN - 4 - 16 листів (ФЕЯ)'
]

const combineOps = (f2Arr, f15Arr) => {
  const maxLen = Math.max(f2Arr.length, f15Arr.length)
  const combined = []
  for (let i = 0; i < maxLen; i++) {
    const valF2 = (f2Arr[i] || "").trim()
    const valF15 = (f15Arr[i] || "").trim()
    if (valF15) {
      combined.push(`${valF2} | ${valF15}`)
    } else if (valF2) {
      combined.push(valF2)
    }
  }
  return combined.filter(Boolean)
}

export function useMachineOperations() {
  const { nomenclatures, machines, machineOperations, refreshTable } = useMES()
  const [selectedNom, setSelectedNom] = useState('')
  const [selectedMachine, setSelectedMachine] = useState('')
  const [side1Ops, setSide1Ops] = useState([])
  const [side2OpsF2, setSide2OpsF2] = useState([])
  const [side2OpsF15, setSide2OpsF15] = useState([])
  const [side2CutOpsF2, setSide2CutOpsF2] = useState([])
  const [side2CutOpsF15, setSide2CutOpsF15] = useState([])
  const [cuttersList, setCuttersList] = useState([])
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (selectedNom && selectedMachine) {
      const existing = machineOperations?.find(o => 
        o.nomenclature_id === selectedNom && 
        (o.machine_type === selectedMachine || o.machine_id === selectedMachine)
      )
      if (existing) {
        setSide1Ops((existing.side1_ops || []).filter(op => !op.startsWith('__CUTTER__:')))
        const s2 = (existing.side2_ops || []).filter(op => !op.startsWith('__CUTTER__:'))
        setSide2OpsF2(s2.map(op => op.includes('|') ? op.split('|')[0].trim() : op))
        setSide2OpsF15(s2.map(op => op.includes('|') ? op.split('|')[1].trim() : ''))
        const s2c = (existing.side2_cut_ops || []).filter(op => !op.startsWith('__CUTTER__:') && !op.startsWith('__CUTTER__Reference:'))
        setSide2CutOpsF2(s2c.map(op => op.includes('|') ? op.split('|')[0].trim() : op))
        setSide2CutOpsF15(s2c.map(op => op.includes('|') ? op.split('|')[1].trim() : ''))
        
        const cutterOps = (existing.side2_cut_ops || []).filter(op => op.startsWith('__CUTTER__:'))
        const parsed = cutterOps.map(c => {
          const parts = c.split(':')
          return { nomId: parts[1], qty: parseFloat(parts[2]) || 0 }
        })
        setCuttersList(parsed)
      } else {
        setSide1Ops([])
        setSide2OpsF2([])
        setSide2OpsF15([])
        setSide2CutOpsF2([])
        setSide2CutOpsF15([])
        setCuttersList([])
      }
    }
  }, [selectedNom, selectedMachine, machineOperations])

  return {
    selectedNom, setSelectedNom,
    selectedMachine, setSelectedMachine,
    side1Ops, setSide1Ops,
    side2OpsF2, setSide2OpsF2,
    side2OpsF15, setSide2OpsF15,
    side2CutOpsF2, setSide2CutOpsF2,
    side2CutOpsF15, setSide2CutOpsF15,
    cuttersList, setCuttersList,
    uploading, setUploading,
    searchQuery, setSearchQuery
  }
}
