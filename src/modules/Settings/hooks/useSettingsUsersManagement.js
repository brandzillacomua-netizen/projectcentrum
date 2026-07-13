import { useState } from 'react'
import { useMES } from '../../../MESContext'

export function useSettingsUsersManagement() {
  const { companyPositions, companyStructure } = useMES()

  const [activeTab, setActiveTab] = useState('users')
  const [structureSubTab, setStructureSubTab] = useState('departments')
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
      dashboard: false, foreman_dashboard: false, manager: false, master: false, warehouse: false, engineer: false, 
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

  return {
    activeTab, setActiveTab,
    structureSubTab, setStructureSubTab,
    savingPosId, setSavingPosId,
    sqlErrorPosition, setSqlErrorPosition,
    isImportModalOpen, setIsImportModalOpen,
    csvFile, setCsvFile,
    csvDelimiter, setCsvDelimiter,
    csvHeaders, setCsvHeaders,
    csvRows, setCsvRows,
    columnMapping, setColumnMapping,
    defaultValues, setDefaultValues,
    duplicatePolicy, setDuplicatePolicy,
    importStatus, setImportStatus,
    importLog, setImportLog,
    userForm, setUserForm,
    structureForm, setStructureForm,
    positionForm, setPositionForm,
    userSearch, setUserSearch,
    filterDepartment, setFilterDepartment,
    filterPosition, setFilterPosition,
    filterShift, setFilterShift,
    filterOnlyOnline, setFilterOnlyOnline
  }
}
