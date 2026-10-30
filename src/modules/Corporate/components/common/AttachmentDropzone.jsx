import React, { useRef } from 'react'
import { Image as ImageIcon, Paperclip, X, FileText, CheckCircle2, UploadCloud, Loader2 } from 'lucide-react'
import { bytesToLabel } from '../../utils/corporateHelpers'

export function AttachmentDropzone({
  attachments = [],
  onAddFiles,
  onRemove,
  isProcessing = false
}) {
  const imageInputRef = useRef(null)
  const fileInputRef = useRef(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Uploaded items list */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '4px 0' }}>
          {attachments.map(att => (
            <div
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--ch-surface-inset)',
                border: '1px solid var(--ch-border)',
                borderRadius: '12px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                position: 'relative',
                maxWidth: '280px'
              }}
            >
              {att.type === 'image' && att.previewUrl ? (
                <img
                  src={att.previewUrl}
                  alt=""
                  style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--ch-accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} color="var(--ch-accent)" />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: 'var(--ch-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {att.name}
                </div>
                {att.type === 'image' && att.savingsPercent > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#10b981', fontWeight: 800 }}>
                    <CheckCircle2 size={11} />
                    <span>{bytesToLabel(att.compressedSize)} (-{att.savingsPercent}%)</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.68rem', color: 'var(--ch-text-dim)' }}>
                    {bytesToLabel(att.size || att.compressedSize)}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onRemove(att.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ch-text-dim)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--ch-text-dim)'}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files) onAddFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files) onAddFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {/* Quick Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={isProcessing}
          className="corp-btn-subtle"
          title="Додати фото (автоматично стискаються у WebP перед відправкою)"
        >
          <ImageIcon size={15} color="#10b981" />
          <span>Фото (автостиснення)</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="corp-btn-subtle"
          title="Додати PDF, креслення або документи"
        >
          <Paperclip size={15} color="var(--ch-accent)" />
          <span>Документ / Файл</span>
        </button>

        {isProcessing && (
          <span style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Loader2 size={13} className="spin" />
            Оптимізація розміру...
          </span>
        )}
      </div>
    </div>
  )
}
