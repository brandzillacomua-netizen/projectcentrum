import React, { Suspense, lazy } from 'react'
import {
  Camera,
  CheckSquare,
  Image as ImageIcon,
  Loader2,
  Plus,
  Send,
  Smile,
  X
} from 'lucide-react'
import { ReadOnlyChannelNotice } from '../ChatChannelModule.jsx'

const EmojiPicker = lazy(() => import('emoji-picker-react'))

export const ChatComposerBar = ({
  activeIsChannel,
  canPostHere,
  pendingImage,
  clearPendingImage,
  bytesToLabel,
  showEmojiPicker,
  setShowEmojiPicker,
  setComposer,
  composer,
  fileInputRef,
  cameraInputRef,
  handleFile,
  showAttachMenu,
  setShowAttachMenu,
  sending,
  sendMessage,
  activeParticipants = [],
  setShowPollModal,
  setTaskForm,
  setShowTaskModal,
  me,
  scrollToBottom
}) => {
  if (!canPostHere) {
    return <ReadOnlyChannelNotice />
  }

  return (
    <footer className="chat-composer">
      {pendingImage && (
        <div className="pending-img-preview" style={{ padding: '8px 12px', background: '#111', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '12px 12px 0 0', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem' }}>
            <img src={pendingImage.previewUrl} alt="Preview" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px' }} />
            <span>
              {bytesToLabel(pendingImage.originalSize)} → {bytesToLabel(pendingImage.compressedSize)}
            </span>
          </div>
          <button className="icon-btn" onClick={clearPendingImage} title="Прибрати фото">
            <X size={16} />
          </button>
        </div>
      )}
      {showEmojiPicker && (
        <div className="emoji-picker-container">
          <Suspense fallback={<div style={{ padding: '20px', color: '#666', fontSize: '0.75rem', textAlign: 'center' }}>Завантаження смайлів...</div>}>
            <EmojiPicker
              theme="dark"
              width="100%"
              height={280}
              emojiStyle="native"
              searchDisabled={true}
              previewConfig={{ showPreview: false }}
              onEmojiClick={(emojiData) => {
                setComposer(prev => prev + emojiData.emoji)
              }}
            />
          </Suspense>
        </div>
      )}
      <div className="composer-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={e => { handleFile(e.target.files?.[0]); setShowAttachMenu(false) }}
          style={{ display: 'none' }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => { handleFile(e.target.files?.[0]); setShowAttachMenu(false) }}
          style={{ display: 'none' }}
        />
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={() => setShowAttachMenu(!showAttachMenu)} title="Додати" disabled={sending}>
            <Plus size={18} style={{ transform: showAttachMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showAttachMenu && (
            <>
              <div className="chat-menu-backdrop" onClick={() => setShowAttachMenu(false)} style={{ zIndex: 10, position: 'fixed', inset: 0 }} />
              <div className="attach-options-menu" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', zIndex: 11, background: '#111', border: '1px solid #222', borderRadius: '12px', padding: '6px', minWidth: '180px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button onClick={() => cameraInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }} onMouseEnter={e => e.currentTarget.style.background='#222'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <Camera size={16} color="#3b82f6" /> Зробити фото
                </button>
                <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }} onMouseEnter={e => e.currentTarget.style.background='#222'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <ImageIcon size={16} color="#10b981" /> Завантажити фото
                </button>
                {activeIsChannel && (
                  <button onClick={() => { setShowPollModal(true); setShowAttachMenu(false) }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }} onMouseEnter={e => e.currentTarget.style.background='#222'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <CheckSquare size={16} color="#93c5fd" /> Опитування
                  </button>
                )}
                {activeParticipants.length === 2 && (
                  <button onClick={() => {
                    const other = activeParticipants.find(p => p.user_id !== me.id)
                    if (other) {
                      setTaskForm({ title: '', description: '', assignee: other })
                      setShowTaskModal(true)
                      setShowAttachMenu(false)
                    }
                  }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem', borderTop: '1px solid #222', marginTop: '4px', paddingTop: '8px' }} onMouseEnter={e => e.currentTarget.style.background='#222'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <CheckSquare size={16} color="#ff9000" /> Створити завдання
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <button className="icon-btn" onClick={() => {
          setShowEmojiPicker(!showEmojiPicker)
          setTimeout(() => scrollToBottom({ force: true }), 50)
        }} title="Смайли" disabled={sending}>
          <Smile size={18} />
        </button>
        <textarea
          value={composer}
          onChange={e => setComposer(e.target.value)}
          placeholder="Написати повідомлення..."
          rows={1}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
        />
        <button className="send-btn" onClick={sendMessage} disabled={sending || (!composer.trim() && !pendingImage)}>
          {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
        </button>
      </div>
    </footer>
  )
}

export default ChatComposerBar
