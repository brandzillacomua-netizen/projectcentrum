import { useState, useEffect, useMemo } from 'react'

export function useWarehouseTheme(globalTheme) {
  const [isDark, setIsDark] = useState(() => {
    if (globalTheme) return globalTheme === 'dark'
    if (typeof document !== 'undefined') return !document.body.classList.contains('light-theme')
    return false
  })

  useEffect(() => {
    if (globalTheme) {
      setIsDark(globalTheme === 'dark')
    } else if (typeof document !== 'undefined') {
      setIsDark(!document.body.classList.contains('light-theme'))
    }
  }, [globalTheme])

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const check = () => {
      if (globalTheme) {
        setIsDark(globalTheme === 'dark')
      } else {
        setIsDark(!document.body.classList.contains('light-theme'))
      }
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [globalTheme])

  const t = useMemo(() => {
    if (isDark) {
      return {
        bg: '#090a0f',
        navBg: '#12141c',
        navBorder: '#1f2430',
        cardBg: '#12141c',
        cardHeaderBg: '#161924',
        cardBorder: '#232938',
        subtleBg: '#181b26',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        textMuted: '#64748b',
        inputBg: '#161924',
        inputBorder: '#2a3245',
        inputText: '#f8fafc',
        tableHeadBg: '#161924',
        tableBorder: '#1f2430',
        tableRowHover: '#181b26',
        tableRowBorder: '#1a1e2a',
        buttonSecondaryBg: '#1a1e2b',
        buttonSecondaryBorder: '#2d3748',
        buttonSecondaryText: '#cbd5e1',
        kpiBoxBg: '#12141c',
        kpiBoxBorder: '#1f2430',
        kpiBlueIconBg: '#082f49',
        kpiBlueIconBorder: '#0369a1',
        kpiAmberIconBg: '#451a03',
        kpiAmberIconBorder: '#b45309',
        kpiGreenIconBg: '#022c22',
        kpiGreenIconBorder: '#047857',
        queueTabsBg: '#12141c',
        queueTabsBorder: '#1f2430',
        orderBadgeBg: '#1e3a8a',
        orderBadgeBorder: '#3b82f6',
        orderBadgeText: '#bfdbfe',
        customerBadgeBg: '#1a1e2b',
        customerBadgeBorder: '#2d3748',
        customerBadgeText: '#e2e8f0',
        readyBadgeBg: '#022c22',
        readyBadgeBorder: '#059669',
        readyBadgeText: '#34d399',
        shortageBadgeBg: '#451a03',
        shortageBadgeBorder: '#b45309',
        shortageBadgeText: '#fbbf24',
        issuedRowBadgeBg: '#022c22',
        issuedRowBadgeBorder: '#047857',
        issuedRowBadgeText: '#34d399',
        issueBtnBg: '#064e3b',
        issueBtnBorder: '#10b981',
        issueBtnText: '#6ee7b7',
        viewInventoryBtnBg: '#161924',
        viewInventoryBtnBorder: '#10b981',
        viewInventoryBtnText: '#34d399',
        footerBg: '#161924',
        footerBorder: '#1f2430',
        activeFilterBg: '#0284c7',
        activeFilterText: '#ffffff'
      }
    }
    return {
      bg: '#f8fafc',
      navBg: '#ffffff',
      navBorder: '#e2e8f0',
      cardBg: '#ffffff',
      cardHeaderBg: '#f8fafc',
      cardBorder: '#cbd5e1',
      subtleBg: '#f1f5f9',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      textMuted: '#94a3b8',
      inputBg: '#ffffff',
      inputBorder: '#cbd5e1',
      inputText: '#0f172a',
      tableHeadBg: '#f1f5f9',
      tableBorder: '#e2e8f0',
      tableRowHover: '#f8fafc',
      tableRowBorder: '#f1f5f9',
      buttonSecondaryBg: '#ffffff',
      buttonSecondaryBorder: '#cbd5e1',
      buttonSecondaryText: '#475569',
      kpiBoxBg: '#ffffff',
      kpiBoxBorder: '#e2e8f0',
      kpiBlueIconBg: '#f0f9ff',
      kpiBlueIconBorder: '#bae6fd',
      kpiAmberIconBg: '#fffbeb',
      kpiAmberIconBorder: '#fde68a',
      kpiGreenIconBg: '#ecfdf5',
      kpiGreenIconBorder: '#a7f3d0',
      queueTabsBg: '#ffffff',
      queueTabsBorder: '#e2e8f0',
      orderBadgeBg: '#eff6ff',
      orderBadgeBorder: '#bfdbfe',
      orderBadgeText: '#1d4ed8',
      customerBadgeBg: '#ffffff',
      customerBadgeBorder: '#cbd5e1',
      customerBadgeText: '#1e293b',
      readyBadgeBg: '#ecfdf5',
      readyBadgeBorder: '#a7f3d0',
      readyBadgeText: '#047857',
      shortageBadgeBg: '#fffbeb',
      shortageBadgeBorder: '#fde68a',
      shortageBadgeText: '#b45309',
      issuedRowBadgeBg: '#ecfdf5',
      issuedRowBadgeBorder: '#a7f3d0',
      issuedRowBadgeText: '#059669',
      issueBtnBg: '#ecfdf5',
      issueBtnBorder: '#10b981',
      issueBtnText: '#047857',
      viewInventoryBtnBg: '#ffffff',
      viewInventoryBtnBorder: '#10b981',
      viewInventoryBtnText: '#065f46',
      footerBg: '#f8fafc',
      footerBorder: '#e2e8f0',
      activeFilterBg: '#0284c7',
      activeFilterText: '#ffffff'
    }
  }, [isDark])

  return { isDark, t }
}
