import React, { useState } from 'react'
import { useMES } from '../MESContext'
import { ShieldCheck, LogIn, User, Lock, Loader2 } from 'lucide-react'

const LoginPage = () => {
  const { login } = useMES()
  const [formData, setFormData] = useState({ login: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await login(formData.login, formData.password)
      if (!res.success) {
        setError(res.error)
      }
    } catch (err) {
      setError('Сталася помилка при вході')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page-v2" style={{
      background: '#050505',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background patterns */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(255,144,0,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }}></div>
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }}></div>

      <div className="login-card glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(15,15,15,0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '32px',
        padding: '50px 40px',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
        zIndex: 10,
        textAlign: 'center'
      }}>
        <div className="login-logo" style={{ marginBottom: '40px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #ff9000, #ff5e00)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 20px 40px rgba(255,144,0,0.3)'
          }}>
            <ShieldCheck size={40} color="#000" />
          </div>
          <h1 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 950, margin: 0, letterSpacing: '-1px' }}>
            CRM <span style={{ color: '#ff9000' }}>CENTRUM</span>
          </h1>
          <p style={{ color: '#444', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: '10px' }}>
            Industrial Authorization
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#333' }} />
            <input
              type="text"
              placeholder="ЛОГІН"
              style={inputStyle}
              value={formData.login}
              onChange={e => setFormData({ ...formData, login: e.target.value })}
              required
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#333' }} />
            <input
              type="password"
              placeholder="ПАРОЛЬ"
              style={inputStyle}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#ff9000',
              color: '#000',
              border: 'none',
              padding: '18px',
              borderRadius: '16px',
              fontWeight: 950,
              fontSize: '1rem',
              cursor: loading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              transition: '0.3s',
              marginTop: '10px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? <Loader2 size={22} className="animate-spin" /> : <LogIn size={22} />}
            ВХІД В СИСТЕМУ
          </button>
        </form>

        <div style={{ marginTop: '40px', fontSize: '0.65rem', color: '#333', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          &copy; 2026 REBRAND STUDIO | MES v2.4
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus { border-color: #ff9000 !important; background: #000 !important; }
      `}} />
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: '#0a0a0a',
  border: '1px solid #1a1a1a',
  borderRadius: '16px',
  padding: '16px 16px 16px 48px',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 700,
  transition: '0.3s',
  outline: 'none'
}

export default LoginPage
