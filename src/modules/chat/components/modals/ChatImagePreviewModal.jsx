import React from 'react'
import { X } from 'lucide-react'
import { bytesToLabel, formatMessageTime } from '../../hooks/useChatData.js'

export const ChatImagePreviewModal = ({ imagePreview, setImagePreview }) => {
  if (!imagePreview) return null

  return (
    <div className="image-preview-backdrop" onClick={() => setImagePreview(null)}>
      <div className="image-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="image-preview-head">
          <div>
            <b>{imagePreview.sender}</b>
            <span>{[bytesToLabel(imagePreview.size), formatMessageTime(imagePreview.time)].filter(Boolean).join(' · ')}</span>
          </div>
          <button className="icon-btn" onClick={() => setImagePreview(null)} title="Закрити">
            <X size={18} />
          </button>
        </div>
        <img src={imagePreview.url} alt={imagePreview.name} />
      </div>
    </div>
  )
}

export default ChatImagePreviewModal
