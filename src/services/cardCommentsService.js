import { supabase } from '../supabase'
import { compressImageClient } from '../modules/Corporate/hooks/useCorporateImageCompressor'

const STORAGE_BUCKET = 'chat-attachments'

/**
 * Extracts the comments array from card_info string.
 * Supports both [CARD_COMMENTS:[...]] and [COMMENTS:[...]].
 */
export function parseCardComments(cardInfo = '') {
  const info = String(cardInfo || '')
  let markerIdx = info.indexOf('[CARD_COMMENTS:')
  let markerPrefix = '[CARD_COMMENTS:'
  if (markerIdx === -1) {
    markerIdx = info.indexOf('[COMMENTS:')
    markerPrefix = '[COMMENTS:'
  }
  if (markerIdx === -1) return []

  const jsonStart = info.indexOf('[', markerIdx + markerPrefix.length - 1)
  if (jsonStart === -1) return []

  let depth = 0
  let jsonEnd = -1
  for (let i = jsonStart; i < info.length; i++) {
    if (info[i] === '[') depth++
    else if (info[i] === ']') {
      depth--
      if (depth === 0) {
        jsonEnd = i
        break
      }
    }
  }

  if (jsonEnd === -1) return []

  try {
    const parsed = JSON.parse(info.slice(jsonStart, jsonEnd + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Strips any existing [CARD_COMMENTS:...] or [COMMENTS:...] tags from card_info.
 */
export function stripCardComments(cardInfo = '') {
  let info = String(cardInfo || '')
  const markers = ['[CARD_COMMENTS:', '[COMMENTS:']

  for (const marker of markers) {
    let markerIdx = info.indexOf(marker)
    while (markerIdx !== -1) {
      const jsonStart = info.indexOf('[', markerIdx + marker.length - 1)
      if (jsonStart === -1) {
        const simpleEnd = info.indexOf(']', markerIdx)
        if (simpleEnd !== -1) {
          info = `${info.slice(0, markerIdx)}${info.slice(simpleEnd + 1)}`
        }
        break
      }

      let depth = 0
      let jsonEnd = -1
      for (let i = jsonStart; i < info.length; i++) {
        if (info[i] === '[') depth++
        else if (info[i] === ']') {
          depth--
          if (depth === 0) {
            jsonEnd = i
            break
          }
        }
      }

      if (jsonEnd === -1) break

      const markerEnd = info[jsonEnd + 1] === ']' ? jsonEnd + 2 : jsonEnd + 1
      info = `${info.slice(0, markerIdx)}${info.slice(markerEnd)}`
      markerIdx = info.indexOf(marker)
    }
  }

  return info.replace(/\s{2,}/g, ' ').trim()
}

/**
 * Re-serializes the card_info string with updated comments array.
 */
export function serializeCardComments(existingCardInfo = '', comments = []) {
  const base = stripCardComments(existingCardInfo)
  if (!comments || comments.length === 0) return base
  return `${base} [CARD_COMMENTS:${JSON.stringify(comments)}]`.trim()
}

/**
 * Converts a Blob or File to a base64 Data URL.
 */
const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(blob)
})

/**
 * Uploads a comment photo to Supabase Storage with image compression,
 * falling back to Base64 Data URL if storage upload fails or is offline.
 */
export async function uploadCommentPhoto(file, cardId = 'card') {
  if (!file) return null

  let uploadBlob = file
  let fileName = file.name || 'photo.jpg'
  let mimeType = file.type || 'image/jpeg'

  // 1. Client-side image compression
  try {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const compressed = await compressImageClient(file)
      if (compressed?.blob) {
        uploadBlob = compressed.blob
        fileName = compressed.cleanName || fileName
        mimeType = compressed.mime || mimeType
      }
    }
  } catch (compErr) {
    console.warn('[CommentPhoto] Client compression skipped, using raw file:', compErr)
  }

  const timestamp = Date.now()
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `card-comments/${cardId}/${timestamp}_${cleanName}`
  let photoUrl = null

  // 2. Try Supabase Storage upload
  try {
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, uploadBlob, {
        contentType: mimeType,
        cacheControl: '31536000',
        upsert: false
      })

    if (!uploadError) {
      // Long-lived signed URL (1 year)
      const { data: signedData, error: signError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

      if (!signError && signedData?.signedUrl) {
        photoUrl = signedData.signedUrl
      } else {
        const { data: publicData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath)
        photoUrl = publicData?.publicUrl || null
      }
    } else {
      console.warn('[CommentPhoto] Storage upload failed, falling back to base64:', uploadError)
    }
  } catch (storageErr) {
    console.warn('[CommentPhoto] Storage exception, falling back to base64:', storageErr)
  }

  // 3. Fallback to Base64 Data URL if storage upload failed
  if (!photoUrl) {
    try {
      photoUrl = await blobToBase64(uploadBlob)
    } catch (b64Err) {
      console.error('[CommentPhoto] Base64 fallback failed:', b64Err)
      throw new Error('Не вдалося зберегти фото')
    }
  }

  return {
    id: `photo_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
    url: photoUrl,
    name: fileName,
    size: uploadBlob.size || file.size || 0,
    type: mimeType,
    path: storagePath
  }
}

/**
 * Saves a new comment to a work card:
 * 1. Appends comment to work_cards.card_info tag [CARD_COMMENTS:[...]]
 * 2. Writes an entry to work_card_history
 * 3. Writes to work_card_comments table if available
 */
export async function saveCardComment({
  card,
  authorName = 'Працівник',
  authorRole = 'Цех №1',
  authorId = null,
  text = '',
  photos = [],
  stage = null,
  machine = null
}) {
  if (!card?.id) {
    throw new Error('Не вказано картку для додавання коментаря')
  }

  const cleanText = String(text || '').trim()
  if (!cleanText && (!photos || photos.length === 0)) {
    throw new Error('Коментар не може бути порожнім')
  }

  const existingComments = parseCardComments(card.card_info)
  const nowIso = new Date().toISOString()
  const commentId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const newComment = {
    id: commentId,
    card_id: card.id,
    author_id: authorId,
    author_name: authorName,
    author_role: authorRole,
    stage: stage || card.operation || 'Цех №1',
    machine: machine || card.machine || null,
    text: cleanText,
    photos: Array.isArray(photos) ? photos : [],
    created_at: nowIso
  }

  const updatedComments = [...existingComments, newComment]
  const updatedCardInfo = serializeCardComments(card.card_info, updatedComments)

  // 1. Update work_cards
  const { error: cardErr } = await supabase
    .from('work_cards')
    .update({ card_info: updatedCardInfo })
    .eq('id', card.id)

  if (cardErr) {
    console.error('[saveCardComment] Failed to update work_cards:', cardErr)
    throw cardErr
  }

  // 2. Insert into work_card_history
  try {
    const summaryComment = `[КОМЕНТАР] ${cleanText.slice(0, 100)}${cleanText.length > 100 ? '...' : ''}${photos.length ? ` (📷 ${photos.length} фото)` : ''}`
    await supabase
      .from('work_card_history')
      .insert([{
        card_id: card.id,
        nomenclature_id: card.nomenclature_id,
        stage_name: `Коментар (${newComment.stage})`,
        operator_name: `${authorName}${authorRole ? ` (${authorRole})` : ''}`,
        qty_at_start: card.quantity || 0,
        qty_completed: card.quantity || 0,
        scrap_qty: 0,
        started_at: nowIso,
        completed_at: nowIso,
        shift_name: card.shift_name || null,
        manager_name: card.manager_name || null,
        machine_name: card.machine || null,
        qc_scrap_comment: summaryComment,
        card_info: updatedCardInfo
      }])
  } catch (histErr) {
    console.warn('[saveCardComment] Failed to record in work_card_history (non-fatal):', histErr)
  }

  // 3. Attempt to record in work_card_comments table
  try {
    await supabase
      .from('work_card_comments')
      .insert([{
        id: commentId,
        card_id: card.id,
        task_id: card.task_id || null,
        order_id: card.order_id || null,
        author_id: authorId,
        author_name: authorName,
        author_role: authorRole,
        stage: newComment.stage,
        machine: newComment.machine,
        content: cleanText,
        photos: newComment.photos,
        created_at: nowIso
      }])
  } catch (tblErr) {
    // If table doesn't exist yet, non-fatal since card_info already holds the source of truth
    console.warn('[saveCardComment] work_card_comments table insert skipped/failed:', tblErr)
  }

  return {
    newComment,
    updatedComments,
    updatedCardInfo
  }
}

