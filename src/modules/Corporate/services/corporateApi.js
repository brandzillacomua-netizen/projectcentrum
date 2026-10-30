import { supabase } from '../../../supabase'
import {
  encryptCorporateText,
  decryptCorporatePost,
  decryptCorporatePostList,
  decryptCorporateComment,
  decryptCorporateCommentList
} from '../../../utils/corporateCrypto'

const STORAGE_BUCKET = 'chat-attachments'

const blobToBase64 = (blobOrFile) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blobOrFile)
  })
}

/**
 * Uploads an attachment to Supabase Storage and returns its signed or base64 data URL
 */
export const uploadAttachment = async (attachment, folder = 'posts') => {
  const timestamp = Date.now()
  const cleanFileName = (attachment.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `corporate/${folder}/${timestamp}_${cleanFileName}`

  let storageUrl = null

  // 1. Try uploading to Supabase Storage ('chat-attachments' bucket)
  if (attachment.file) {
    try {
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, attachment.file, {
          contentType: attachment.mime || 'application/octet-stream',
          cacheControl: '31536000',
          upsert: false
        })

      if (!uploadError) {
        // Since chat-attachments is private, create a long-lived signed URL (1 year)
        const { data: signedData, error: signError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 365)

        if (!signError && signedData?.signedUrl) {
          storageUrl = signedData.signedUrl
        } else {
          const { data: publicData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(path)
          storageUrl = publicData?.publicUrl || ''
        }
      } else {
        console.warn('[CorporateStorage] Direct storage upload failed, falling back to base64:', uploadError)
      }
    } catch (storageErr) {
      console.warn('[CorporateStorage] Storage upload exception:', storageErr)
    }
  }

  if (storageUrl) {
    return {
      url: storageUrl,
      path,
      name: attachment.name,
      type: attachment.type,
      size: attachment.compressedSize || attachment.size,
      mime: attachment.mime
    }
  }

  // 2. Fallback: For images or files if storage fails, convert to self-contained Base64 data URL
  // NEVER store a temporary blob: URL in the database because it gets revoked when the window closes!
  if (attachment.file) {
    try {
      const base64Url = await blobToBase64(attachment.file)
      return {
        url: base64Url,
        name: attachment.name,
        type: attachment.type,
        size: attachment.compressedSize || attachment.size,
        mime: attachment.mime
      }
    } catch (b64Err) {
      console.warn('[CorporateStorage] Base64 fallback error:', b64Err)
    }
  }

  return {
    url: '',
    name: attachment.name,
    type: attachment.type,
    size: attachment.compressedSize || attachment.size,
    mime: attachment.mime
  }
}

/**
 * Resolves attachment URLs (e.g. re-signing storage paths or discarding revoked blob URLs)
 */
export const resolveAttachmentUrls = async (attachments = []) => {
  if (!Array.isArray(attachments) || attachments.length === 0) return []

  return Promise.all(
    attachments.map(async (att) => {
      if (!att) return att

      // Discard revoked local blob: URLs from older buggy uploads
      if (att.url && String(att.url).startsWith('blob:')) {
        if (att.path) {
          try {
            const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(att.path, 60 * 60 * 24 * 7)
            if (data?.signedUrl) return { ...att, url: data.signedUrl }
          } catch (_) {}
        }
        return { ...att, url: '' }
      }

      // If it has a storage path but the URL is not a full URL or expired, re-sign it
      if (att.path && (!att.url || (!String(att.url).startsWith('http') && !String(att.url).startsWith('data:')))) {
        try {
          const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(att.path, 60 * 60 * 24 * 7)
          if (data?.signedUrl) return { ...att, url: data.signedUrl }
        } catch (_) {}
      }

      return att
    })
  )
}

export const corporateApi = {
  // ── Posts (Feed) ──────────────────────────────────────────────────────────
  fetchPosts: async () => {
    try {
      const { data, error } = await supabase
        .from('corporate_posts')
        .select(`
          *,
          author:author_id(id, login, first_name, last_name, avatar, position),
          acks:corporate_post_acks(user_id, acknowledged_at)
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('[CorporateApi] fetchPosts note:', error.message)
        return []
      }
      const decrypted = decryptCorporatePostList(data || [])
      return Promise.all(
        decrypted.map(async (post) => {
          if (Array.isArray(post.attachments) && post.attachments.length > 0) {
            post.attachments = await resolveAttachmentUrls(post.attachments)
          }
          return post
        })
      )
    } catch (e) {
      console.warn('[CorporateApi] fetchPosts error:', e)
      return []
    }
  },

  createPost: async (postData, rawAttachments = []) => {
    // 1. Upload attachments
    const uploadedAttachments = []
    for (const att of rawAttachments) {
      const res = await uploadAttachment(att, 'posts')
      uploadedAttachments.push(res)
    }

    const payload = {
      author_id: postData.author_id,
      title: postData.title ? encryptCorporateText(postData.title, 'post_title') : '',
      content: encryptCorporateText(postData.content, 'post_content'),
      category: postData.category || 'discussion',
      is_pinned: Boolean(postData.is_pinned),
      requires_ack: Boolean(postData.requires_ack),
      target_audience: postData.target_audience || 'all',
      attachments: uploadedAttachments,
      mentioned_user_ids: postData.mentioned_user_ids || []
    }

    const { data, error } = await supabase
      .from('corporate_posts')
      .insert([payload])
      .select(`
        *,
        author:author_id(id, login, first_name, last_name, avatar, position),
        acks:corporate_post_acks(user_id, acknowledged_at)
      `)
      .single()

    if (error) throw error
    return decryptCorporatePost(data)
  },

  deletePost: async (postId) => {
    const { error } = await supabase
      .from('corporate_posts')
      .delete()
      .eq('id', postId)
    if (error) throw error
    return true
  },

  togglePinPost: async (postId, isPinned) => {
    const { error } = await supabase
      .from('corporate_posts')
      .update({ is_pinned: !isPinned })
      .eq('id', postId)
    if (error) throw error
    return !isPinned
  },

  // ── Acknowledgment («Ознайомлений») ───────────────────────────────────────
  toggleAcknowledgePost: async (postId, userId) => {
    // Check if already acked
    const { data: existing } = await supabase
      .from('corporate_post_acks')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('corporate_post_acks')
        .delete()
        .eq('id', existing.id)
      return false
    } else {
      await supabase
        .from('corporate_post_acks')
        .insert([{ post_id: postId, user_id: userId, acknowledged_at: new Date().toISOString() }])
      return true
    }
  },

  fetchPostAcksList: async (postId) => {
    const { data, error } = await supabase
      .from('corporate_post_acks')
      .select('*, user:user_id(id, first_name, last_name, login, position, avatar)')
      .eq('post_id', postId)
      .order('acknowledged_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // ── Comments ──────────────────────────────────────────────────────────────
  fetchComments: async (postId) => {
    try {
      const { data, error } = await supabase
        .from('corporate_comments')
        .select('*, author:author_id(id, login, first_name, last_name, avatar, position)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) return []
      const decrypted = decryptCorporateCommentList(data || [])
      return Promise.all(
        decrypted.map(async (comment) => {
          if (Array.isArray(comment.attachments) && comment.attachments.length > 0) {
            comment.attachments = await resolveAttachmentUrls(comment.attachments)
          }
          return comment
        })
      )
    } catch (e) {
      return []
    }
  },

  createComment: async (postId, commentData, rawAttachments = []) => {
    const uploadedAttachments = []
    for (const att of rawAttachments) {
      const res = await uploadAttachment(att, 'comments')
      uploadedAttachments.push(res)
    }

    const payload = {
      post_id: postId,
      author_id: commentData.author_id,
      content: encryptCorporateText(commentData.content, 'comment_content'),
      attachments: uploadedAttachments,
      mentioned_user_ids: commentData.mentioned_user_ids || []
    }

    const { data, error } = await supabase
      .from('corporate_comments')
      .insert([payload])
      .select('*, author:author_id(id, login, first_name, last_name, avatar, position)')
      .single()

    if (error) throw error
    return decryptCorporateComment(data)
  },

  // ── Tasks (Задачник) ──────────────────────────────────────────────────────
  fetchTasks: async () => {
    try {
      const { data, error } = await supabase
        .from('corporate_tasks')
        .select(`
          *,
          assignee:assignee_id(id, login, first_name, last_name, avatar, position),
          creator:creator_id(id, login, first_name, last_name, avatar, position)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('[CorporateApi] fetchTasks note:', error.message)
        return []
      }
      return data || []
    } catch (e) {
      console.warn('[CorporateApi] fetchTasks error:', e)
      return []
    }
  },

  createTask: async (taskData) => {
    const payload = {
      title: taskData.title,
      description: taskData.description || '',
      assignee_id: taskData.assignee_id,
      creator_id: taskData.creator_id,
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      deadline: taskData.deadline || null,
      checklist: taskData.checklist || [],
      post_id: taskData.post_id || null
    }

    const { data, error } = await supabase
      .from('corporate_tasks')
      .insert([payload])
      .select(`
        *,
        assignee:assignee_id(id, login, first_name, last_name, avatar, position),
        creator:creator_id(id, login, first_name, last_name, avatar, position)
      `)
      .single()

    if (error) throw error
    return data
  },

  updateTaskStatus: async (taskId, status) => {
    const { error } = await supabase
      .from('corporate_tasks')
      .update({ 
        status,
        completed_at: status === 'done' ? new Date().toISOString() : null
      })
      .eq('id', taskId)

    if (error) throw error
    return status
  },

  updateTaskChecklist: async (taskId, checklist) => {
    const { error } = await supabase
      .from('corporate_tasks')
      .update({ checklist })
      .eq('id', taskId)

    if (error) throw error
    return checklist
  },

  deleteTask: async (taskId) => {
    const { error } = await supabase
      .from('corporate_tasks')
      .delete()
      .eq('id', taskId)

    if (error) throw error
    return true
  }
}

