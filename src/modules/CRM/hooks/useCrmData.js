import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMES } from '../../../MESContext.jsx'

export const DEFAULT_STAGES = [
  { id: 'lead', title: 'Новий запит (Лід)', color: '#6366f1', sort_order: 10, isSystem: true },
  { id: 'tech_spec', title: 'Технічна специфікація', color: '#8b5cf6', sort_order: 20, isSystem: true },
  { id: 'quote', title: 'КП / Рахунок виставлено', color: '#f59e0b', sort_order: 30, isSystem: true },
  { id: 'agreed', title: 'Підтверджено (Оплата)', color: '#10b981', sort_order: 40, isSystem: true },
  { id: 'in_production', title: 'Передано в MES', color: '#ff9000', sort_order: 50, isSystem: true }
]

export const useCrmData = () => {
  const { currentUser, supabase } = useMES()
  const navigate = useNavigate()

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStageFilter, setSelectedStageFilter] = useState('all')

  // Dynamic Pipeline Stages State
  const [stages, setStages] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_crm_stages')
      return saved ? JSON.parse(saved) : DEFAULT_STAGES
    } catch (e) {
      return DEFAULT_STAGES
    }
  })

  // Pure CRM Leads State
  const [leads, setLeads] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_crm_leads')
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      return []
    }
  })

  // Sync Stages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('centrum_crm_stages', JSON.stringify(stages))
    } catch (e) {}
  }, [stages])

  // Sync Leads to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('centrum_crm_leads', JSON.stringify(leads))
    } catch (e) {}
  }, [leads])

  // Load from Supabase if table exists
  useEffect(() => {
    let isMounted = true
    const loadFromSupabase = async () => {
      if (!supabase) return
      try {
        const { data: stagesData, error: sErr } = await supabase.from('crm_pipeline_stages').select('*').order('sort_order', { ascending: true })
        if (!sErr && stagesData && stagesData.length > 0 && isMounted) {
          setStages(stagesData)
        }

        const { data: leadsData, error: lErr } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false })
        if (!lErr && leadsData && isMounted) {
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
          setLeads(formatted)
        }
      } catch (e) {}
    }
    loadFromSupabase()
    return () => { isMounted = false }
  }, [supabase])

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
    setLeads(prev => prev.map(l => String(l.id) === String(leadId) ? { ...l, stageId: targetStageId } : l))
    if (supabase) {
      try {
        await supabase.from('crm_leads').update({ stage_id: targetStageId, updated_at: new Date().toISOString() }).eq('id', leadId)
      } catch (e) {}
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
      stageId: leadForm.stageId,
      notes: leadForm.notes.trim(),
      managerName: currentUser?.name || 'Олександр Менеджер'
    }

    if (editingLead) {
      setLeads(prev => prev.map(l => String(l.id) === String(editingLead.id) ? { ...l, ...payload } : l))
      if (supabase) {
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
        } catch (e) {}
      }
    } else {
      const newLead = {
        id: `lead-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString()
      }
      setLeads(prev => [newLead, ...prev])

      if (supabase) {
        try {
          const { data } = await supabase.from('crm_leads').insert([{
            title: payload.title,
            client_name: payload.clientName,
            contact_phone: payload.phone,
            contact_email: payload.email,
            product_interest: payload.productInterest,
            quantity: payload.quantity,
            estimated_amount: payload.amount,
            stage_id: payload.stageId,
            notes: payload.notes,
            manager_name: payload.managerName
          }]).select()
          if (data && data[0]) {
            setLeads(prev => prev.map(l => l.id === newLead.id ? { ...l, id: String(data[0].id) } : l))
          }
        } catch (e) {}
      }
    }

    setIsAddLeadOpen(false)
    setEditingLead(null)
    setLeadForm({ title: '', clientName: '', phone: '', email: '', productInterest: '', quantity: 1, amount: '', stageId: 'lead', notes: '' })
  }

  // Delete Lead
  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Видалити цей лід з воронки?')) return
    setLeads(prev => prev.filter(l => String(l.id) !== String(leadId)))
    if (supabase) {
      try {
        await supabase.from('crm_leads').delete().eq('id', leadId)
      } catch (e) {}
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
      setStages(prev => prev.map(s => s.id === editingStage.id ? { ...s, title: stageForm.title.trim(), color: stageForm.color } : s))
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
      setStages(prev => [...prev, newStage])

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

    setLeads(prev => prev.map(l => l.stageId === stageId ? { ...l, stageId: 'lead' } : l))
    setStages(prev => prev.filter(s => s.id !== stageId))

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
