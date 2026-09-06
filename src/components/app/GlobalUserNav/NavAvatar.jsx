import React from 'react';

export const getAvatarGradient = (name) => {
  switch (name) {
    case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)';
    case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)';
    case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)';
    case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)';
    case 'orange':
    default: return 'linear-gradient(135deg, #ff9000, #ff5500)';
  }
};

export const renderAvatar = (avatar, initials, size = '38px', fontSize = '0.85rem') => {
  if (avatar && avatar.startsWith('data:image/')) {
    return (
      <img
        src={avatar}
        alt="Avatar"
        style={{
          width: size,
          height: size,
          borderRadius: '10px',
          objectFit: 'cover',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      />
    );
  }

  const grad = getAvatarGradient(avatar);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '10px',
      background: grad,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 1000,
      fontSize: fontSize,
      border: '1px solid rgba(255,255,255,0.1)',
      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }}>
      {initials}
    </div>
  );
};

export function NavAvatar({ avatar, initials, size = '38px', fontSize = '0.85rem' }) {
  return renderAvatar(avatar, initials, size, fontSize);
}
