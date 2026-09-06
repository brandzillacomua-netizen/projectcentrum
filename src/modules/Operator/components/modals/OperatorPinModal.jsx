import React from 'react'

export const OperatorPinModal = ({
  showPinModal,
  setShowPinModal,
  pin,
  setPin,
  pinError,
  validatePin
}) => {
  if (!showPinModal) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.98)', zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '350px', textAlign: 'center' }}>
        <div style={{ background: '#111', padding: '20px', borderRadius: '24px', fontSize: '3rem', fontWeight: 1000, marginBottom: '30px', border: `3px solid ${pinError ? '#ef4444' : '#222'}` }}>
          {pin.split('').map(() => '*').join('')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => setPin(pin + num)} style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #333', fontSize: '2rem', padding: '20px', borderRadius: '15px' }}>
              {num}
            </button>
          ))}
          <button onClick={() => setPin('')} style={{ background: '#1a1a1a', color: '#ef4444', fontSize: '2rem', borderRadius: '15px' }}>C</button>
          <button onClick={() => setPin(pin + '0')} style={{ background: '#1a1a1a', color: '#fff', fontSize: '2rem', borderRadius: '15px' }}>0</button>
          <button onClick={validatePin} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '15px', fontSize: '1.2rem' }}>OK</button>
        </div>
        <button onClick={() => setShowPinModal(false)} style={{ marginTop: '30px', background: 'transparent', color: '#555', border: 'none' }}>СКАСУВАТИ</button>
      </div>
    </div>
  )
}
