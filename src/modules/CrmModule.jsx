import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Briefcase, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  DollarSign, 
  MessageSquare, 
  TrendingUp,
  Settings,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Layers,
  ArrowRight,
  CheckCircle2,
  Package
} from 'lucide-react';
import { useMES } from '../MESContext';
import { useNavigate } from 'react-router-dom';

const DEFAULT_STAGES = [
  { id: 'lead', title: 'Новий запит (Лід)', color: '#6366f1', sort_order: 10, isSystem: true },
  { id: 'tech_spec', title: 'Технічна специфікація', color: '#8b5cf6', sort_order: 20, isSystem: true },
  { id: 'quote', title: 'КП / Рахунок виставлено', color: '#f59e0b', sort_order: 30, isSystem: true },
  { id: 'agreed', title: 'Підтверджено (Оплата)', color: '#10b981', sort_order: 40, isSystem: true },
  { id: 'in_production', title: 'Передано в MES', color: '#ff9000', sort_order: 50, isSystem: true }
];

export default function CrmModule() {
  const { currentUser, supabase } = useMES();
  const navigate = useNavigate();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('all');

  // Dynamic Pipeline Stages State
  const [stages, setStages] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_crm_stages');
      return saved ? JSON.parse(saved) : DEFAULT_STAGES;
    } catch (e) {
      return DEFAULT_STAGES;
    }
  });

  // Pure CRM Leads State
  const [leads, setLeads] = useState(() => {
    try {
      const saved = localStorage.getItem('centrum_crm_leads');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Sync Stages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('centrum_crm_stages', JSON.stringify(stages));
    } catch (e) {}
  }, [stages]);

  // Sync Leads to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('centrum_crm_leads', JSON.stringify(leads));
    } catch (e) {}
  }, [leads]);

  // Load from Supabase if table exists
  useEffect(() => {
    let isMounted = true;
    const loadFromSupabase = async () => {
      if (!supabase) return;
      try {
        const { data: stagesData, error: sErr } = await supabase.from('crm_pipeline_stages').select('*').order('sort_order', { ascending: true });
        if (!sErr && stagesData && stagesData.length > 0 && isMounted) {
          setStages(stagesData);
        }

        const { data: leadsData, error: lErr } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false });
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
          }));
          setLeads(formatted);
        }
      } catch (e) {}
    };
    loadFromSupabase();
    return () => { isMounted = false; };
  }, [supabase]);

  // Modals state
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);

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
  });

  // Stage Form State
  const [stageForm, setStageForm] = useState({
    title: '',
    color: '#6366f1'
  });

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        (l.title || '').toLowerCase().includes(q) ||
        (l.clientName || '').toLowerCase().includes(q) ||
        (l.productInterest || '').toLowerCase().includes(q);
      const matchesStage = selectedStageFilter === 'all' || l.stageId === selectedStageFilter;
      return matchesQuery && matchesStage;
    });
  }, [leads, searchQuery, selectedStageFilter]);

  // Total Pipeline Value
  const totalPipelineValue = useMemo(() => {
    return leads.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [leads]);

  // Handle Lead Stage Change (Move Left / Right or Select)
  const handleMoveLeadStage = async (leadId, targetStageId) => {
    setLeads(prev => prev.map(l => String(l.id) === String(leadId) ? { ...l, stageId: targetStageId } : l));
    if (supabase) {
      try {
        await supabase.from('crm_leads').update({ stage_id: targetStageId, updated_at: new Date().toISOString() }).eq('id', leadId);
      } catch (e) {}
    }
  };

  // Create or Update Lead
  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!leadForm.title.trim() || !leadForm.clientName.trim()) {
      alert('Будь ласка, вкажіть тему запиту та ім’я/компанію замовника!');
      return;
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
    };

    if (editingLead) {
      // Update
      setLeads(prev => prev.map(l => String(l.id) === String(editingLead.id) ? { ...l, ...payload } : l));
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
          }).eq('id', editingLead.id);
        } catch (e) {}
      }
    } else {
      // Create
      const newLead = {
        id: `lead-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString()
      };
      setLeads(prev => [newLead, ...prev]);

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
          }]).select();
          if (data && data[0]) {
            setLeads(prev => prev.map(l => l.id === newLead.id ? { ...l, id: String(data[0].id) } : l));
          }
        } catch (e) {}
      }
    }

    setIsAddLeadOpen(false);
    setEditingLead(null);
    setLeadForm({ title: '', clientName: '', phone: '', email: '', productInterest: '', quantity: 1, amount: '', stageId: 'lead', notes: '' });
  };

  // Delete Lead
  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Видалити цей лід з воронки?')) return;
    setLeads(prev => prev.filter(l => String(l.id) !== String(leadId)));
    if (supabase) {
      try {
        await supabase.from('crm_leads').delete().eq('id', leadId);
      } catch (e) {}
    }
  };

  // Reorder Column (Move Left or Right)
  const handleMoveColumn = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= stages.length) return;
    const updated = [...stages];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    // Update sort_order values
    const reordered = updated.map((st, idx) => ({ ...st, sort_order: (idx + 1) * 10 }));
    setStages(reordered);

    if (supabase) {
      try {
        for (const st of reordered) {
          await supabase.from('crm_pipeline_stages').upsert({
            id: st.id,
            title: st.title,
            color: st.color,
            sort_order: st.sort_order,
            is_system: st.isSystem || false
          });
        }
      } catch (e) {}
    }
  };

  // Add / Edit Stage Column
  const handleSaveStage = async (e) => {
    e.preventDefault();
    if (!stageForm.title.trim()) {
      alert('Будь ласка, введіть назву етапу!');
      return;
    }

    if (editingStage) {
      setStages(prev => prev.map(s => s.id === editingStage.id ? { ...s, title: stageForm.title.trim(), color: stageForm.color } : s));
      if (supabase) {
        try {
          await supabase.from('crm_pipeline_stages').update({ title: stageForm.title.trim(), color: stageForm.color }).eq('id', editingStage.id);
        } catch (e) {}
      }
    } else {
      const newId = `stage_${Date.now()}`;
      const newStage = {
        id: newId,
        title: stageForm.title.trim(),
        color: stageForm.color,
        sort_order: (stages.length + 1) * 10,
        isSystem: false
      };
      setStages(prev => [...prev, newStage]);

      if (supabase) {
        try {
          await supabase.from('crm_pipeline_stages').insert([{
            id: newStage.id,
            title: newStage.title,
            color: newStage.color,
            sort_order: newStage.sort_order,
            is_system: false
          }]);
        } catch (e) {}
      }
    }

    setIsAddStageOpen(false);
    setEditingStage(null);
    setStageForm({ title: '', color: '#6366f1' });
  };

  // Delete Custom Stage
  const handleDeleteStage = async (stageId) => {
    const targetStage = stages.find(s => s.id === stageId);
    if (targetStage?.isSystem) {
      alert('Системні етапи воронки не можна видаляти!');
      return;
    }
    if (!window.confirm(`Видалити етап «${targetStage?.title}»? Запити з цього етапу будуть перенесені в «Новий запит (Лід)».`)) return;

    // Move leads to default stage 'lead'
    setLeads(prev => prev.map(l => l.stageId === stageId ? { ...l, stageId: 'lead' } : l));
    setStages(prev => prev.filter(s => s.id !== stageId));

    if (supabase) {
      try {
        await supabase.from('crm_leads').update({ stage_id: 'lead' }).eq('stage_id', stageId);
        await supabase.from('crm_pipeline_stages').delete().eq('id', stageId);
      } catch (e) {}
    }
  };

  return (
    <div style={{ padding: '14px', minHeight: '100vh', background: 'transparent', color: 'var(--text)', boxSizing: 'border-box', width: '100%' }}>
      {/* Top Header */}
      <div className="crm-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '25px',
        flexWrap: 'wrap',
        gap: '20px',
        paddingLeft: '65px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6366f1',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)'
          }}>
            <Briefcase size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em', margin: 0, color: 'var(--text)' }}>
                CRM Воронка Лідів & Запитів
              </h1>
              <span className="pillar-badge-crm" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>
                CRM Leads
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px', margin: 0 }}>
              Управління лідами, переміщення та налаштування етапів воронки продажів
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div style={{ display: 'flex', gap: '15px' }}>
          <div className="glass-panel" style={{
            padding: '12px 20px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--card-bg, rgba(255,255,255,0.03))',
            border: '1px solid var(--glass-border)'
          }}>
            <TrendingUp size={20} color="#6366f1" />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Обсяг Воронки</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#6366f1' }}>
                ₴{totalPipelineValue.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{
            padding: '12px 20px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'var(--card-bg, rgba(255,255,255,0.03))',
            border: '1px solid var(--glass-border)'
          }}>
            <Users size={20} color="#10b981" />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Всього Лідів</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>
                {leads.length} запитів
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="glass-panel" style={{
        padding: '12px 16px',
        borderRadius: '16px',
        marginBottom: '25px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'var(--card-bg, rgba(255,255,255,0.03))',
        border: '1px solid var(--glass-border)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Stage Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', alignItems: 'center', paddingBottom: '2px' }}>
          <button
            onClick={() => setSelectedStageFilter('all')}
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              border: selectedStageFilter === 'all' ? '1px solid #6366f1' : '1px solid var(--glass-border)',
              background: selectedStageFilter === 'all' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: selectedStageFilter === 'all' ? '#6366f1' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Усі ({leads.length})
          </button>
          {stages.map(s => {
            const count = leads.filter(l => l.stageId === s.id).length;
            const isSel = selectedStageFilter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedStageFilter(s.id)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '10px',
                  border: isSel ? `1px solid ${s.color}` : '1px solid var(--glass-border)',
                  background: isSel ? `${s.color}20` : 'transparent',
                  color: isSel ? s.color : 'var(--text-muted)',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {s.title} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 200px', minWidth: '180px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Пошук ліда, замовника, виробу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '9px 12px 9px 36px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg, rgba(0,0,0,0.2))',
                color: 'var(--text)',
                fontSize: '0.85rem',
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={() => {
                setStageForm({ title: '', color: '#6366f1' });
                setEditingStage(null);
                setIsAddStageOpen(true);
              }}
              style={{
                padding: '9px 12px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text)',
                fontWeight: 800,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Settings size={15} /> + Етап
            </button>

            <button
              onClick={() => {
                setLeadForm({ title: '', clientName: '', phone: '', email: '', productInterest: '', quantity: 1, amount: '', stageId: 'lead', notes: '' });
                setEditingLead(null);
                setIsAddLeadOpen(true);
              }}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={16} /> + Новий Лід
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Kanban Pipeline Columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stages.length}, minmax(280px, 1fr))`,
        gap: '18px',
        overflowX: 'auto',
        paddingBottom: '20px'
      }}>
        {stages.map((stage, colIdx) => {
          const stageLeads = filteredLeads.filter(l => l.stageId === stage.id);
          const stageValue = stageLeads.reduce((s, l) => s + (Number(l.amount) || 0), 0);

          return (
            <div key={stage.id} className="glass-panel" style={{
              padding: '16px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              background: 'var(--card-bg, rgba(18, 18, 24, 0.65))',
              border: '1px solid var(--glass-border)'
            }}>
              {/* Column Header */}
              <div style={{
                borderBottom: `2px solid ${stage.color}`,
                paddingBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color }} />
                    {stage.title}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    {stageValue > 0 ? `₴${stageValue.toLocaleString()} · ` : ''}{stageLeads.length} запитів
                  </div>
                </div>

                {/* Column Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    disabled={colIdx === 0}
                    onClick={() => handleMoveColumn(colIdx, -1)}
                    title="Перемістити колонку вліво"
                    style={{ background: 'none', border: 'none', color: colIdx === 0 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: colIdx === 0 ? 'default' : 'pointer', padding: '3px' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={colIdx === stages.length - 1}
                    onClick={() => handleMoveColumn(colIdx, 1)}
                    title="Перемістити колонку вправо"
                    style={{ background: 'none', border: 'none', color: colIdx === stages.length - 1 ? 'var(--text-dim)' : 'var(--text-muted)', cursor: colIdx === stages.length - 1 ? 'default' : 'pointer', padding: '3px' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingStage(stage);
                      setStageForm({ title: stage.title, color: stage.color });
                      setIsAddStageOpen(true);
                    }}
                    title="Налаштувати етап"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px' }}
                  >
                    <Edit3 size={13} />
                  </button>
                  {!stage.isSystem && (
                    <button
                      onClick={() => handleDeleteStage(stage.id)}
                      title="Видалити етап"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '3px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Leads List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '120px' }}>
                {stageLeads.length === 0 ? (
                  <div style={{ padding: '36px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Немає запитів у цій колонці
                  </div>
                ) : (
                  stageLeads.map(lead => (
                    <div
                      key={lead.id}
                      style={{
                        background: 'var(--card-bg, rgba(30, 30, 42, 0.8))',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '14px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                      }}
                    >
                      {/* Top Meta */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 900, color: stage.color }}>
                          {lead.title}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => {
                              setEditingLead(lead);
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
                              });
                              setIsAddLeadOpen(true);
                            }}
                            title="Редагувати лід"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            title="Видалити"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Client Name */}
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text)' }}>
                        {lead.clientName}
                      </div>

                      {/* Product Interest & Quantity */}
                      {(lead.productInterest || lead.quantity) && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Package size={13} />
                          <span>{lead.productInterest || 'Виріб'} ({lead.quantity || 1} шт)</span>
                        </div>
                      )}

                      {/* Notes snippet */}
                      {lead.notes && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'var(--glass-border, rgba(0,0,0,0.05))', padding: '6px 10px', borderRadius: '8px', lineHeight: 1.3 }}>
                          {lead.notes}
                        </div>
                      )}

                      {/* Footer & Stage Shift Buttons */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--glass-border)',
                        paddingTop: '8px',
                        marginTop: '4px'
                      }}>
                        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: lead.amount > 0 ? '#10b981' : 'var(--text-muted)' }}>
                          {lead.amount > 0 ? `₴${lead.amount.toLocaleString()}` : 'Без ціни'}
                        </span>

                        {/* Move Stage Quick Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {colIdx > 0 && (
                            <button
                              onClick={() => handleMoveLeadStage(lead.id, stages[colIdx - 1].id)}
                              title={`Пересунути на: ${stages[colIdx - 1].title}`}
                              style={{
                                padding: '3px 7px',
                                borderRadius: '6px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-muted)',
                                fontSize: '0.7rem',
                                cursor: 'pointer'
                              }}
                            >
                              ←
                            </button>
                          )}
                          {colIdx < stages.length - 1 && (
                            <button
                              onClick={() => handleMoveLeadStage(lead.id, stages[colIdx + 1].id)}
                              title={`Пересунути на: ${stages[colIdx + 1].title}`}
                              style={{
                                padding: '3px 7px',
                                borderRadius: '6px',
                                background: 'rgba(99, 102, 241, 0.18)',
                                border: '1px solid #6366f1',
                                color: '#6366f1',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create / Edit Lead */}
      {isAddLeadOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'var(--card-bg, #1a1a24)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            color: 'var(--text)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
                {editingLead ? 'Редагування Ліда' : 'Новий Запит / Лід'}
              </h3>
              <button onClick={() => setIsAddLeadOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Тема Запиту / Назва Ліда *</label>
                <input
                  type="text"
                  required
                  placeholder="напр.: Запит на 50 рами F610..."
                  value={leadForm.title}
                  onChange={e => setLeadForm({ ...leadForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Замовник / Компанія *</label>
                <input
                  type="text"
                  required
                  placeholder="напр.: ТОВ Метал-Тех..."
                  value={leadForm.clientName}
                  onChange={e => setLeadForm({ ...leadForm, clientName: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Телефон Контакту</label>
                  <input
                    type="text"
                    placeholder="+380..."
                    value={leadForm.phone}
                    onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Email</label>
                  <input
                    type="email"
                    placeholder="info@client.com"
                    value={leadForm.email}
                    onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Продукт / Виріб</label>
                  <input
                    type="text"
                    placeholder="Рама / Корпус..."
                    value={leadForm.productInterest}
                    onChange={e => setLeadForm({ ...leadForm, productInterest: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Кількість</label>
                  <input
                    type="number"
                    min={1}
                    value={leadForm.quantity}
                    onChange={e => setLeadForm({ ...leadForm, quantity: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Оціночна Сума (₴)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={leadForm.amount}
                    onChange={e => setLeadForm({ ...leadForm, amount: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Етап Воронки</label>
                <select
                  value={leadForm.stageId}
                  onChange={e => setLeadForm({ ...leadForm, stageId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--card-bg, rgba(0,0,0,0.2))', color: 'var(--text)', outline: 'none', fontWeight: 700 }}
                >
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Примітки / Коментар</label>
                <textarea
                  rows={3}
                  placeholder="Вкажіть особливі вимоги замовника..."
                  value={leadForm.notes}
                  onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddLeadOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 800, cursor: 'pointer' }}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                >
                  Зберегти Лід
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Stage */}
      {isAddStageOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'var(--card-bg, #1a1a24)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            color: 'var(--text)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900 }}>
                {editingStage ? 'Редагувати Етап' : 'Новий Етап Воронки'}
              </h3>
              <button onClick={() => setIsAddStageOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Назва Етапу *</label>
                <input
                  type="text"
                  required
                  placeholder="напр.: Узгодження Договору..."
                  value={stageForm.title}
                  onChange={e => setStageForm({ ...stageForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Колір Етапу</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={stageForm.color}
                    onChange={e => setStageForm({ ...stageForm, color: e.target.value })}
                    style={{ width: '44px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                  />
                  <input
                    type="text"
                    value={stageForm.color}
                    onChange={e => setStageForm({ ...stageForm, color: e.target.value })}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text)', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddStageOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontWeight: 800, cursor: 'pointer' }}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                >
                  Зберегти Етап
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
