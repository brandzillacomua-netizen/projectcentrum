import { useState } from 'react'
import { getNpApiKey, saveNpApiKey, testNpApiKey } from '../../../../services/novaPoshtaService'

export function useSettingsSystemAdmin({
  fortnetUrl,
  updateFortnetUrl: _updateFortnetUrl,
  maintenanceCheckEnabled: _maintenanceCheckEnabled,
  updateMaintenanceCheckEnabled: _updateMaintenanceCheckEnabled
}) {
  // Tabs: users, structure, system, corrections
  const [activeTab, setActiveTab] = useState('users') 
  const [tempFortnetUrl, setTempFortnetUrl] = useState(fortnetUrl)

  // Nova Poshta API Key state
  const [npApiKeyInput, setNpApiKeyInput] = useState(() => getNpApiKey())
  const [npTestResult, setNpTestResult] = useState(null)
  const [npTesting, setNpTesting] = useState(false)

  const handleTestAndSaveNpKey = async () => {
    setNpTesting(true)
    setNpTestResult(null)
    try {
      const keyToTest = npApiKeyInput.trim()
      const res = await testNpApiKey(keyToTest)
      if (res.success) {
        saveNpApiKey(keyToTest)
        setNpTestResult({
          success: true,
          message: `✅ Успішно! Знайдено відправника: «${res.senderName}»`
        })
      } else {
        setNpTestResult({
          success: false,
          message: `❌ Помилка ключа API НП: ${res.message}`
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
