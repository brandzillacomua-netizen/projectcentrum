import React, { useState } from 'react'
import { Building, Truck, Hammer, ShieldCheck, AlertCircle, Building2 } from 'lucide-react'

export const typeLabels = {
  shop: 'Виробничий цех',
  warehouse: 'Оперативний склад',
  tumbling: 'Дільниця',
  quality: 'Контроль якості (ВКЯ)',
  management: 'Керівництво',
  other: 'Інший підрозділ'
}

export const typeColors = {
  shop: '#ff9000',
  warehouse: '#10b981',
  tumbling: '#06b6d4',
  quality: '#ef4444',
  management: '#a855f7',
  other: '#6b7280'
}

export const getStructureTypeIcon = (type) => {
  switch (type) {
    case 'shop': return <Building size={16} color="#ff9000" />
    case 'warehouse': return <Truck size={16} color="#10b981" />
    case 'tumbling': return <Hammer size={16} color="#06b6d4" />
    case 'management': return <ShieldCheck size={16} color="#a855f7" />
    case 'quality': return <AlertCircle size={16} color="#ef4444" />
    default: return <Building2 size={16} color="#6b7280" />
  }
}

export function useSettingsStructure({
  companyStructure,
  upsertCompanyStructure,
  deleteCompanyStructure,
  companyPositions,
  upsertCompanyPosition,
  deleteCompanyPosition,
  systemUsers
}) {
  const [structureSubTab, setStructureSubTab] = useState('departments')
  const [savingPosId, setSavingPosId] = useState(null)
  const [sqlErrorPosition, setSqlErrorPosition] = useState(false)

  // Structure Form State
  const [structureForm, setStructureForm] = useState({
    id: null,
    name: '',
    type: 'shop'
  })

  // Position Form State
  const [positionForm, setPositionForm] = useState({ id: null, name: '', department_id: '' })

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

  return {
    structureSubTab,
    setStructureSubTab,
    structureForm,
    setStructureForm,
    positionForm,
    setPositionForm,
    savingPosId,
    setSavingPosId,
    sqlErrorPosition,
    setSqlErrorPosition,
    handleSaveStructure,
    editStructure,
    handleDeleteStructure,
    handleSavePosition,
    editPosition,
    handleDeletePosition,
    typeLabels,
    typeColors,
    getStructureTypeIcon
  }
}
