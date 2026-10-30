import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react'

export function CorporateImageLightbox({
  isOpen,
  onClose,
  images = [],
  initialIndex = 0
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Sync initialIndex when lightbox opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex >= 0 && initialIndex < images.length ? initialIndex : 0)
    }
  }, [isOpen, initialIndex, images.length])

  // Lock body scroll while lightbox is open
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`
    }
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [isOpen])

  // Keyboard navigation (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, images.length, onClose])

  if (!isOpen || images.length === 0 || typeof document === 'undefined') return null

  const currentImage = images[currentIndex] || images[0]
  const imageUrl = currentImage?.url || currentImage
  const imageName = currentImage?.name || `Зображення ${currentIndex + 1}`

  const handlePrev = (e) => {
    e.stopPropagation()
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNext = (e) => {
    e.stopPropagation()
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const handleDownload = (e) => {
    e.stopPropagation()
    try {
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = imageName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      window.open(imageUrl, '_blank')
    }
  }

  const lightboxContent = (
    <div
      className="corp-lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <div className="corp-lightbox-header" onClick={e => e.stopPropagation()}>
        <div className="corp-lightbox-info">
          {images.length > 1 && (
            <span className="corp-lightbox-counter">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          <span className="corp-lightbox-title" title={imageName}>
            {imageName}
          </span>
        </div>

        <div className="corp-lightbox-actions">
          <button
            type="button"
            className="corp-lightbox-action-btn"
            onClick={handleDownload}
            title="Завантажити оригінал"
          >
            <Download size={18} />
          </button>

          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="corp-lightbox-action-btn"
            title="Відкрити у новій вкладці"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={18} />
          </a>

          <button
            type="button"
            className="corp-lightbox-action-btn close"
            onClick={onClose}
            title="Закрити (ESC)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="corp-lightbox-stage">
        {/* Previous Button */}
        {images.length > 1 && (
          <button
            type="button"
            className="corp-lightbox-nav-btn prev"
            onClick={handlePrev}
            title="Попереднє фото (←)"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* The Image */}
        <div className="corp-lightbox-image-wrap" onClick={e => e.stopPropagation()}>
          <img
            src={imageUrl}
            alt={imageName}
            className="corp-lightbox-image"
          />
        </div>

        {/* Next Button */}
        {images.length > 1 && (
          <button
            type="button"
            className="corp-lightbox-nav-btn next"
            onClick={handleNext}
            title="Наступне фото (→)"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </div>
  )

  return createPortal(lightboxContent, document.body)
}

