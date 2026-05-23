import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Cpu, AlertTriangle, Check, PhoneCall, Hammer, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react'
import { supabase } from '../supabase'

const MachineCallModule = () => {
  const { id } = useParams()
  const [machine, setMachine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCalls, setActiveCalls] = useState([])
  const [operatorName, setOperatorName] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const fetchMachineAndCalls = async () => {
    try {
      const { data: mData } = await supabase.from('machines').select('*').eq('id', id).maybeSingle()
      if (mData) setMachine(mData)
      
      const { data: cData } = await supabase.from('machine_calls').select('*').eq('machine_id', id).eq('status', 'pending')
      if (cData) setActiveCalls(cData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMachineAndCalls()
    
    // Subscribe to calls for real-time updates
    const channel = supabase.channel(`calls-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machine_calls', filter: `machine_id=eq.${id}` }, () => {
        // Refetch active calls on any change
        supabase.from('machine_calls').select('*').eq('machine_id', id).eq('status', 'pending').then(({ data }) => {
          if (data) setActiveCalls(data)
        })
      })
      .subscribe()
      
    return () => { supabase.removeChannel(channel) }
  }, [id])
  
  const handleCall = async (role) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    
    // Haptic feedback if supported
    if (navigator.vibrate) navigator.vibrate(100)
    
    // Check if call already exists
    if (activeCalls.some(c => c.called_role === role)) {
      setSuccessMsg(`Виклик для цієї служби вже надіслано!`)
      setTimeout(() => setSuccessMsg(''), 3000)
      setIsSubmitting(false)
      return
    }
    
    const { error } = await supabase.from('machine_calls').insert({
      machine_id: id,
      called_role: role,
      operator_name: operatorName.trim() || 'Оператор верстата',
      status: 'pending'
    })
    
    setIsSubmitting(false)
    
    if (error) {
      alert('Помилка: ' + error.message)
    } else {
      let roleLabel = role === 'master' ? 'Майстра' : role === 'engineer' ? 'Інженера' : 'ВКЯ'
      setSuccessMsg(`Виклик ${roleLabel} успішно надіслано!`)
      setTimeout(() => setSuccessMsg(''), 4000)
      // Refetch immediately
      const { data } = await supabase.from('machine_calls').select('*').eq('machine_id', id).eq('status', 'pending')
      if (data) setActiveCalls(data)
    }
  }
  
  if (loading) {
    return (
      <div style={{ background: '#09090b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #27272a', borderTop: '3px solid #ff9000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }
  
  if (!machine) {
    return (
      <div style={{ background: '#09090b', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '20px', textAlign: 'center' }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '20px' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Верстат не знайдено</h2>
        <p style={{ color: '#71717a', fontSize: '0.9rem', marginTop: '10px' }}>QR-код містить некоректний ідентифікатор обладнання.</p>
        <Link to="/" style={{ color: '#ff9000', textDecoration: 'none', fontWeight: 800, marginTop: '20px', fontSize: '0.9rem' }}>На головну</Link>
      </div>
    )
  }
  
  return (
    <div style={{ background: '#09090b', minHeight: '100vh', color: '#fff', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
      <div style={{ width: '100%', maxWidth: '480px', background: 'rgba(24, 24, 27, 0.75)', border: '1px solid #27272a', borderRadius: '28px', padding: '30px', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        
        {/* Machine info header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'rgba(255,144,0,0.1)', color: '#ff9000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', border: '1px solid rgba(255,144,0,0.2)' }}>
            <Cpu size={32} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 1000, margin: 0, letterSpacing: '-0.5px' }}>{machine.name}</h2>
          <div style={{ fontSize: '0.8rem', color: '#a1a1aa', fontWeight: 700, marginTop: '6px' }}>
            Пор. №{machine.sequence_number || '—'} | Інв. {machine.inventory_no || '—'}
          </div>
          {machine.floor && (
            <div style={{ fontSize: '0.75rem', color: '#ff9000', fontWeight: 800, marginTop: '5px' }}>
              📍 Локація: {machine.floor} Поверх
            </div>
          )}
        </div>

        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '15px', borderRadius: '14px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Check size={16} /> {successMsg}
          </div>
        )}

        {/* Input Operator Name */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 900, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Ваше Ім'я (необов'язково)</label>
          <input 
            type="text" 
            placeholder="Введіть ваше ім'я..." 
            value={operatorName}
            onChange={e => setOperatorName(e.target.value)}
            style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', padding: '12px 15px', fontSize: '0.85rem', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = '#ff9000'}
            onBlur={e => e.target.style.borderColor = '#27272a'}
          />
        </div>

        <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '15px', textAlign: 'center' }}>Оберіть кого потрібно викликати:</h3>
        
        {/* Buttons Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* 1. MASTER */}
          <button 
            onClick={() => handleCall('master')}
            disabled={isSubmitting}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', 
              background: activeCalls.some(c => c.called_role === 'master') ? 'rgba(255,144,0,0.1)' : '#09090b',
              border: '1px solid',
              borderColor: activeCalls.some(c => c.called_role === 'master') ? '#ff9000' : '#27272a',
              borderRadius: '16px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', width: '100%',
              outline: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
              <PhoneCall size={20} color="#ff9000" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 900, fontSize: '1rem' }}>МАЙСТЕР</div>
                <div style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600 }}>Викликати майстра зміни / бригадира</div>
              </div>
            </div>
            {activeCalls.some(c => c.called_role === 'master') && (
              <span className="pulse-indicator" style={{ background: '#ff9000', width: '8px', height: '8px', borderRadius: '50%', boxShadow: '0 0 10px #ff9000' }} />
            )}
          </button>

          {/* 2. ENGINEER */}
          <button 
            onClick={() => handleCall('engineer')}
            disabled={isSubmitting}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', 
              background: activeCalls.some(c => c.called_role === 'engineer') ? 'rgba(139,92,246,0.1)' : '#09090b',
              border: '1px solid',
              borderColor: activeCalls.some(c => c.called_role === 'engineer') ? '#8b5cf6' : '#27272a',
              borderRadius: '16px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', width: '100%',
              outline: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
              <Hammer size={20} color="#8b5cf6" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 900, fontSize: '1rem' }}>ІНЖЕНЕР</div>
                <div style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600 }}>Викликати інженера-налагоджувальника</div>
              </div>
            </div>
            {activeCalls.some(c => c.called_role === 'engineer') && (
              <span className="pulse-indicator" style={{ background: '#8b5cf6', width: '8px', height: '8px', borderRadius: '50%', boxShadow: '0 0 10px #8b5cf6' }} />
            )}
          </button>

          {/* 3. QUALITY CONTROL (VKYa) */}
          <button 
            onClick={() => handleCall('quality')}
            disabled={isSubmitting}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', 
              background: activeCalls.some(c => c.called_role === 'quality') ? 'rgba(239,68,68,0.1)' : '#09090b',
              border: '1px solid',
              borderColor: activeCalls.some(c => c.called_role === 'quality') ? '#ef4444' : '#27272a',
              borderRadius: '16px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', width: '100%',
              outline: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
              <ShieldAlert size={20} color="#ef4444" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 900, fontSize: '1rem' }}>ВКЯ</div>
                <div style={{ fontSize: '0.7rem', color: '#71717a', fontWeight: 600 }}>Викликати інспектора ВКЯ</div>
              </div>
            </div>
            {activeCalls.some(c => c.called_role === 'quality') && (
              <span className="pulse-indicator" style={{ background: '#ef4444', width: '8px', height: '8px', borderRadius: '50%', boxShadow: '0 0 10px #ef4444' }} />
            )}
          </button>
        </div>
        
        {/* Active calls summary list */}
        {activeCalls.length > 0 && (
          <div style={{ marginTop: '30px', borderTop: '1px solid #27272a', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 900, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Надіслані виклики в черзі:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeCalls.map(c => {
                const label = c.called_role === 'master' ? 'МАЙСТЕР' : c.called_role === 'engineer' ? 'ІНЖЕНЕР' : 'ВКЯ'
                const color = c.called_role === 'master' ? '#ff9000' : c.called_role === 'engineer' ? '#8b5cf6' : '#ef4444'
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid #27272a', fontSize: '0.78rem' }}>
                    <span style={{ color, fontWeight: 900 }}>{label}</span>
                    <span style={{ color: '#71717a', fontSize: '0.7rem' }}>
                      Надіслано: {new Date(c.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse { 
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pulse-indicator { animation: pulse 1.5s infinite ease-in-out; }
      `}} />
    </div>
  )
}

export default MachineCallModule
