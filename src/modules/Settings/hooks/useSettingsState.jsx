import React, { useState } from 'react'
import { useMES } from '../../../MESContext'
import { useSettingsUsers } from './subhooks/useSettingsUsers'
import { useSettingsStructure } from './subhooks/useSettingsStructure'
import { useSettingsImports } from './subhooks/useSettingsImports'
import { useSettingsSnapshotCorr } from './subhooks/useSettingsSnapshotCorr'
import { useSettingsSystemAdmin } from './subhooks/useSettingsSystemAdmin'

export function AvatarImage({ src, initials, position }) {
  const [failed, setFailed] = useState(false)
  
  if (failed) {
    const posLower = (position || '').toLowerCase()
    const grad = posLower.includes('адмін') || posLower.includes('admin')
      ? 'linear-gradient(135deg, #ff9000, #ea580c)'
      : posLower.includes('директор') || posLower.includes('керівник') || posLower.includes('начальник') || posLower.includes('майстер')
      ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
      : 'linear-gradient(135deg, #64748b, #334155)'

    return (
      <div 
        className="user-avatar-badge"
        style={{ 
          width: '46px', 
          height: '46px', 
          borderRadius: '14px', 
          background: grad, 
          border: position === 'Адмін' ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: '0.9rem',
          color: '#ffffff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          flexShrink: 0
        }}
      >
        {initials}
      </div>
    )
  }

  return (
    <img 
      src={src} 
      alt={initials} 
      onError={() => setFailed(true)}
      style={{ 
        width: '46px', 
        height: '46px', 
        borderRadius: '14px', 
        objectFit: 'cover', 
        border: position === 'Адмін' ? '1px solid rgba(255,144,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0
      }} 
    />
  )
}

export const formatLastSeen = (lastSeen) => {
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

export const startPageModules = [
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

export function useSettingsState() {
  const mesContext = useMES()

  // Subhook 1: System Admin (Nova Poshta, Fortnet, Tab routing)
  const systemAdmin = useSettingsSystemAdmin({
    fortnetUrl: mesContext.fortnetUrl,
    updateFortnetUrl: mesContext.updateFortnetUrl,
    maintenanceCheckEnabled: mesContext.maintenanceCheckEnabled,
    updateMaintenanceCheckEnabled: mesContext.updateMaintenanceCheckEnabled
  })

  // Subhook 2: Users, Dossier, Permissions, Avatars
  const usersDomain = useSettingsUsers({
    systemUsers: mesContext.systemUsers,
    currentUser: mesContext.currentUser,
    upsertUser: mesContext.upsertUser,
    deleteUser: mesContext.deleteUser,
    companyStructure: mesContext.companyStructure,
    companyPositions: mesContext.companyPositions,
    setActiveTab: systemAdmin.setActiveTab,
    AvatarImage
  })

  // Subhook 3: Company Structure & Positions
  const structureDomain = useSettingsStructure({
    companyStructure: mesContext.companyStructure,
    upsertCompanyStructure: mesContext.upsertCompanyStructure,
    deleteCompanyStructure: mesContext.deleteCompanyStructure,
    companyPositions: mesContext.companyPositions,
    upsertCompanyPosition: mesContext.upsertCompanyPosition,
    deleteCompanyPosition: mesContext.deleteCompanyPosition,
    systemUsers: mesContext.systemUsers
  })

  // Subhook 4: CSV & Excel Data Importers (BZ, Sheets, Cutters, Fasteners, Users)
  const importsDomain = useSettingsImports({
    nomenclatures: mesContext.nomenclatures,
    inventory: mesContext.inventory,
    refreshTable: mesContext.refreshTable,
    supabase: mesContext.supabase,
    companyStructure: mesContext.companyStructure,
    companyPositions: mesContext.companyPositions,
    systemUsers: mesContext.systemUsers
  })

  // Subhook 5: Plan Snapshot Corrections
  const snapshotCorr = useSettingsSnapshotCorr({
    supabase: mesContext.supabase,
    refreshTable: mesContext.refreshTable
  })

  return {
    ...mesContext,
    ...importsDomain,
    ...systemAdmin,
    ...structureDomain,
    ...snapshotCorr,
    ...usersDomain,
    startPageModules,
    formatLastSeen
  }
}
