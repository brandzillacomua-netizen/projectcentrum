import React from 'react';
import { ArrowLeft, Check, BellOff } from 'lucide-react';

export function NavNotificationFeed({
  isOpen,
  onBack,
  notifications,
  unreadCount,
  readIds,
  onNotificationClick,
  onMarkAllAsRead,
  formatRelativeTime
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(8, 8, 8, 0.98)',
      backdropFilter: 'blur(25px)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      pointerEvents: isOpen ? 'auto' : 'none'
    }}>
      {/* Header section with Back and Close button */}
      <div style={{
        padding: '24px 20px 20px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ff9000',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 800,
            padding: '6px 0'
          }}
        >
          <ArrowLeft size={16} /> Назад
        </button>
        <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff' }}>
          Сповіщення {unreadCount > 0 && `(${unreadCount})`}
        </span>
      </div>

      {/* Mark all as read bar */}
      {notifications.length > 0 && unreadCount > 0 && (
        <div style={{
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.02)'
        }}>
          <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 800 }}>
            НЕПРОЧИТАНИХ: {unreadCount}
          </span>
          <button
            onClick={onMarkAllAsRead}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ff9000',
              fontSize: '0.65rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,144,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Check size={12} /> Позначити всі
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="sidebar-links-container" style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
        {notifications.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
            <BellOff size={32} color="#222" />
            <span style={{ fontSize: '0.75rem', color: '#444', fontWeight: 800, textAlign: 'center' }}>
              Немає нових сповіщень
            </span>
          </div>
        ) : (
          notifications.map(n => {
            const isUnread = !readIds.includes(n.id);
            return (
              <div
                key={n.id}
                onClick={() => onNotificationClick(n)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '12px',
                  background: isUnread ? 'rgba(255, 144, 0, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid',
                  borderColor: isUnread ? 'rgba(255, 144, 0, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '8px',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isUnread ? 'rgba(255, 144, 0, 0.08)' : 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.transform = 'translateX(2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isUnread ? 'rgba(255, 144, 0, 0.04)' : 'rgba(255, 255, 255, 0.01)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: `${n.color}15`,
                  color: n.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {n.icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {n.title}
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    color: '#888',
                    marginTop: '3px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.25'
                  }}>
                    {n.description}
                  </span>
                  <span style={{ fontSize: '0.58rem', color: '#444', marginTop: '6px', fontWeight: 800 }}>
                    {formatRelativeTime ? formatRelativeTime(n.createdAt) : ''}
                  </span>
                </div>
                {isUnread && (
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 6px #ef4444',
                    alignSelf: 'center',
                    flexShrink: 0
                  }} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
