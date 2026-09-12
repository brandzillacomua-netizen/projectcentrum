import { useState } from 'react'
import { testNpApiKey } from '../../../../services/novaPoshtaService'

export function useSettingsSystemAdmin({
  fortnetUrl,
  updateFortnetUrl: _updateFortnetUrl,
  maintenanceCheckEnabled: _maintenanceCheckEnabled,
  updateMaintenanceCheckEnabled: _updateMaintenanceCheckEnabled
}) {
  // Tabs: users, structure, system, corrections
  const [activeTab, setActiveTab] = useState('users') 
  const [tempFortnetUrl, setTempFortnetUrl] = useState(fortnetUrl)

  // The credential is server-managed; this state is kept for component API compatibility.
  const [npApiKeyInput, setNpApiKeyInput] = useState('')
  const [npTestResult, setNpTestResult] = useState(null)
  const [npTesting, setNpTesting] = useState(false)

  const handleTestAndSaveNpKey = async () => {
    setNpTesting(true)
    setNpTestResult(null)
    try {
      const res = await testNpApiKey()
      if (res.success) {
        setNpTestResult({
          success: true,
          message: `✅ Успішно! Знайдено відправника: «${res.senderName}»`
        })
      } else {
        setNpTestResult({
          success: false,
          message: `❌ Серверна інтеграція НП недоступна: ${res.message}`
        })
      }
    } catch (err) {
      setNpTestResult({
        success: false,
        message: `❌ Помилка: ${err.message}`
      })
    } finally {
      setNpTesting(false)
    }
  }

  return {
    activeTab,
    setActiveTab,
    tempFortnetUrl,
    setTempFortnetUrl,
    npApiKeyInput,
    setNpApiKeyInput,
    npTestResult,
    setNpTestResult,
    npTesting,
    handleTestAndSaveNpKey
  }
}
