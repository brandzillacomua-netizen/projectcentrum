import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'
import { NomenclatureCardModal } from '../../Nomenclature/components/NomenclatureCardModal'
import { DEFAULT_ERP_GROUPS } from '../../Nomenclature/utils/nomenclatureHelpers'

export function WarehouseNomenclatureLink({ item }) {
  const { nomenclatures = [], refreshTable } = useMES()
  const [card, setCard] = useState(null)
  const [groups, setGroups] = useState(DEFAULT_ERP_GROUPS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const label = item.displayName || item.name
  const linkedNom = item.nomenclature_id && nomenclatures.find(n =>
    String(n.id) === String(item.nomenclature_id) ||
    (n.legacy_ids || []).some(id => String(id) === String(item.nomenclature_id))
  )

  const openCard = async () => {
    setLoading(true)
    setError('')
    try {
      const [nomResult, groupResult] = await Promise.all([
        supabase.from('nomenclatures_v2').select('*').eq('id', linkedNom?.id || item.nomenclature_id).maybeSingle(),
        supabase.from('nomenclature_catalog_groups').select('*')
      ])
      if (nomResult.error) throw nomResult.error
      if (!nomResult.data) {
        setError('Для цієї позиції ще немає картки в номенклатурі 2.0.')
        return
      }
      if (!groupResult.error && groupResult.data?.length) {
        setGroups([...new Map([...DEFAULT_ERP_GROUPS, ...groupResult.data].map(group => [group.id, group])).values()])
      }
      setCard(nomResult.data)
    } catch {
      setError('Не вдалося відкрити картку. Спробуйте ще раз.')
    } finally {
      setLoading(false)
    }
  }

  if (!item.nomenclature_id) return <span title="Позиція ще не пов’язана з номенклатурою">{label}</span>

  return (
    <>
      <button
        type="button"
        onClick={openCard}
        disabled={loading}
        title="Відкрити картку номенклатури"
        aria-label={`Відкрити картку номенклатури: ${label}`}
        aria-busy={loading}
        style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: loading ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' }}>{label}</span>
        <ExternalLink size={12} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.6 }} />
      </button>
      {error && <span role="alert" style={{ display: 'block', fontSize: '0.75rem', color: '#ef4444' }}>{error}</span>}
      {card && createPortal(<NomenclatureCardModal
        isOpen
        item={card}
        groups={groups}
        itemsMap={new Map(nomenclatures.map(n => [n.id, n]))}
        onClose={() => setCard(null)}
        onItemUpdated={updated => {
          setCard(previous => ({ ...previous, ...updated }))
          refreshTable?.('nomenclatures')
        }}
      />, document.body)}
    </>
  )
}
