import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../../../supabase'

const qrFromNomenclature = nomenclature => {
  const match = String(nomenclature?.additional_info || '').match(/\[QR:\s*([^\]]+)\]/i)
  return match ? match[1].trim() : ''
}

const normalizeCode = value => {
  let code = String(value || '').trim()
  try {
    code = decodeURIComponent(code)
  } catch {
    // Scanner values are not required to be URI encoded.
  }
  return code
}

export function useManualInventoryIssue({
  nomenclatures,
  inventory,
  currentUser,
  sourceModule,
  refreshTable
}) {
  const [selectedNomenclature, setSelectedNomenclature] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [journalRows, setJournalRows] = useState([])
  const [journalLoading, setJournalLoading] = useState(false)

  const qrIndex = useMemo(() => {
    const index = new Map()
    const addKey = (key, nom) => {
      if (!key) return
      const k = String(key).trim().toLocaleLowerCase('uk-UA')
      if (k) index.set(k, nom)
    }

    ;(nomenclatures || []).forEach(nomenclature => {
      // 1. [QR: ...] in additional_info
      const qrFromInfo = qrFromNomenclature(nomenclature)
      if (qrFromInfo) addKey(qrFromInfo, nomenclature)

      // 2. qr_code field
      if (nomenclature.qr_code) addKey(nomenclature.qr_code, nomenclature)

      // 3. code & nomenclature_code (e.g. V2-SHT-012)
      if (nomenclature.code) addKey(nomenclature.code, nomenclature)
      if (nomenclature.nomenclature_code) addKey(nomenclature.nomenclature_code, nomenclature)

      // 4. barcode
      if (nomenclature.barcode) addKey(nomenclature.barcode, nomenclature)

      // 5. id and legacy_ids
      if (nomenclature.id) addKey(nomenclature.id, nomenclature)
      if (Array.isArray(nomenclature.legacy_ids)) {
        nomenclature.legacy_ids.forEach(lid => addKey(lid, nomenclature))
      }

      // 6. Canonical & clean names
      if (nomenclature.name) {
        addKey(nomenclature.name, nomenclature)
        const clean = nomenclature.name.replace(/\s*\[Підготовлений\]\s*/gi, '').trim()
        if (clean !== nomenclature.name) addKey(clean, nomenclature)
      }
    })
    return index
  }, [nomenclatures])

  const available = useMemo(() => {
    if (!selectedNomenclature) return 0
    const nomIds = new Set([
      String(selectedNomenclature.id),
      ...(selectedNomenclature.legacy_ids || []).map(String)
    ])
    return (inventory || [])
      .filter(item =>
        (nomIds.has(String(item.nomenclature_id)) || (item.name && selectedNomenclature.name && item.name.toLowerCase().includes(selectedNomenclature.name.toLowerCase()))) &&
        (item.warehouse === 'operational' || !item.warehouse)
      )
      .reduce((sum, item) => sum + Math.max(
        (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0),
        0
      ), 0)
  }, [inventory, selectedNomenclature])

  const handleScannedCode = useCallback(rawValue => {
    let code = normalizeCode(rawValue)
    if (!code) return false

    try {
      if (code.includes('http://') || code.includes('https://')) {
        const url = new URL(code)
        const param = url.searchParams.get('qr') || url.searchParams.get('code') || url.searchParams.get('id')
        if (param) code = param
      }
    } catch {}

    const cleanLower = code.trim().toLocaleLowerCase('uk-UA')
    let nomenclature = qrIndex.get(cleanLower)

    if (!nomenclature) {
      // Strip potential prefixes
      const stripped = cleanLower
        .replace(/^\[qr:\s*/i, '').replace(/\]$/, '')
        .replace(/^qr[:\s_-]*/i, '')
        .replace(/^nom[:\s_-]*/i, '')
      nomenclature = qrIndex.get(stripped)
    }

    if (!nomenclature) return false

    setSelectedNomenclature(nomenclature)
    setQuantity('')
    setError('')
    setSuccess(null)
    return true
  }, [qrIndex])

  const openIssue = useCallback(nomenclature => {
    if (!nomenclature) return
    setSelectedNomenclature(nomenclature)
    setQuantity('')
    setError('')
    setSuccess(null)
  }, [])

  const closeIssue = useCallback(() => {
    if (isSubmitting) return
    setSelectedNomenclature(null)
    setQuantity('')
    setError('')
    setSuccess(null)
  }, [isSubmitting])

  const submitIssue = useCallback(async event => {
    event?.preventDefault()
    const issueQuantity = Number(String(quantity).replace(',', '.'))
    if (!selectedNomenclature || !Number.isFinite(issueQuantity) || issueQuantity <= 0) {
      setError('Введіть коректну кількість для видачі.')
      return
    }
    if (!currentUser?.id) {
      setError('Не вдалося визначити користувача. Увійдіть у систему повторно.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const issuedByName = [currentUser.first_name, currentUser.last_name]
        .filter(Boolean)
        .join(' ') || currentUser.name || currentUser.email || `Користувач #${currentUser.id}`

      // Identify the exact matching inventory row on operational warehouse
      const nomIds = new Set([
        String(selectedNomenclature.id),
        ...(selectedNomenclature.legacy_ids || []).map(String)
      ])
      const matchingInv = (inventory || []).find(item =>
        (item.warehouse === 'operational' || !item.warehouse) &&
        nomIds.has(String(item.nomenclature_id)) &&
        (Number(item.total_qty) || 0) > (Number(item.reserved_qty) || 0)
      ) || (inventory || []).find(item =>
        (item.warehouse === 'operational' || !item.warehouse) &&
        nomIds.has(String(item.nomenclature_id))
      )

      const targetNomId = matchingInv?.nomenclature_id || selectedNomenclature.id

      const { data, error: rpcError } = await supabase.rpc('issue_operational_inventory_manually', {
        p_nomenclature_id: targetNomId,
        p_quantity: issueQuantity,
        p_issued_by_id: Number(currentUser.id),
        p_issued_by_name: issuedByName,
        p_source_module: sourceModule
      })
      if (rpcError) throw rpcError

      setSuccess(Array.isArray(data) ? data[0] : data)
      setQuantity('')
      if (typeof refreshTable === 'function') await refreshTable('inventory')
    } catch (submitError) {
      setError(submitError?.message || 'Не вдалося виконати ручну видачу.')
    } finally {
      setIsSubmitting(false)
    }
  }, [currentUser, inventory, quantity, refreshTable, selectedNomenclature, sourceModule])

  const openJournal = useCallback(async () => {
    setJournalOpen(true)
    setJournalLoading(true)
    setError('')
    try {
      const { data, error: journalError } = await supabase.rpc('manual_inventory_issue_journal', {
        p_limit: 200
      })
      if (journalError) throw journalError
      setJournalRows(data || [])
    } catch (loadError) {
      setError(loadError?.message || 'Не вдалося завантажити журнал.')
    } finally {
      setJournalLoading(false)
    }
  }, [])

  return {
    selectedNomenclature,
    quantity,
    setQuantity,
    available,
    isSubmitting,
    error,
    success,
    journalOpen,
    journalRows,
    journalLoading,
    handleScannedCode,
    openIssue,
    closeIssue,
    submitIssue,
    openJournal,
    closeJournal: () => setJournalOpen(false)
  }
}
