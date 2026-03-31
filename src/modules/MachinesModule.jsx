import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Cpu, Plus, Trash2, Info } from 'lucide-react'
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
        type: 'Laser', // Defaulting to Laser as it's the primary use case
        status: 'active'
      }, addMachine)
      setForm({ name: '', capacity: '1' })
      setShowAdd(false)
    } catch (err) {
      alert('Помилка при додаванні станка: ' + err.message)
    }
  }

  const handleDelete = async (id, name) => {
    if (window.confirm(`Видалити станок "${name}"?`)) {
      try {
        await apiService.submitDelete(id, 'machine', deleteMachine)
      } catch (err) {
        alert('Помилка при видаленні: ' + err.message)
      }
    }
  }

  return (
    <div className="module-page" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <nav className="module-nav" style={{ padding: '0 30px', height: '70px', background: '#000', borderBottom: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={20} /> Вихід у Портал
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Cpu size={24} color="var(--primary)" />
          <h1 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.05em', margin: 0 }}>УПРАВЛІННЯ СТАНКАМИ</h1>
        </div>
      </nav>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: 0 }}>Парк обладнання</h2>
            <p style={{ color: '#555', marginTop: '5px' }}>Керування виробничими потужностями</p>
          </div>
          <button 
            onClick={() => setShowAdd(!showAdd)}
            style={{ background: 'var(--primary)', color: '#000', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={20} /> ДОДАТИ СТАНОК
          </button>
        </div>

        {showAdd && (
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: '24px', padding: '30px', marginBottom: '40px' }}>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '20px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', color: '#888', marginBottom: '10px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Назва станка</label>
                <input 
                  type="text" 
                  required
                  placeholder="Наприклад: LXS-1 або Laser Pro 3000"
                  style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '12px' }}
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', marginBottom: '10px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Місткість (листів)</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  style={{ width: '100%', padding: '15px', background: '#000', border: '1px solid #333', color: '#fff', borderRadius: '12px' }}
                  value={form.capacity}
                  onChange={e => setForm({...form, capacity: e.target.value})}
                />
              </div>
              <button type="submit" style={{ background: '#fff', color: '#000', border: 'none', padding: '15px 30px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', height: '52px' }}>
                ЗБЕРЕГТИ
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px', color: '#444' }}>Завантаження...</div>
        ) : (machines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px', background: '#111', borderRadius: '24px', border: '2px dashed #222' }}>
            <Cpu size={64} style={{ marginBottom: '20px', opacity: 0.2 }} />
            <p style={{ color: '#555', fontSize: '1.2rem' }}>Станки ще не додані. Натисніть кнопку вище, щоб додати перший станок.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' }}>
            {machines.map(m => (
              <div key={m.id} style={{ background: '#121212', border: '1px solid #222', borderRadius: '24px', padding: '30px', transition: '0.3s' }} className="machine-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ width: '50px', height: '50px', background: '#000', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Cpu size={24} color="var(--primary)" />
                  </div>
                  <button onClick={() => handleDelete(m.id, m.name)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', transition: '0.2s' }}>
                    <Trash2 size={20} />
                  </button>
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 10px 0' }}>{m.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '0.9rem', background: '#000', padding: '10px 15px', borderRadius: '12px' }}>
                  <Info size={16} color="var(--primary)" />
                  <span>Одночасне завантаження: <strong>{m.sheet_capacity} лист.</strong></span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .machine-card:hover { transform: translateY(-5px); border-color: var(--primary); box-shadow: 0 15px 30px rgba(0,0,0,0.4); }
        .machine-card button:hover { color: #ef4444 !important; }
      `}} />
    </div>
  )
}

export default MachinesModule
