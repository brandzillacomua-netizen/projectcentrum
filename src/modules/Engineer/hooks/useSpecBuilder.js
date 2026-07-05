import { useState, useMemo, useRef, useEffect } from 'react'
import { useMES } from '../../../MESContext'

export function useSpecBuilder() {
  const { nomenclatures, bomItems } = useMES()

  const [parentId, setParentId] = useState('')
  const [pendingParent, setPendingParent] = useState(null)
  const [parentSearch, setParentSearch] = useState('')
  const [showParentDrop, setShowParentDrop] = useState(false)
  const [rows, setRows] = useState([])
  const lastLoadedParentId = useRef(null)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState('editor') 
  const [catalogSearch, setCatalogSearch] = useState('')
  const [expandedParents, setExpandedParents] = useState({})
  const [showNomCreate, setShowNomCreate] = useState(false)
  const [showParentCreate, setShowParentCreate] = useState(false)
  const [parentCreateType, setParentCreateType] = useState('product')
  const [dossierParentId, setDossierParentId] = useState(null)

  // State for inline operations manager
  const [activeInlinePart, setActiveInlinePart] = useState(null) 
  const [selectedMachine, setSelectedMachine] = useState('')
  const [side1Ops, setSide1Ops] = useState([])
  const [side2OpsF2, setSide2OpsF2] = useState([])
  const [side2OpsF15, setSide2OpsF15] = useState([])
  const [side2CutOpsF2, setSide2CutOpsF2] = useState([])
  const [side2CutOpsF15, setSide2CutOpsF15] = useState([])
  const [inlineCuttersList, setInlineCuttersList] = useState([])
  const [savingOps, setSavingOps] = useState(false)

  return {
    parentId, setParentId,
    pendingParent, setPendingParent,
    parentSearch, setParentSearch,
    showParentDrop, setShowParentDrop,
    rows, setRows,
    lastLoadedParentId,
    saving, setSaving,
    viewMode, setViewMode,
    catalogSearch, setCatalogSearch,
    expandedParents, setExpandedParents,
    showNomCreate, setShowNomCreate,
    showParentCreate, setShowParentCreate,
    parentCreateType, setParentCreateType,
    dossierParentId, setDossierParentId,
    activeInlinePart, setActiveInlinePart,
    selectedMachine, setSelectedMachine,
    side1Ops, setSide1Ops,
    side2OpsF2, setSide2OpsF2,
    side2OpsF15, setSide2OpsF15,
    side2CutOpsF2, setSide2CutOpsF2,
    side2CutOpsF15, setSide2CutOpsF15,
    inlineCuttersList, setInlineCuttersList,
    savingOps, setSavingOps
  }
}
