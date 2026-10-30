import { useState, useCallback } from 'react'

const MAX_IMAGE_EDGE = 1600
const TARGET_IMAGE_BYTES = 350 * 1024 // ~350 KB
const MAX_DOC_BYTES = 25 * 1024 * 1024 // 25 MB

const loadImage = (file) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = URL.createObjectURL(file)
})

const canvasToBlob = (canvas, type, quality) => new Promise(resolve => {
  canvas.toBlob(resolve, type, quality)
})

export const compressImageClient = async (file) => {
  const isImage = (file?.type && file.type.startsWith('image/')) ||
    /\.(webp|jpg|jpeg|png|gif|svg|avif|bmp|ico)$/i.test(file?.name || '')
  if (!isImage) {
    throw new Error('Файл не є зображенням')
  }

  const img = await loadImage(file)
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height
  let edge = MAX_IMAGE_EDGE
  let quality = 0.65
  let blob = null
  let mime = 'image/webp'

  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, edge / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetWidth, targetHeight)
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

    blob = await canvasToBlob(canvas, mime, quality)
    if (!blob || blob.size === 0) {
      mime = 'image/jpeg'
      blob = await canvasToBlob(canvas, mime, quality)
    }

    width = targetWidth
    height = targetHeight

    if (blob && blob.size <= TARGET_IMAGE_BYTES) break

    quality = Math.max(0.35, quality - 0.1)
    edge = Math.max(900, Math.round(edge * 0.85))
  }

  URL.revokeObjectURL(img.src)
  if (!blob) throw new Error('Не вдалося стиснути зображення')

  const originalSize = file.size
  const compressedSize = blob.size
  const savingsPercent = Math.max(0, Math.round((1 - compressedSize / originalSize) * 100))
  const cleanName = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.${mime === 'image/webp' ? 'webp' : 'jpg'}`

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    mime,
    width,
    height,
    originalSize,
    compressedSize,
    savingsPercent,
    name: cleanName
  }
}

export function useCorporateAttachmentManager() {
  const [attachments, setAttachments] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  const addFiles = useCallback(async (fileList) => {
    if (!fileList || fileList.length === 0) return
    setIsProcessing(true)
    setError(null)

    const newItems = []
    for (const file of Array.from(fileList)) {
      try {
        const isImage = (file.type && file.type.startsWith('image/')) ||
          /\.(webp|jpg|jpeg|png|gif|svg|avif|bmp|ico)$/i.test(file.name || '')

        if (isImage) {
          const compressed = await compressImageClient(file)
          newItems.push({
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: 'image',
            file: compressed.blob,
            name: compressed.name,
            mime: compressed.mime || 'image/webp',
            previewUrl: compressed.previewUrl,
            originalSize: compressed.originalSize,
            compressedSize: compressed.compressedSize,
            savingsPercent: compressed.savingsPercent
          })
        } else {
          if (file.size > MAX_DOC_BYTES) {
            throw new Error(`Файл ${file.name} перевищує ліміт 25 МБ`)
          }
          newItems.push({
            id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: 'file',
            file,
            name: file.name,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            previewUrl: null
          })
        }
      } catch (err) {
        console.warn('[Attachment Manager] File processing error:', err)
        setError(err.message)
      }
    }

    setAttachments(prev => [...prev, ...newItems])
    setIsProcessing(false)
  }, [])

  const removeAttachment = useCallback((id) => {
    setAttachments(prev => {
      const item = prev.find(a => a.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter(a => a.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    attachments.forEach(a => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    })
    setAttachments([])
    setError(null)
  }, [attachments])

  return {
    attachments,
    isProcessing,
    error,
    addFiles,
    removeAttachment,
    clearAll
  }
}

