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
    ;(nomenclatures || []).forEach(nomenclature => {
      const qr = qrFromNomenclature(nomenclature)
      if (qr) index.set(qr.toLocaleLowerCase('uk-UA'), nomenclature)
    })
    return index
  }, [nomenclatures])

  const available = useMemo(() => {
    if (!selectedNomenclature) return 0
    return (inventory || [])
      .filter(item =>
        String(item.nomenclature_id) === String(selectedNomenclature.id) &&
        (item.warehouse === 'operational' || !item.warehouse)
      )
      .reduce((sum, item) => sum + Math.max(
        (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0),
        0
      ), 0)
  }, [inventory, selectedNomenclature])

  const handleScannedCode = useCallback(rawValue => {
    const code = normalizeCode(rawValue)
    const nomenclature = qrIndex.get(code.toLocaleLowerCase('uk-UA'))
    if (!nomenclature) return false

    setSelectedNomenclature(nomenclature)
    setQuantity('')
    setError('')
    setSuccess(null)
    return true
  }, [qrIndex])

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
      const { data, error: rpcError } = await supabase.rpc('issue_operational_inventory_manually', {
        p_nomenclature_id: selectedNomenclature.id,
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
  }, [currentUser, quantity, refreshTable, selectedNomenclature, sourceModule])

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
    closeIssue,
    submitIssue,
    openJournal,
    closeJournal: () => setJournalOpen(false)
  }
}
