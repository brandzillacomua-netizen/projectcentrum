import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Cpu, Plus, Trash2, Info, X, Zap } from 'lucide-react'
import { useMES } from '../MESContext'
import { apiService } from '../services/apiDispatcher'

const MachinesModule = () => {
  const { machines, addMachine, deleteMachine, loading } = useMES()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', capacity: '1' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return
    try {
      await apiService.submitMachine({
        name: form.name,
        sheet_capacity: form.capacity,
        type: 'Laser',
        status: 'active'
      }, addMachine)
      setForm({ name: '', capacity: '1' })
      setShowAdd(false)
      alert('Станок додано успішно!')
    } catch (err) {
      alert('Помилка: ' + err.message)
    }
  }

  const handleDelete = async (id, name) => {
    if (window.confirm(`Видалити станок "${name}"?`)) {
      try {
        await apiService.submitDelete(id, 'machine', deleteMachine)
      } catch (err) {
        alert('Помилка: ' + err.message)
      }
    }
  }

  return (
    <div className="machines-module-v2" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <nav className="module-nav" style={{ flexShrink: 0 }}>
        <Link to="/" className="back-link"><ArrowLeft size={18} /> <span className="hide-mobile">Назад</span></Link>
        <div className="module-title-group">
          <Cpu className="text-secondary" size={24} />
          <h1 className="hide-mobile">Управління станками</h1>
          <h1 className="mobile-only" style={{ fontSize: '1rem' }}>СТАНКИ</h1>
        </div>
      </nav>

      <div className="module-content" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0 }}>ПАРК ОБЛАДНАННЯ</h2>
              <p style={{ color: '#555', margin: '5px 0 0', fontSize: '0.85rem' }}>Конфігурація виробничих ліній</p>
            </div>
            <button 
              onClick={() => setShowAdd(!showAdd)}
              style={{ background: showAdd ? '#222' : '#ff9000', color: showAdd ? '#fff' : '#000', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: showAdd ? 'none' : '0 10px 20px rgba(255,144,0,0.2)' }}
            >
              {showAdd ? <X size={20} /> : <Plus size={20} />}
              {showAdd ? 'ЗАКРИТИ' : 'ДОДАТИ'}
            </button>
          </div>

          {showAdd && (
            <div className="glass-panel" style={{ background: '#111', border: '1px solid #222', borderRadius: '24px', padding: '30px', marginBottom: '30px' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                   <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: '#555', marginBottom: '8px', fontWeight: 800 }}>НАЗВА СТАНКА</label>
                      <input style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '12px' }} placeholder="напр. Laser Alpha" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                   </div>
                   <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', color: '#555', marginBottom: '8px', fontWeight: 800 }}>МІСТКІСТЬ (ЛИСТІВ)</label>
                      <input type="number" style={{ width: '100%', background: '#000', border: '1px solid #333', color: '#fff', padding: '15px', borderRadius: '12px' }} value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} required />
                   </div>
                </div>
                <button type="submit" style={{ background: '#fff', color: '#000', border: 'none', padding: '18px', borderRadius: '14px', fontWeight: 900, cursor: 'pointer' }}>ЗБЕРЕГТИ ОБЛАДНАННЯ</button>
              </form>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px', color: '#444' }}><Zap className="animate-pulse" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {machines.map(m => (
                <div key={m.id} className="machine-box glass-panel" style={{ background: '#111', border: '1px solid #222', borderRadius: '24px', padding: '25px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ background: '#0a0a0a', width: '50px', height: '50px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1a1a1a' }}>
                      <Cpu size={24} color="#ff9000" />
                    </div>
                    <button onClick={() => handleDelete(m.id, m.name)} style={{ background: 'transparent', border: 'none', color: '#333', cursor: 'pointer' }}><Trash2 size={20} /></button>
                  </div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '1.4rem', fontWeight: 900 }}>{m.name}</h3>
                  <div style={{ background: 'rgba(255,144,0,0.05)', padding: '12px 15px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={16} color="#ff9000" />
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>Місткість наряду: <strong>{m.sheet_capacity} л.</strong></span>
                  </div>
                </div>
              ))}
              {machines.length === 0 && !showAdd && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px 20px', background: '#0a0a0a', border: '2px dashed #1a1a1a', borderRadius: '30px' }}>
                   <p style={{ color: '#444' }}>Парк обладнання порожній.<br/>Додайте перший станок для початку роботи.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .machine-box { transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .machine-box:hover { transform: translateY(-5px); border-color: #ff9000; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .machine-box button:hover { color: #ef4444; }
      `}} />
    </div>
  )
}

export default MachinesModule
