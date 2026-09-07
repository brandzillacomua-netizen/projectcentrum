import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMES } from '../../../MESContext.jsx'

export const DEFAULT_STAGES = [
  { id: 'lead', title: 'Новий запит (Лід)', color: '#6366f1', sort_order: 10, isSystem: true },
  { id: 'tech_spec', title: 'Технічна специфікація', color: '#8b5cf6', sort_order: 20, isSystem: true },
  { id: 'quote', title: 'КП / Рахунок виставлено', color: '#f59e0b', sort_order: 30, isSystem: true },
  { id: 'agreed', title: 'Підтверджено (Оплата)', color: '#10b981', sort_order: 40, isSystem: true },
  { id: 'in_production', title: 'Передано в MES', color: '#ff9000', sort_order: 50, isSystem: true }
]

const STORAGE_KEYS = {
  STAGES: 'centrum_crm_stages',
  LEADS: 'centrum_crm_leads',
  CREATED_LEADS: 'centrum_created_crm_leads',
  LEAD_UPDATES: 'centrum_crm_lead_updates',
  DELETED_LEADS: 'centrum_deleted_crm_leads'
}

const getManagerDisplayName = (u) => {
  if (!u) return 'Менеджер'
  if (u.first_name || u.last_name) {
    return [u.first_name, u.last_name].filter(Boolean).join(' ')
  }
  return u.name || u.login || 'Менеджер'
}

const mergeLeadsWithLocalQueues = (dbLeads = []) => {
  let createdLeads = []
  let leadUpdates = {}
  let deletedLeadIds = new Set()

  try {
    createdLeads = JSON.parse(localStorage.getItem(STORAGE_KEYS.CREATED_LEADS) || '[]')
  } catch (e) {}

  try {
    leadUpdates = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAD_UPDATES) || '{}')
  } catch (e) {}

  try {
    deletedLeadIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_LEADS) || '[]'))
  } catch (e) {}

  const map = new Map()

  // 1. Process DB leads (applying any pending local updates)
  if (Array.isArray(dbLeads)) {
    dbLeads.forEach(lead => {
      const idStr = String(lead.id)
      if (!deletedLeadIds.has(idStr)) {
        const withUpdates = leadUpdates[idStr] ? { ...lead, ...leadUpdates[idStr] } : lead
        map.set(idStr, withUpdates)
      }
    })
  }

  // 2. Process locally created leads (ensuring no created card is wiped while syncing)
  if (Array.isArray(createdLeads)) {
    createdLeads.forEach(localLead => {
      const idStr = String(localLead.id)
      if (deletedLeadIds.has(idStr)) return

      // Find if already present in map by ID or exact title & client
      let matchingKey = null
      for (const [existingId, existingLead] of map.entries()) {
        if (existingId === idStr) {
          matchingKey = existingId
          break
        }
        if (
          existingLead.title?.trim() === localLead.title?.trim() &&
          existingLead.clientName?.trim() === localLead.clientName?.trim()
        ) {
          matchingKey = existingId
          break
        }
      }

      if (matchingKey) {
        if (leadUpdates[idStr]) {
          const current = map.get(matchingKey)
          map.set(matchingKey, { ...current, ...leadUpdates[idStr] })
        }
      } else {
        const withUpdates = leadUpdates[idStr] ? { ...localLead, ...leadUpdates[idStr] } : localLead
        map.set(idStr, withUpdates)
      }
    })
  }

  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

export const useCrmData = () => {
  const { currentUser, supabase } = useMES()
  const navigate = useNavigate()

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStageFilter, setSelectedStageFilter] = useState('all')

  // Dynamic Pipeline Stages State
  const [stages, setStages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STAGES)
      return saved ? JSON.parse(saved) : DEFAULT_STAGES
    } catch (e) {
      return DEFAULT_STAGES
    }
  })

  // Resilient CRM Leads State with Instant Recovery from Cache & Created Queues
  const [leads, setLeads] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEADS)
      const initialSaved = saved ? JSON.parse(saved) : []
      return mergeLeadsWithLocalQueues(initialSaved)
    } catch (e) {
      return []
    }
  })

  // Ref to prevent duplicate loads
  const inFlightFetchRef = useRef(false)

  // Safe load & sync from Supabase
  const loadFromSupabase = useCallback(async () => {
    if (!supabase || inFlightFetchRef.current) return
    inFlightFetchRef.current = true

    try {
      // 1. Fetch Stages
      const { data: stagesData, error: sErr } = await supabase
        .from('crm_pipeline_stages')
        .select('*')
        .order('sort_order', { ascending: true })

      if (!sErr && Array.isArray(stagesData) && stagesData.length > 0) {
        setStages(stagesData)
        try {
          localStorage.setItem(STORAGE_KEYS.STAGES, JSON.stringify(stagesData))
        } catch (e) {}
      }

      // 2. Fetch Leads
      const { data: leadsData, error: lErr } = await supabase
        .from('crm_leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (!lErr && Array.isArray(leadsData)) {
        const formatted = leadsData.map(l => ({
          id: String(l.id),
          title: l.title,
          clientName: l.client_name,
          phone: l.contact_phone || '',
          email: l.contact_email || '',
          productInterest: l.product_interest || '',
          quantity: l.quantity || 1,
          amount: Number(l.estimated_amount) || 0,
          stageId: l.stage_id || 'lead',
          notes: l.notes || '',
          managerName: l.manager_name || 'Менеджер',
          createdAt: l.created_at
        }))

        const merged = mergeLeadsWithLocalQueues(formatted)
        setLeads(merged)
        try {
          localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(merged))
        } catch (e) {}

        // Background sync: check if any local created leads need insertion to Supabase
        try {
          const created = JSON.parse(localStorage.getItem(STORAGE_KEYS.CREATED_LEADS) || '[]')
          if (Array.isArray(created) && created.length > 0) {
            const remainingToSync = []
            for (const cl of created) {
              const isTemp = String(cl.id).startsWith('lead-')
              if (!isTemp) {
                // If it already has a DB numeric ID and is in formatted, no need to keep in created
                if (formatted.some(f => f.id === String(cl.id))) continue
              } else {
                // If temp ID, check if already in DB under a new ID
                const alreadyInDb = formatted.some(f => f.title === cl.title && f.clientName === cl.clientName)
                if (alreadyInDb) continue
              }
              remainingToSync.push(cl)
            }
            localStorage.setItem(STORAGE_KEYS.CREATED_LEADS, JSON.stringify(remainingToSync))

            // Sync pending temp leads
            for (const pending of remainingToSync) {
              if (String(pending.id).startsWith('lead-')) {
                const { data: insData, error: insErr } = await supabase.from('crm_leads').insert([{
                  title: pending.title,
                  client_name: pending.clientName,
                  contact_phone: pending.phone || null,
                  contact_email: pending.email || null,
                  product_interest: pending.productInterest || null,
                  quantity: pending.quantity || 1,
                  estimated_amount: pending.amount || 0,
                  stage_id: pending.stageId || 'lead',
                  notes: pending.notes || null,
                  manager_name: pending.managerName || null
                }]).select()

                if (!insErr && insData && insData[0]) {
                  const realId = String(insData[0].id)
                  setLeads(prev => prev.map(l => l.id === pending.id ? { ...l, id: realId } : l))

                  const cr = JSON.parse(localStorage.getItem(STORAGE_KEYS.CREATED_LEADS) || '[]')
                  localStorage.setItem(STORAGE_KEYS.CREATED_LEADS, JSON.stringify(cr.filter(c => c.id !== pending.id)))

                  const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || '[]')
                  localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(all.map(l => l.id === pending.id ? { ...l, id: realId } : l)))
                }
              }
            }
          }
        } catch (syncErr) {
          console.warn('[CRM] Sync pending created leads error:', syncErr)
        }
      }
    } catch (e) {
      console.error('[CRM] loadFromSupabase error:', e)
    } finally {
      inFlightFetchRef.current = false
    }
  }, [supabase])

  // Initial load
  useEffect(() => {
    loadFromSupabase()
  }, [loadFromSupabase])

  // Window Focus / Tab Visibility Safe Refresh
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadFromSupabase()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [loadFromSupabase])

  // Realtime Synchronization
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('crm_realtime_board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_leads' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newRow = payload.new
            const mapped = {
              id: String(newRow.id),
              title: newRow.title,
              clientName: newRow.client_name,
              phone: newRow.contact_phone || '',
              email: newRow.contact_email || '',
              productInterest: newRow.product_interest || '',
              quantity: newRow.quantity || 1,
              amount: Number(newRow.estimated_amount) || 0,
              stageId: newRow.stage_id || 'lead',
              notes: newRow.notes || '',
              managerName: newRow.manager_name || 'Менеджер',
              createdAt: newRow.created_at
            }
            setLeads(prev => {
              if (prev.some(l => String(l.id) === mapped.id)) return prev
              const filtered = prev.filter(l => !(String(l.id).startsWith('lead-') && l.title === mapped.title && l.clientName === mapped.clientName))
              const next = [mapped, ...filtered]
              try {
                localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(next))
              } catch (e) {}
              return next
            })
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedRow = payload.new
            setLeads(prev => {
              const next = prev.map(l => {
                if (String(l.id) !== String(updatedRow.id)) return l
                return {
                  ...l,
                  title: updatedRow.title,
                  clientName: updatedRow.client_name,
                  phone: updatedRow.contact_phone || '',
                  email: updatedRow.contact_email || '',
                  productInterest: updatedRow.product_interest || '',
                  quantity: updatedRow.quantity || 1,
                  amount: Number(updatedRow.estimated_amount) || 0,
                  stageId: updatedRow.stage_id || 'lead',
                  notes: updatedRow.notes || '',
                  managerName: updatedRow.manager_name || l.managerName,
                  createdAt: updatedRow.created_at
                }
              })
              try {
                localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(next))
              } catch (e) {}
              return next
            })
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const delId = String(payload.old.id)
            setLeads(prev => {
              const next = prev.filter(l => String(l.id) !== delId)
              try {
                localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(next))
              } catch (e) {}
              return next
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_pipeline_stages' },
        () => {
          loadFromSupabase()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadFromSupabase])

  // Modals state
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [isAddStageOpen, setIsAddStageOpen] = useState(false)
  const [editingStage, setEditingStage] = useState(null)

  // New Lead Form State
  const [leadForm, setLeadForm] = useState({
    title: '',
    clientName: '',
    phone: '',
    email: '',
    productInterest: '',
    quantity: 1,
    amount: '',
    stageId: 'lead',
    notes: ''
  })

  // Stage Form State
  const [stageForm, setStageForm] = useState({
    title: '',
    color: '#6366f1'
  })

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const q = searchQuery.toLowerCase().trim()
      const matchesQuery = !q ||
        (l.title || '').toLowerCase().includes(q) ||
        (l.clientName || '').toLowerCase().includes(q) ||
        (l.productInterest || '').toLowerCase().includes(q)
      const matchesStage = selectedStageFilter === 'all' || l.stageId === selectedStageFilter
      return matchesQuery && matchesStage
    })
  }, [leads, searchQuery, selectedStageFilter])

  // Total Pipeline Value
  const totalPipelineValue = useMemo(() => {
    return leads.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
  }, [leads])

  // Handle Lead Stage Change (Move Left / Right or Select)
  const handleMoveLeadStage = async (leadId, targetStageId) => {
    const idStr = String(leadId)
    setLeads(prev => prev.map(l => String(l.id) === idStr ? { ...l, stageId: targetStageId } : l))

    // Persist immediately to queues
    try {
      const updates = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAD_UPDATES) || '{}')
      updates[idStr] = { ...(updates[idStr] || {}), stageId: targetStageId }
      localStorage.setItem(STORAGE_KEYS.LEAD_UPDATES, JSON.stringify(updates))

      const created = JSON.parse(localStorage.getItem(STORAGE_KEYS.CREATED_LEADS) || '[]')
      localStorage.setItem(STORAGE_KEYS.CREATED_LEADS, JSON.stringify(created.map(l => String(l.id) === idStr ? { ...l, stageId: targetStageId } : l)))

      const allSaved = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || '[]')
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(allSaved.map(l => String(l.id) === idStr ? { ...l, stageId: targetStageId } : l)))
    } catch (e) {}

    if (supabase && !idStr.startsWith('lead-')) {
      try {
        await supabase.from('crm_leads').update({ stage_id: targetStageId, updated_at: new Date().toISOString() }).eq('id', leadId)
      } catch (e) {
        console.error('[CRM] Failed to update lead stage in Supabase:', e)
      }
    }
  }

  // Create or Update Lead
  const handleSaveLead = async (e) => {
    e.preventDefault()
    if (!leadForm.title.trim() || !leadForm.clientName.trim()) {
      alert('Будь ласка, вкажіть тему запиту та ім’я/компанію замовника!')
      return
    }

    const payload = {
      title: leadForm.title.trim(),
      clientName: leadForm.clientName.trim(),
      phone: leadForm.phone.trim(),
      email: leadForm.email.trim(),
      productInterest: leadForm.productInterest.trim(),
      quantity: Number(leadForm.quantity) || 1,
      amount: Number(leadForm.amount) || 0,
      stageId: leadForm.stageId || 'lead',
      notes: leadForm.notes.trim(),
      managerName: getManagerDisplayName(currentUser)
    }

    if (editingLead) {
      const idStr = String(editingLead.id)
      setLeads(prev => prev.map(l => String(l.id) === idStr ? { ...l, ...payload } : l))

      try {
        const created = JSON.parse(localStorage.getItem(STORAGE_KEYS.CREATED_LEADS) || '[]')
        localStorage.setItem(STORAGE_KEYS.CREATED_LEADS, JSON.stringify(created.map(l => String(l.id) === idStr ? { ...l, ...payload } : l)))

        const updates = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAD_UPDATES) || '{}')
        updates[idStr] = { ...(updates[idStr] || {}), ...payload }
        localStorage.setItem(STORAGE_KEYS.LEAD_UPDATES, JSON.stringify(updates))

        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || '[]')
        localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(all.map(l => String(l.id) === idStr ? { ...l, ...payload } : l)))
      } catch (e) {}

      if (supabase && !idStr.startsWith('lead-')) {
        try {
          await supabase.from('crm_leads').update({
            title: payload.title,
            client_name: payload.clientName,
            contact_phone: payload.phone,
            contact_email: payload.email,
            product_interest: payload.productInterest,
            quantity: payload.quantity,
            estimated_amount: payload.amount,
            stage_id: payload.stageId,
            notes: payload.notes,
            updated_at: new Date().toISOString()
          }).eq('id', editingLead.id)
        } catch (e) {
          console.error('[CRM] Failed to update lead in Supabase:', e)
        }
      }
    } else {
      const tempId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const newLead = {
        id: tempId,
        ...payload,
        createdAt: new Date().toISOString()
      }

      // 1. Immediately update React state
      setLeads(prev => [newLead, ...prev])

      // 2. Immediately & synchronously write to local storage (survives tab switches and refreshes)
      try {
        const created = JSON.parse(localStorage.getItem(STORAGE_KEYS.CREATED_LEADS) || '[]')
        localStorage.setItem(STORAGE_KEYS.CREATED_LEADS, JSON.stringify([newLead, ...created.filter(l => l.id !== tempId)]))

        const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || '[]')
        localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify([newLead, ...all.filter(l => l.id !== tempId)]))
      } catch (e) {}

      // 3. Initiate background sync to Supabase
      if (supabase) {
        supabase.from('crm_leads').insert([{
          title: payload.title,
          client_name: payload.clientName,
          contact_phone: payload.phone || null,
          contact_email: payload.email || null,
          product_interest: payload.productInterest || null,
          quantity: payload.quantity || 1,
          estimated_amount: payload.amount || 0,
          stage_id: payload.stageId || 'lead',
          notes: payload.notes || null,
          manager_name: payload.managerName || null
        }]).select().then(({ data, error }) => {
          if (!error && data && data[0]) {
            const realId = String(data[0].id)
            setLeads(prev => prev.map(l => l.id === tempId ? { ...l, id: realId } : l))

            try {
              const created = JSON.parse(localStorage.getItem(STORAGE_KEYS.CREATED_LEADS) || '[]')
              const updatedCreated = created.map(l => l.id === tempId ? { ...l, id: realId } : l)
              localStorage.setItem(STORAGE_KEYS.CREATED_LEADS, JSON.stringify(updatedCreated))

              const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || '[]')
              const updatedAll = all.map(l => l.id === tempId ? { ...l, id: realId } : l)
              localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(updatedAll))
            } catch (e) {}
          }
        }).catch(err => {
          console.error('[CRM] Supabase insert error (preserved in resilient local queue):', err)
        })
      }
    }

    setIsAddLeadOpen(false)
    setEditingLead(null)
    setLeadForm({ title: '', clientName: '', phone: '', email: '', productInterest: '', quantity: 1, amount: '', stageId: 'lead', notes: '' })
  }

  // Delete Lead
  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Видалити цей лід з воронки?')) return
    const idStr = String(leadId)
    setLeads(prev => prev.filter(l => String(l.id) !== idStr))

    try {
      const deleted = JSON.parse(localStorage.getItem(STORAGE_KEYS.DELETED_LEADS) || '[]')
      if (!deleted.includes(idStr)) {
        localStorage.setItem(STORAGE_KEYS.DELETED_LEADS, JSON.stringify([...deleted, idStr]))
      }

      const created = JSON.parse(localStorage.getItem(STORAGE_KEYS.CREATED_LEADS) || '[]')
      localStorage.setItem(STORAGE_KEYS.CREATED_LEADS, JSON.stringify(created.filter(l => String(l.id) !== idStr)))

      const updates = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAD_UPDATES) || '{}')
      delete updates[idStr]
      localStorage.setItem(STORAGE_KEYS.LEAD_UPDATES, JSON.stringify(updates))

      const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADS) || '[]')
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(all.filter(l => String(l.id) !== idStr)))
    } catch (e) {}

    if (supabase && !idStr.startsWith('lead-')) {
      try {
        await supabase.from('crm_leads').delete().eq('id', leadId)
      } catch (e) {
        console.error('[CRM] Failed to delete lead from Supabase:', e)
      }
    }
  }

  // Reorder Column (Move Left or Right)
  const handleMoveColumn = async (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= stages.length) return
    const updated = [...stages]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp

    const reordered = updated.map((st, idx) => ({ ...st, sort_order: (idx + 1) * 10 }))
    setStages(reordered)
    try {
      localStorage.setItem(STORAGE_KEYS.STAGES, JSON.stringify(reordered))
    } catch (e) {}

    if (supabase) {
      try {
        for (const st of reordered) {
          await supabase.from('crm_pipeline_stages').upsert({
            id: st.id,
            title: st.title,
            color: st.color,
            sort_order: st.sort_order,
            is_system: st.isSystem || false
          })
        }
      } catch (e) {}
    }
  }

  // Add / Edit Stage Column
  const handleSaveStage = async (e) => {
    e.preventDefault()
    if (!stageForm.title.trim()) {
      alert('Будь ласка, введіть назву етапу!')
      return
    }

    if (editingStage) {
      const updated = stages.map(s => s.id === editingStage.id ? { ...s, title: stageForm.title.trim(), color: stageForm.color } : s)
      setStages(updated)
      try {
        localStorage.setItem(STORAGE_KEYS.STAGES, JSON.stringify(updated))
      } catch (e) {}

      if (supabase) {
        try {
          await supabase.from('crm_pipeline_stages').update({ title: stageForm.title.trim(), color: stageForm.color }).eq('id', editingStage.id)
        } catch (e) {}
      }
    } else {
      const newId = `stage_${Date.now()}`
      const newStage = {
        id: newId,
        title: stageForm.title.trim(),
        color: stageForm.color,
        sort_order: (stages.length + 1) * 10,
        isSystem: false
      }
      const updated = [...stages, newStage]
      setStages(updated)
      try {
        localStorage.setItem(STORAGE_KEYS.STAGES, JSON.stringify(updated))
      } catch (e) {}

      if (supabase) {
        try {
          await supabase.from('crm_pipeline_stages').insert([{
            id: newStage.id,
            title: newStage.title,
            color: newStage.color,
            sort_order: newStage.sort_order,
            is_system: false
          }])
        } catch (e) {}
      }
    }

    setIsAddStageOpen(false)
    setEditingStage(null)
    setStageForm({ title: '', color: '#6366f1' })
  }

  // Delete Custom Stage
  const handleDeleteStage = async (stageId) => {
    const targetStage = stages.find(s => s.id === stageId)
    if (targetStage?.isSystem) {
      alert('Системні етапи воронки не можна видаляти!')
      return
    }
    if (!window.confirm(`Видалити етап «${targetStage?.title}»? Запити з цього етапу будуть перенесені в «Новий запит (Лід)».`)) return

    const updatedLeads = leads.map(l => l.stageId === stageId ? { ...l, stageId: 'lead' } : l)
    const updatedStages = stages.filter(s => s.id !== stageId)

    setLeads(updatedLeads)
    setStages(updatedStages)

    try {
      localStorage.setItem(STORAGE_KEYS.STAGES, JSON.stringify(updatedStages))
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(updatedLeads))
    } catch (e) {}

    if (supabase) {
      try {
        await supabase.from('crm_leads').update({ stage_id: 'lead' }).eq('stage_id', stageId)
        await supabase.from('crm_pipeline_stages').delete().eq('id', stageId)
      } catch (e) {}
    }
  }

  const openLeadModalForCreate = () => {
    setLeadForm({ title: '', clientName: '', phone: '', email: '', productInterest: '', quantity: 1, amount: '', stageId: 'lead', notes: '' })
    setEditingLead(null)
    setIsAddLeadOpen(true)
  }

  const openLeadModalForEdit = (lead) => {
    setEditingLead(lead)
    setLeadForm({
      title: lead.title,
      clientName: lead.clientName,
      phone: lead.phone,
      email: lead.email,
      productInterest: lead.productInterest,
      quantity: lead.quantity,
      amount: lead.amount || '',
      stageId: lead.stageId,
      notes: lead.notes || ''
    })
    setIsAddLeadOpen(true)
  }

  const openStageModalForCreate = () => {
    setStageForm({ title: '', color: '#6366f1' })
    setEditingStage(null)
    setIsAddStageOpen(true)
  }

  const openStageModalForEdit = (stage) => {
    setEditingStage(stage)
    setStageForm({ title: stage.title, color: stage.color })
    setIsAddStageOpen(true)
  }

  return {
    currentUser,
    supabase,
    navigate,
    searchQuery,
    setSearchQuery,
    selectedStageFilter,
    setSelectedStageFilter,
    stages,
    setStages,
    leads,
    setLeads,
    isAddLeadOpen,
    setIsAddLeadOpen,
    editingLead,
    setEditingLead,
    isAddStageOpen,
    setIsAddStageOpen,
    editingStage,
    setEditingStage,
    leadForm,
    setLeadForm,
    stageForm,
    setStageForm,
    filteredLeads,
    totalPipelineValue,
    handleMoveLeadStage,
    handleSaveLead,
    handleDeleteLead,
    handleMoveColumn,
    handleSaveStage,
    handleDeleteStage,
    openLeadModalForCreate,
    openLeadModalForEdit,
    openStageModalForCreate,
    openStageModalForEdit
  }
}

export default useCrmData
