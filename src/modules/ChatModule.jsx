import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings as SettingsIcon,
  Trash2,
  Users,
  X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMES } from '../MESContext'
import { sendPushToUsers } from '../services/pushService'

const CHAT_BUCKET = 'chat-attachments'
const MAX_IMAGE_EDGE = 1280
const TARGET_IMAGE_BYTES = 350 * 1024
const HARD_IMAGE_BYTES = 950 * 1024

const formatUserName = (user) => {
  if (!user) return 'Користувач'
  const fullName = [user.last_name, user.first_name].filter(Boolean).join(' ').trim()
  return fullName || user.login || 'Користувач'
}

const getUserAvatar = (user) => {
  return user?.avatar || user?.notification_settings?.avatar || ''
}

const getInitials = (nameOrUser) => {
  const name = typeof nameOrUser === 'string' ? nameOrUser : formatUserName(nameOrUser)
  const parts = name.split(/\s+/).filter(Boolean)
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase()
}

const getAvatarGradient = (value = '') => {
  switch (value) {
    case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)'
    case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)'
    case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)'
    case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)'
    case 'orange': return 'linear-gradient(135deg, #ff9000, #ff5500)'
    default: return 'linear-gradient(135deg, #1f2937, #111827)'
  }
}

const ChatAvatar = ({ src, label, size = 'small' }) => {
  const [failed, setFailed] = useState(false)
  const canUseImage = src && !failed && (src.startsWith('data:image/') || src.startsWith('http') || src.startsWith('/'))

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (canUseImage) {
    return <img src={src} alt={label} onError={() => setFailed(true)} />
  }

  return (
    <span className={`chat-initials-avatar ${size}`} style={{ background: getAvatarGradient(src) }}>
      {getInitials(label)}
    </span>
  )
}

const formatTime = (value) => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  } catch {
    return ''
  }
}

const bytesToLabel = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

const loadImage = (file) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = URL.createObjectURL(file)
})

const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => {
  canvas.toBlob(resolve, type, quality)
})

const compressImage = async (file) => {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Можна надсилати тільки фото')
  }

  const img = await loadImage(file)
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height
  let edge = MAX_IMAGE_EDGE
  let quality = 0.58
  let blob = null
  let mime = 'image/webp'

  for (let attempt = 0; attempt < 9; attempt += 1) {
    const scale = Math.min(1, edge / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, targetWidth, targetHeight)
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

    blob = await canvasToBlob(canvas, mime, quality)
    if (!blob || blob.size === 0) {
      mime = 'image/jpeg'
      blob = await canvasToBlob(canvas, mime, quality)
    }

    width = targetWidth
    height = targetHeight

    if (blob && (blob.size <= TARGET_IMAGE_BYTES || (blob.size <= HARD_IMAGE_BYTES && quality <= 0.38))) {
      break
    }

    if (quality > 0.34) {
      quality = Math.max(0.34, quality - 0.08)
    } else {
      edge = Math.max(720, Math.round(edge * 0.82))
    }
  }

  URL.revokeObjectURL(img.src)

  if (!blob) throw new Error('Не вдалося стиснути фото')

  return {
    blob,
    mime,
    width,
    height,
    originalSize: file.size,
    compressedSize: blob.size,
    name: `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.${mime === 'image/webp' ? 'webp' : 'jpg'}`
  }
}

const compressAvatar = async (file) => {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Можна вибрати тільки фото')
  }

  const img = await loadImage(file)
  const sourceWidth = img.naturalWidth || img.width
  const sourceHeight = img.naturalHeight || img.height
  const cropSize = Math.min(sourceWidth, sourceHeight)
  const sx = Math.max(0, Math.round((sourceWidth - cropSize) / 2))
  const sy = Math.max(0, Math.round((sourceHeight - cropSize) / 2))
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 320
  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, 320, 320)
  ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, 320, 320)

  let quality = 0.72
  let blob = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    blob = await canvasToBlob(canvas, 'image/webp', quality)
    if (blob && blob.size <= 90 * 1024) break
    quality = Math.max(0.42, quality - 0.1)
  }

  URL.revokeObjectURL(img.src)
  if (!blob) throw new Error('Не вдалося підготувати аватарку')

  return {
    blob,
    mime: 'image/webp',
    size: blob.size,
    previewUrl: URL.createObjectURL(blob),
    name: `${file.name.replace(/\.[^.]+$/, '') || 'avatar'}.webp`
  }
}

const ChatModule = () => {
  const { currentUser, systemUsers, supabase } = useMES()
  const navigate = useNavigate()
  const [threads, setThreads] = useState([])
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [composer, setComposer] = useState('')
  const [pendingImage, setPendingImage] = useState(null)
  const [error, setError] = useState('')
  const [readHorizon, setReadHorizon] = useState(null)
  const [search, setSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [showThreadSettings, setShowThreadSettings] = useState(false)
  const [settingsTitle, setSettingsTitle] = useState('')
  const [settingsUserSearch, setSettingsUserSearch] = useState('')
  const [settingsUserIds, setSettingsUserIds] = useState([])
  const [settingsAvatar, setSettingsAvatar] = useState(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const activeThreadIdRef = useRef(null)
  const meIdRef = useRef(null)

  const me = useMemo(() => ({
    id: currentUser?.id,
    login: currentUser?.login || '',
    name: formatUserName(currentUser)
  }), [currentUser])
  const isSuperAdmin = currentUser?.position === 'Адмін' || currentUser?.role === 'admin'

  const users = useMemo(() => {
    return (systemUsers || [])
      .filter(u => u?.id && u.id !== me.id && (u.login || u.first_name || u.last_name))
      .sort((a, b) => formatUserName(a).localeCompare(formatUserName(b), 'uk'))
  }, [me.id, systemUsers])

  const activeThread = useMemo(() => {
    return threads.find(t => t.id === activeThreadId) || null
  }, [threads, activeThreadId])

  const activeParticipants = useMemo(() => {
    return participants.filter(p => p.thread_id === activeThreadId)
  }, [participants, activeThreadId])

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId
  }, [activeThreadId])

  useEffect(() => {
    meIdRef.current = me.id
  }, [me.id])

  const getThreadAvatar = (thread) => {
    if (!thread) return ''
    if (thread.avatar_url) return thread.avatar_url

    const rows = participants.filter(p => p.thread_id === thread.id)
    const other = rows.find(p => p.user_id !== me.id)
    if (!other) return ''

    const user = (systemUsers || []).find(u => u.id === other.user_id || u.login === other.user_login)
    return getUserAvatar(user)
  }

  const getThreadDisplayTitle = (thread) => {
    if (!thread) return ''
    const rows = participants.filter(p => p.thread_id === thread.id)
    if (rows.length === 2) {
      const other = rows.find(p => p.user_id !== me.id)
      if (other?.user_name) return other.user_name
    }
    return thread.title || 'Чат'
  }

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return threads
    return threads.filter(t => {
      const names = participants
        .filter(p => p.thread_id === t.id)
        .map(p => p.user_name)
        .join(' ')
      return `${getThreadDisplayTitle(t)} ${t.title || ''} ${t.last_message || ''} ${names}`.toLowerCase().includes(q)
    })
  }, [participants, search, threads])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    const selected = users.filter(user => selectedUserIds.includes(user.id))
    const matches = !q ? users : users.filter(user => {
      const haystack = [
        formatUserName(user),
        user.first_name,
        user.last_name,
        user.login,
        user.position,
        user.department,
        user.shift
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })

    const merged = [...selected]
    matches.forEach(user => {
      if (!merged.some(existing => existing.id === user.id)) merged.push(user)
    })
    return merged
  }, [selectedUserIds, userSearch, users])

  const settingsFilteredUsers = useMemo(() => {
    const q = settingsUserSearch.trim().toLowerCase()
    const selected = users.filter(user => settingsUserIds.includes(user.id))
    const matches = !q ? users : users.filter(user => {
      const haystack = [
        formatUserName(user),
        user.first_name,
        user.last_name,
        user.login,
        user.position,
        user.department,
        user.shift
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })

    const merged = [...selected]
    matches.forEach(user => {
      if (!merged.some(existing => existing.id === user.id)) merged.push(user)
    })
    return merged
  }, [settingsUserIds, settingsUserSearch, users])

  const scrollToBottom = (options = {}) => {
    const { instant = false } = options
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'end' })
    })
  }

  const showSetupError = (err) => {
    const message = err?.message || String(err)
    if (message.includes('chat_threads') || message.includes('chat_messages') || message.includes('chat_participants')) {
      setError('Чат ще не підготовлений у базі. Застосуй міграцію 20260711130000_chat_module.sql.')
      return
    }
    setError(message)
  }

  const loadThreads = async (options = {}) => {
    const { silent = false } = options
    if (!silent) setLoadingThreads(true)
    setError('')
    try {
      const { data: threadRows, error: threadError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('is_archived', false)
        .order('updated_at', { ascending: false })

      if (threadError) throw threadError

      const { data: participantRows, error: participantError } = await supabase
        .from('chat_participants')
        .select('*')
        .order('created_at', { ascending: true })

      if (participantError) throw participantError

      // Для кожного чату паралельно дістаємо точну кількість нечитаних повідомлень
      const threadsWithUnread = await Promise.all((threadRows || []).map(async thread => {
        const rows = (participantRows || []).filter(p => p.thread_id === thread.id)
        const myPart = rows.find(p => String(p.user_id) === String(me.id))
        
        let unreadCount = 0
        if (myPart) {
          const numericMyId = Number(me.id) || me.id
          let query = supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('thread_id', thread.id)
            .is('deleted_at', null)
            .not('sender_id', 'eq', numericMyId)

          if (myPart.last_read_at) {
            const formattedIsoRead = new Date(myPart.last_read_at).toISOString()
            query = query.gt('created_at', formattedIsoRead)
          }
          
          const { count } = await query
          unreadCount = count || 0
        }
        return {
          ...thread,
          unreadCount
        }
      }))

      const visibleThreads = threadsWithUnread.filter(thread => {
        const rows = (participantRows || []).filter(p => p.thread_id === thread.id)
        return rows.length === 0 || rows.some(p => String(p.user_id) === String(me.id))
      })

      setThreads(visibleThreads)
      setParticipants(participantRows || [])
      setActiveThreadId(prev => {
        if (prev && visibleThreads.some(t => t.id === prev)) return prev
        return null
      })
    } catch (err) {
      console.error(err)
      showSetupError(err)
    } finally {
      if (!silent) setLoadingThreads(false)
    }
  }

  const loadMessages = async (threadId, options = {}) => {
    const { silent = false } = options
    if (!threadId) {
      setMessages([])
      return
    }
    if (!silent) setLoadingMessages(true)
    setError('')
    try {
      const { data, error: msgError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(300)

      if (msgError) throw msgError
      const nextMessages = data || []
      
      const isInitialLoad = messages.length === 0
      setMessages(nextMessages)
      
      if (nextMessages.length > 0) {
        scrollToBottom({ instant: isInitialLoad })
      }
    } catch (err) {
      console.error(err)
      showSetupError(err)
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }

  useEffect(() => {
    if (!me.id) return
    loadThreads()
  }, [me.id])

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId, { silent: true })
      
      // Capture the current read horizon before updating the database
      // so we know where to place the "Нові повідомлення" divider
      const myPart = participants.find(p => p.thread_id === activeThreadId && String(p.user_id) === String(me.id))
      setReadHorizon(myPart?.last_read_at ? new Date(myPart.last_read_at).getTime() : null)

      // Позначаємо чат прочитаним лише при безпосередньому відкритті/перемиканні
      if (me.id) {
        const numericMyId = Number(me.id) || me.id
        supabase
          .from('chat_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('thread_id', activeThreadId)
          .eq('user_id', numericMyId)
          .then(() => {
            loadThreads({ silent: true })
          })
      }
    } else {
      setMessages([])
      setReadHorizon(null)
    }
  }, [activeThreadId])

  useEffect(() => {
    if (!activeThreadId) return undefined

    const channel = supabase
      .channel(`chat-thread-${activeThreadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${activeThreadId}`
      }, (payload) => {
        const incoming = payload.new
        if (!incoming || incoming.deleted_at) return
        setMessages(prev => {
          if (prev.some(message => message.id === incoming.id)) return prev
          const next = [...prev, incoming].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          return next
        })
        scrollToBottom()
        loadThreads({ silent: true })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${activeThreadId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') return
        loadMessages(activeThreadId, { silent: true })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_threads'
      }, (payload) => {
        loadThreads({ silent: true })
        const changedThreadId = payload.new?.id || payload.old?.id
        if (changedThreadId === activeThreadId) {
          loadMessages(activeThreadId, { silent: true })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThreadId])

  useEffect(() => {
    if (!me.id) return undefined

    const channel = supabase
      .channel(`chat-list-${me.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_threads'
      }, () => {
        loadThreads({ silent: true })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${me.id}`
      }, () => {
        loadThreads({ silent: true })
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, () => {
        loadThreads({ silent: true })
      })
      .subscribe()

    const handleVisibleRefresh = () => {
      if (document.visibilityState === 'visible') {
        loadThreads()
        if (activeThreadIdRef.current) loadMessages(activeThreadIdRef.current, { silent: true })
      }
    }

    document.addEventListener('visibilitychange', handleVisibleRefresh)
    window.addEventListener('focus', handleVisibleRefresh)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibleRefresh)
      window.removeEventListener('focus', handleVisibleRefresh)
      supabase.removeChannel(channel)
    }
  }, [me.id])

  const createThread = async () => {
    if (selectedUserIds.length === 0) return

    const selectedUsers = selectedUserIds
      .map(userId => users.find(u => u.id === userId))
      .filter(Boolean)
    const fallbackTitle = selectedUsers.length === 1
      ? formatUserName(selectedUsers[0])
      : selectedUsers.map(formatUserName).slice(0, 3).join(', ') + (selectedUsers.length > 3 ? ` +${selectedUsers.length - 3}` : '')
    const title = newTitle.trim() || fallbackTitle || 'Новий чат'

    const memberIds = Array.from(new Set([me.id, ...selectedUserIds])).filter(Boolean)
    if (memberIds.length < 2) return

    setSending(true)
    setError('')
    try {
      const { data: threadRows, error: threadError } = await supabase
        .from('chat_threads')
        .insert([{
          title,
          thread_type: 'group',
          created_by: me.id || null,
          created_by_login: me.login,
          created_by_name: me.name,
          last_message: 'Чат створено',
          last_message_at: new Date().toISOString()
        }])
        .select()

      if (threadError) throw threadError

      const thread = threadRows?.[0]
      if (!thread?.id) throw new Error('Не вдалося створити чат')

      const rows = memberIds.map(userId => {
        const user = users.find(u => u.id === userId) || currentUser
        return {
          thread_id: thread.id,
          user_id: userId,
          user_login: user?.login || '',
          user_name: formatUserName(user),
          last_read_at: userId === me.id ? new Date().toISOString() : null
        }
      })

      const { error: partError } = await supabase
        .from('chat_participants')
        .insert(rows)

      if (partError) throw partError

      setShowNewChat(false)
      setNewTitle('')
      setUserSearch('')
      setSelectedUserIds([])
      await loadThreads()
      setActiveThreadId(thread.id)
    } catch (err) {
      console.error(err)
      showSetupError(err)
    } finally {
      setSending(false)
    }
  }

  const handleFile = async (file) => {
    if (!file) return
    setError('')
    try {
      const compressed = await compressImage(file)
      const previewUrl = URL.createObjectURL(compressed.blob)
      setPendingImage(prev => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return { ...compressed, previewUrl }
      })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Не вдалося підготувати фото')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const clearPendingImage = () => {
    setPendingImage(prev => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  const uploadPendingImage = async (threadId) => {
    if (!pendingImage) return null
    const ext = pendingImage.mime === 'image/webp' ? 'webp' : 'jpg'
    const path = `${threadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(CHAT_BUCKET)
      .upload(path, pendingImage.blob, {
        contentType: pendingImage.mime,
        cacheControl: '31536000',
        upsert: false
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path)
    return {
      url: data?.publicUrl || '',
      path,
      type: pendingImage.mime,
      name: pendingImage.name,
      size: pendingImage.compressedSize,
      width: pendingImage.width,
      height: pendingImage.height
    }
  }

  const sendMessage = async () => {
    if (!activeThreadId || sending) return
    const text = composer.trim()
    if (!text && !pendingImage) return

    setSending(true)
    setError('')
    try {
      const attachment = await uploadPendingImage(activeThreadId)
      const { error: sendError } = await supabase
        .from('chat_messages')
        .insert([{
          thread_id: activeThreadId,
          sender_id: me.id || null,
          sender_login: me.login,
          sender_name: me.name,
          body: text || null,
          attachment_url: attachment?.url || null,
          attachment_path: attachment?.path || null,
          attachment_type: attachment?.type || null,
          attachment_name: attachment?.name || null,
          attachment_size: attachment?.size || null,
          image_width: attachment?.width || null,
          image_height: attachment?.height || null
        }])

      if (sendError) throw sendError

      const notifyUserIds = activeParticipants
        .map(p => p.user_id)
        .filter(userId => userId && userId !== me.id)

      if (notifyUserIds.length > 0) {
        const preview = text || (attachment ? '[Фото]' : 'Нове повідомлення')
        const shortPreview = preview.length > 140 ? `${preview.slice(0, 137)}...` : preview
        const isDirectChat = activeParticipants.length === 2
        sendPushToUsers(
          Array.from(new Set(notifyUserIds)),
          isDirectChat ? me.name : (activeThread?.title || 'Нове повідомлення в чаті'),
          `${me.name}: ${shortPreview}`,
          '/chat',
          {
            tag: `chat-${activeThreadId}-${Date.now()}`,
            type: 'chat_message',
            threadId: activeThreadId,
            senderId: me.id,
            senderName: me.name
          }
        ).catch(err => console.warn('[Chat] Push notification failed:', err))
      }

      setComposer('')
      clearPendingImage()
      await loadMessages(activeThreadId, { silent: true })
      await loadThreads({ silent: true })
    } catch (err) {
      console.error(err)
      const message = err?.message || String(err)
      if (message.toLowerCase().includes('bucket') || message.toLowerCase().includes('storage')) {
        setError('Фото не завантажилось. Перевір, що міграція створила bucket chat-attachments і storage policies.')
      } else {
        showSetupError(err)
      }
    } finally {
      setSending(false)
    }
  }

  const archiveThread = async () => {
    if (!activeThreadId || !window.confirm('Архівувати цей чат?')) return
    setSending(true)
    try {
      const { error: archiveError } = await supabase
        .from('chat_threads')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', activeThreadId)

      if (archiveError) throw archiveError
      setActiveThreadId(null)
      await loadThreads()
    } catch (err) {
      console.error(err)
      showSetupError(err)
    } finally {
      setSending(false)
    }
  }

  const openThreadSettings = () => {
    if (!activeThread) return
    setSettingsTitle(activeThread.title || '')
    setSettingsUserSearch('')
    setSettingsUserIds(activeParticipants.map(p => p.user_id).filter(id => id && id !== me.id))
    setSettingsAvatar(null)
    setShowThreadSettings(true)
  }

  const handleAvatarFile = async (file) => {
    if (!file) return
    setError('')
    try {
      const compressed = await compressAvatar(file)
      setSettingsAvatar(prev => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return compressed
      })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Не вдалося підготувати аватарку')
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const uploadThreadAvatar = async (threadId) => {
    if (!settingsAvatar) return null
    const path = `${threadId}/avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
    const { error: uploadError } = await supabase.storage
      .from(CHAT_BUCKET)
      .upload(path, settingsAvatar.blob, {
        contentType: settingsAvatar.mime,
        cacheControl: '31536000',
        upsert: false
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path)
    return {
      avatar_url: data?.publicUrl || '',
      avatar_path: path,
      avatar_type: settingsAvatar.mime,
      avatar_size: settingsAvatar.size
    }
  }

  const saveThreadSettings = async () => {
    if (!activeThreadId || settingsSaving) return
    const cleanTitle = settingsTitle.trim()
    if (!cleanTitle) {
      setError('Назва групи не може бути порожньою')
      return
    }

    setSettingsSaving(true)
    setError('')
    try {
      const avatarUpdate = await uploadThreadAvatar(activeThreadId)
      const updatePayload = {
        title: cleanTitle,
        updated_at: new Date().toISOString(),
        ...(avatarUpdate || {})
      }

      const { error: threadError } = await supabase
        .from('chat_threads')
        .update(updatePayload)
        .eq('id', activeThreadId)

      if (threadError) throw threadError

      const wantedIds = Array.from(new Set([me.id, ...settingsUserIds])).filter(Boolean)
      const existingRows = participants.filter(p => p.thread_id === activeThreadId)
      const existingIds = existingRows.map(p => p.user_id).filter(Boolean)
      const toAdd = wantedIds.filter(id => !existingIds.includes(id))
      const toRemove = existingIds.filter(id => id !== me.id && !wantedIds.includes(id))

      if (toAdd.length > 0) {
        const rows = toAdd.map(userId => {
          const user = users.find(u => u.id === userId) || currentUser
          return {
            thread_id: activeThreadId,
            user_id: userId,
            user_login: user?.login || '',
            user_name: formatUserName(user),
            last_read_at: null
          }
        })
        const { error: addError } = await supabase.from('chat_participants').insert(rows)
        if (addError) throw addError
      }

      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('chat_participants')
          .delete()
          .eq('thread_id', activeThreadId)
          .in('user_id', toRemove)
        if (removeError) throw removeError
      }

      setShowThreadSettings(false)
      setSettingsAvatar(prev => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        return null
      })
      await loadThreads()
      await loadMessages(activeThreadId)
    } catch (err) {
      console.error(err)
      const message = err?.message || String(err)
      if (message.toLowerCase().includes('avatar_')) {
        setError('Потрібно застосувати міграцію 20260711140000_chat_thread_settings.sql для аватарок груп.')
      } else if (message.toLowerCase().includes('bucket') || message.toLowerCase().includes('storage')) {
        setError('Аватарка не завантажилась. Перевір bucket chat-attachments і storage policies.')
      } else {
        showSetupError(err)
      }
    } finally {
      setSettingsSaving(false)
    }
  }

  const toggleSelectedUser = (id) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const toggleSettingsUser = (id) => {
    setSettingsUserIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  return (
    <div className="chat-module">
      <div className="chat-shell">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-head">
            <div className="chat-title-row">
              {isSuperAdmin && (
                <button className="icon-btn system-menu" onClick={() => navigate('/')} title="До системи">
                  <Menu size={18} />
                </button>
              )}
              <div>
                <div className="eyebrow"><MessageCircle size={14} /> Внутрішній чат</div>
                <h1>Чат</h1>
              </div>
            </div>
            <button className="icon-btn accent" onClick={() => setShowNewChat(true)} title="Новий чат">
              <Plus size={18} />
            </button>
          </div>

          <div className="search-box">
            <Search size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук чату..." />
          </div>

          <div className="thread-list">
            {loadingThreads ? (
              <div className="empty-state"><Loader2 className="spin" size={20} /> Завантаження...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="empty-state">Немає чатів</div>
            ) : filteredThreads.map(thread => {
              const rows = participants.filter(p => p.thread_id === thread.id)
              const threadAvatar = getThreadAvatar(thread)
              const displayTitle = getThreadDisplayTitle(thread)
              
              // Визначаємо нечитані повідомлення
              const myParticipant = rows.find(p => String(p.user_id) === String(me.id))
              const isUnread = thread.unreadCount > 0

              return (
                <button
                  key={thread.id}
                  className={`thread-card ${thread.id === activeThreadId ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <div className="thread-icon">
                    <ChatAvatar src={threadAvatar} label={displayTitle} />
                  </div>
                  <div className="thread-main">
                    <div className="thread-title">{displayTitle}</div>
                    <div className="thread-last">{thread.last_message || `${rows.length} учасн.`}</div>
                  </div>
                  <div className="thread-time-col">
                    <div className="thread-time">{formatTime(thread.last_message_at || thread.updated_at)}</div>
                    {thread.unreadCount > 0 && (
                      <span className="unread-badge" title={`${thread.unreadCount} нових повідомлень`}>
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="chat-main">
          {activeThread ? (
            <>
              {(() => {
                const activeAvatar = getThreadAvatar(activeThread)
                const activeTitle = getThreadDisplayTitle(activeThread)
                return (
              <header className="chat-header">
                <button className="icon-btn mobile-back" onClick={() => setActiveThreadId(null)} title="До списку чатів">
                  <ArrowLeft size={18} />
                </button>
                <div className="active-chat-title">
                  <div className="active-chat-avatar">
                    <ChatAvatar src={activeAvatar} label={activeTitle} size="large" />
                  </div>
                  <div>
                    <h2>{activeTitle}</h2>
                    <div className="participants-line">
                      {activeParticipants.map(p => p.user_name).join(', ') || 'Без обмеження учасників'}
                    </div>
                  </div>
                </div>
                <div className="chat-header-actions">
                  <button className="icon-btn" onClick={openThreadSettings} title="Налаштування групи" disabled={sending}>
                    <SettingsIcon size={17} />
                  </button>
                  <button className="icon-btn danger" onClick={archiveThread} title="Архівувати чат" disabled={sending}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </header>
                )
              })()}

              {error && <div className="error-box">{error}</div>}

              <section className="messages-panel">
                {loadingMessages ? (
                  <div className="empty-state"><Loader2 className="spin" size={20} /> Завантаження повідомлень...</div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">Тут ще немає повідомлень</div>
                ) : messages.map((message, index) => {
                  const isMine = message.sender_id === me.id
                  const msgTime = new Date(message.created_at).getTime()
                  
                  let showUnreadDivider = false
                  if (readHorizon && msgTime > readHorizon) {
                    const prevMsg = messages[index - 1]
                    const prevTime = prevMsg ? new Date(prevMsg.created_at).getTime() : 0
                    if (prevTime <= readHorizon) {
                      showUnreadDivider = true
                    }
                  }

                  return (
                    <React.Fragment key={message.id}>
                      {showUnreadDivider && (
                        <div className="unread-divider">
                          <span>Нові повідомлення</span>
                        </div>
                      )}
                      <div className={`message-row ${isMine ? 'mine' : ''}`}>
                        <div className="message-wrapper">
                          {!isMine && <div className="message-author">{message.sender_name}</div>}
                          <div className="message-bubble">
                            {message.attachment_url && (
                              <button
                                type="button"
                                className="message-image-link"
                                onClick={() => setImagePreview({
                                  url: message.attachment_url,
                                  name: message.attachment_name || 'Фото',
                                  size: message.attachment_size,
                                  time: message.created_at,
                                  sender: message.sender_name
                                })}
                              >
                                <img src={message.attachment_url} alt={message.attachment_name || 'Фото'} />
                              </button>
                            )}
                            {message.body && <div className="message-text">{message.body}</div>}
                          </div>
                          <div className="message-meta">
                            {message.attachment_size ? <span className="meta-size">{bytesToLabel(message.attachment_size)}</span> : null}
                            <span className="meta-time">{formatTime(message.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  )
                })}
                <div ref={messagesEndRef} />
              </section>

              <footer className="composer">
                {pendingImage && (
                  <div className="pending-image">
                    <img src={pendingImage.previewUrl} alt="Підготовлене фото" />
                    <div>
                      <b>{pendingImage.name}</b>
                      <span>
                        {bytesToLabel(pendingImage.originalSize)} → {bytesToLabel(pendingImage.compressedSize)}
                      </span>
                    </div>
                    <button className="icon-btn" onClick={clearPendingImage} title="Прибрати фото">
                      <X size={16} />
                    </button>
                  </div>
                )}
                <div className="composer-row">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => handleFile(e.target.files?.[0])}
                    style={{ display: 'none' }}
                  />
                  <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Додати фото" disabled={sending}>
                    <ImageIcon size={18} />
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
            </>
          ) : (
            <div className="no-chat">
              <MessageCircle size={42} />
              <h2>Вибери чат або створи новий</h2>
              {error && <div className="error-box">{error}</div>}
              <button className="primary-btn" onClick={() => setShowNewChat(true)}>
                <Plus size={18} /> Новий чат
              </button>
            </div>
          )}
        </main>
      </div>

      {showNewChat && (
        <div className="modal-backdrop">
          <div className="new-chat-modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow"><Users size={14} /> Учасники</div>
                <h3>Новий чат</h3>
              </div>
              <button
                className="icon-btn"
                onClick={() => {
                  setShowNewChat(false)
                  setUserSearch('')
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="member-search">
              <Search size={16} />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Пошук людини..."
                autoFocus
              />
              {userSearch && (
                <button className="mini-clear" onClick={() => setUserSearch('')} title="Очистити пошук">
                  <X size={14} />
                </button>
              )}
            </div>
            <input
              className="title-input"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder={selectedUserIds.length > 1 ? 'Назва групи (необовʼязково)...' : 'Назва чату підтягнеться з вибраної людини'}
            />
            <div className="users-picker">
              {filteredUsers.length === 0 ? (
                <div className="empty-state compact">Нікого не знайдено</div>
              ) : filteredUsers.map(user => {
                const selected = selectedUserIds.includes(user.id)
                return (
                  <button
                    key={user.id}
                    className={`user-pick ${selected ? 'selected' : ''}`}
                    onClick={() => toggleSelectedUser(user.id)}
                  >
                    <span className="user-pick-main">
                      <b>{formatUserName(user)}</b>
                      <small>{[user.position, user.department, user.login].filter(Boolean).join(' · ')}</small>
                    </span>
                    {selected ? <Check size={16} /> : <Plus size={15} />}
                  </button>
                )
              })}
            </div>
            <button className="create-btn" onClick={createThread} disabled={sending || selectedUserIds.length === 0}>
              {sending ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
              {selectedUserIds.length > 1 ? `Створити групу (${selectedUserIds.length})` : 'Створити чат'}
            </button>
          </div>
        </div>
      )}

      {showThreadSettings && activeThread && (
        <div className="modal-backdrop">
          <div className="new-chat-modal settings-modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow"><SettingsIcon size={14} /> Налаштування</div>
                <h3>Група</h3>
              </div>
              <button
                className="icon-btn"
                onClick={() => {
                  setShowThreadSettings(false)
                  setSettingsAvatar(prev => {
                    if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
                    return null
                  })
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="avatar-editor">
              <div className="group-avatar-preview">
                {settingsAvatar?.previewUrl ? (
                  <img src={settingsAvatar.previewUrl} alt="Нова аватарка" />
                ) : activeThread.avatar_url ? (
                  <ChatAvatar src={activeThread.avatar_url} label={getThreadDisplayTitle(activeThread)} size="xlarge" />
                ) : (
                  <ChatAvatar src="" label={getThreadDisplayTitle(activeThread)} size="xlarge" />
                )}
              </div>
              <div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => handleAvatarFile(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
                <button className="secondary-btn" onClick={() => avatarInputRef.current?.click()} disabled={settingsSaving}>
                  <ImageIcon size={16} /> Змінити аватарку
                </button>
                <span className="avatar-hint">
                  {settingsAvatar ? `Стиснуто до ${bytesToLabel(settingsAvatar.size)}` : 'Фото буде обрізане в квадрат і стиснуте'}
                </span>
              </div>
            </div>

            <input
              className="title-input"
              value={settingsTitle}
              onChange={e => setSettingsTitle(e.target.value)}
              placeholder="Назва групи..."
            />

            <div className="member-search">
              <Search size={16} />
              <input
                value={settingsUserSearch}
                onChange={e => setSettingsUserSearch(e.target.value)}
                placeholder="Додати або знайти учасника..."
              />
              {settingsUserSearch && (
                <button className="mini-clear" onClick={() => setSettingsUserSearch('')} title="Очистити пошук">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="member-count">
              Учасників: {settingsUserIds.length + 1}
            </div>

            <div className="users-picker settings-users">
              {settingsFilteredUsers.length === 0 ? (
                <div className="empty-state compact">Нікого не знайдено</div>
              ) : settingsFilteredUsers.map(user => {
                const selected = settingsUserIds.includes(user.id)
                return (
                  <button
                    key={user.id}
                    className={`user-pick ${selected ? 'selected' : ''}`}
                    onClick={() => toggleSettingsUser(user.id)}
                  >
                    <span className="user-pick-main">
                      <b>{formatUserName(user)}</b>
                      <small>{[user.position, user.department, user.login].filter(Boolean).join(' · ')}</small>
                    </span>
                    {selected ? <Check size={16} /> : <Plus size={15} />}
                  </button>
                )
              })}
            </div>

            <button className="create-btn" onClick={saveThreadSettings} disabled={settingsSaving || !settingsTitle.trim()}>
              {settingsSaving ? <Loader2 className="spin" size={18} /> : <Check size={18} />} Зберегти налаштування
            </button>
          </div>
        </div>
      )}

      {imagePreview && (
        <div className="image-preview-backdrop" onClick={() => setImagePreview(null)}>
          <div className="image-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="image-preview-head">
              <div>
                <b>{imagePreview.sender}</b>
                <span>{[bytesToLabel(imagePreview.size), formatTime(imagePreview.time)].filter(Boolean).join(' · ')}</span>
              </div>
              <button className="icon-btn" onClick={() => setImagePreview(null)} title="Закрити">
                <X size={18} />
              </button>
            </div>
            <img src={imagePreview.url} alt={imagePreview.name} />
          </div>
        </div>
      )}

      <style>{`
        .chat-module {
          min-height: 100vh;
          background: #060607;
          color: #fff;
          font-family: 'Outfit', 'Inter', system-ui, sans-serif;
          padding: 18px;
        }
        .chat-shell {
          height: calc(100vh - 36px);
          display: grid;
          grid-template-columns: minmax(300px, 360px) 1fr;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          overflow: hidden;
          background: #0b0b0c;
          min-height: 0;
        }
        .chat-sidebar {
          border-right: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: #080809;
        }
        .chat-sidebar-head,
        .chat-header {
          min-height: 76px;
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .mobile-back {
          display: none;
        }
        .chat-title-row {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .system-menu {
          background: #101012;
          color: #60a5fa;
          border-color: rgba(96,165,250,0.24);
        }
        .system-menu:hover {
          background: rgba(59,130,246,0.16);
          border-color: rgba(96,165,250,0.5);
          color: #bfdbfe;
        }
        .eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #3b82f6;
          font-size: 0.68rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0;
          margin-bottom: 4px;
        }
        h1, h2, h3 {
          margin: 0;
          letter-spacing: 0;
        }
        h1 { font-size: 1.85rem; }
        h2 { font-size: 1.2rem; }
        h3 { font-size: 1.25rem; }
        button {
          font-family: inherit;
        }
        .icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: #121214;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 0 0 auto;
        }
        .icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .icon-btn.accent {
          background: #3b82f6;
          color: #fff;
          border-color: #3b82f6;
        }
        .icon-btn.danger:hover {
          background: rgba(239,68,68,0.16);
          border-color: rgba(239,68,68,0.45);
          color: #ef4444;
        }
        .search-box {
          height: 42px;
          margin: 14px;
          padding: 0 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #666;
          background: #101012;
        }
        .search-box input,
        .title-input,
        .composer textarea {
          width: 100%;
          border: 0;
          outline: none;
          background: transparent;
          color: #fff;
          font: inherit;
        }
        .thread-list {
          overflow-y: auto;
          padding: 0 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .thread-card {
          width: 100%;
          min-height: 68px;
          display: grid;
          grid-template-columns: 38px 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255,255,255,0.015);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          position: relative;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .thread-card:hover {
          background: rgba(255,255,255,0.04);
          transform: translateY(-1px);
        }
        .thread-card.unread {
          border-color: rgba(59, 130, 246, 0.4);
          background: rgba(59, 130, 246, 0.08);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.05);
        }
        .thread-card.unread .thread-title {
          font-weight: 900;
          color: #fff;
        }
        .thread-card.unread .thread-last {
          color: #ddd;
          font-weight: 800;
        }
        .thread-time-col {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          min-width: 65px;
        }
        .unread-badge {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: #fff;
          font-size: 0.65rem;
          font-weight: 900;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 10px rgba(59, 130, 246, 0.4);
          animation: pulse-badge 2s infinite alternate;
        }
        @keyframes pulse-badge {
          from { transform: scale(1); box-shadow: 0 2px 10px rgba(59, 130, 246, 0.4); }
          to { transform: scale(1.05); box-shadow: 0 4px 14px rgba(59, 130, 246, 0.6); }
        }
        .thread-card.active {
          border-color: rgba(59,130,246,0.6);
          background: rgba(59,130,246,0.12);
          box-shadow: 0 0 0 1px rgba(59,130,246,0.2) inset;
        }
        .thread-icon {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: rgba(59,130,246,0.16);
          color: #60a5fa;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex: 0 0 auto;
        }
        .thread-icon img,
        .active-chat-avatar img,
        .group-avatar-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .chat-initials-avatar {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 950;
          letter-spacing: 0;
          text-transform: uppercase;
          user-select: none;
        }
        .chat-initials-avatar.small {
          font-size: 0.72rem;
        }
        .chat-initials-avatar.large {
          font-size: 0.82rem;
        }
        .chat-initials-avatar.xlarge {
          font-size: 1.15rem;
        }
        .thread-main {
          min-width: 0;
        }
        .thread-title {
          font-size: 0.9rem;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .thread-last,
        .participants-line,
        .thread-time,
        .message-meta {
          color: #777;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .thread-last {
          margin-top: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-main {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: #0b0b0c;
        }
        .active-chat-title {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .active-chat-title > div:last-child {
          min-width: 0;
        }
        .active-chat-title h2 {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .active-chat-avatar {
          width: 42px;
          height: 42px;
          border-radius: 8px;
          background: rgba(59,130,246,0.16);
          color: #60a5fa;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex: 0 0 auto;
        }
        .chat-header-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }
        .participants-line {
          max-width: 70vw;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 4px;
        }
        .messages-panel {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: radial-gradient(circle at center, rgba(59, 130, 246, 0.02) 0%, transparent 100%), #070708;
          scroll-behavior: smooth;
        }
        .messages-panel::-webkit-scrollbar {
          width: 8px;
        }
        .messages-panel::-webkit-scrollbar-track {
          background: transparent;
        }
        .messages-panel::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }
        .message-row {
          display: flex;
          justify-content: flex-start;
          animation: slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .message-row.mine {
          justify-content: flex-end;
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .message-wrapper {
          display: flex;
          flex-direction: column;
          max-width: min(680px, 75%);
        }
        .message-row.mine .message-wrapper {
          align-items: flex-end;
        }
        .message-bubble {
          border: 1px solid rgba(255,255,255,0.05);
          background: #141416;
          border-radius: 18px 18px 18px 4px;
          padding: 12px 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          backdrop-filter: blur(8px);
        }
        .message-row.mine .message-bubble {
          background: linear-gradient(135deg, rgba(59,130,246,0.25), rgba(37,99,235,0.15));
          border-color: rgba(59,130,246,0.3);
          border-radius: 18px 18px 4px 18px;
        }
        .message-author {
          font-size: 0.72rem;
          color: #93c5fd;
          font-weight: 800;
          margin-bottom: 4px;
          margin-left: 4px;
        }
        .message-text {
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 0.95rem;
          line-height: 1.5;
          letter-spacing: 0.2px;
        }
        .message-meta {
          display: flex;
          gap: 8px;
          margin-top: 4px;
          padding: 0 6px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .message-wrapper:hover .message-meta {
          opacity: 1;
        }
        .unread-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 16px 0;
          color: #3b82f6;
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .unread-divider::before,
        .unread-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
        }
        .unread-divider span {
          padding: 0 12px;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 12px;
          margin: 0 8px;
          line-height: 24px;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.1);
        }
        .message-image-link {
          display: block;
          margin-bottom: 8px;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: zoom-in;
          width: 100%;
          text-align: left;
        }
        .message-image-link img {
          display: block;
          max-width: 100%;
          max-height: 420px;
          border-radius: 8px;
          object-fit: contain;
          background: #050505;
        }
        .image-preview-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0,0,0,0.88);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }
        .image-preview-modal {
          max-width: min(1100px, 96vw);
          max-height: 94vh;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .image-preview-head {
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          color: #fff;
        }
        .image-preview-head b,
        .image-preview-head span {
          display: block;
        }
        .image-preview-head b {
          font-size: 0.88rem;
          font-weight: 900;
        }
        .image-preview-head span {
          margin-top: 2px;
          color: #888;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .image-preview-modal > img {
          max-width: 100%;
          max-height: calc(94vh - 58px);
          object-fit: contain;
          border-radius: 8px;
          background: #050505;
          box-shadow: 0 18px 80px rgba(0,0,0,0.65);
        }
        .composer {
          padding: 16px 24px;
          background: rgba(10, 10, 12, 0.85);
          backdrop-filter: blur(12px);
          position: sticky;
          bottom: 0;
          z-index: 5;
          flex: 0 0 auto;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .composer-row {
          display: grid;
          grid-template-columns: 42px 1fr 48px;
          gap: 12px;
          align-items: end;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
          padding: 6px;
          transition: border-color 0.2s;
        }
        .composer-row:focus-within {
          border-color: rgba(59,130,246,0.4);
          background: rgba(255,255,255,0.05);
        }
        .composer textarea {
          min-height: 24px;
          max-height: 140px;
          resize: none;
          padding: 12px 4px;
          border: 0;
          background: transparent;
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .composer textarea::-webkit-scrollbar {
          width: 4px;
        }
        .composer textarea::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
        }
        .send-btn,
        .primary-btn,
        .create-btn {
          height: 42px;
          border: 0;
          border-radius: 21px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: #fff;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(59,130,246,0.3);
        }
        .send-btn:hover:not(:disabled),
        .primary-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(59,130,246,0.4);
        }
        .composer-row .icon-btn {
          height: 42px;
          width: 42px;
          border-radius: 21px;
          border: 0;
          background: transparent;
        }
        .composer-row .icon-btn:hover {
          background: rgba(255,255,255,0.08);
        }
        .send-btn {
          width: 46px;
        }
        .send-btn:disabled,
        .create-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .pending-image {
          margin-bottom: 10px;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid rgba(59,130,246,0.28);
          background: rgba(59,130,246,0.08);
          display: grid;
          grid-template-columns: 52px 1fr 38px;
          gap: 10px;
          align-items: center;
        }
        .pending-image img {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          object-fit: cover;
        }
        .pending-image b,
        .pending-image span {
          display: block;
          font-size: 0.78rem;
        }
        .pending-image span {
          color: #7dd3fc;
          margin-top: 3px;
        }
        .empty-state,
        .no-chat {
          color: #777;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 140px;
          text-align: center;
        }
        .no-chat {
          flex: 1;
          flex-direction: column;
        }
        .no-chat h2 {
          color: #fff;
        }
        .error-box {
          margin: 12px 18px 0;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(239,68,68,0.35);
          background: rgba(239,68,68,0.1);
          color: #fecaca;
          font-size: 0.82rem;
          font-weight: 800;
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 18px;
        }
        .new-chat-modal {
          width: min(520px, 100%);
          max-height: 86vh;
          background: #101012;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .settings-modal {
          width: min(620px, 100%);
        }
        .modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .title-input {
          height: 44px;
          padding: 0 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: #080809;
        }
        .avatar-editor {
          display: grid;
          grid-template-columns: 76px 1fr;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: #080809;
        }
        .group-avatar-preview {
          width: 76px;
          height: 76px;
          border-radius: 8px;
          background: rgba(59,130,246,0.16);
          color: #60a5fa;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .secondary-btn {
          height: 38px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid rgba(59,130,246,0.35);
          background: rgba(59,130,246,0.12);
          color: #bfdbfe;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
        }
        .secondary-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .avatar-hint {
          display: block;
          margin-top: 6px;
          color: #777;
          font-size: 0.72rem;
          font-weight: 800;
        }
        .member-search {
          height: 42px;
          padding: 0 10px;
          display: grid;
          grid-template-columns: 18px 1fr 28px;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: #080809;
          color: #777;
        }
        .member-search input {
          min-width: 0;
          border: 0;
          outline: none;
          background: transparent;
          color: #fff;
          font: inherit;
        }
        .mini-clear {
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          color: #aaa;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .users-picker {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          max-height: 48vh;
          padding-right: 4px;
        }
        .settings-users {
          max-height: 36vh;
        }
        .member-count {
          color: #7dd3fc;
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }
        .user-pick {
          min-height: 42px;
          border: 1px solid rgba(255,255,255,0.08);
          background: #080809;
          color: #fff;
          border-radius: 8px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          font-weight: 800;
          text-align: left;
        }
        .user-pick-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .user-pick-main b,
        .user-pick-main small {
          display: block;
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-pick-main b {
          font-size: 0.84rem;
        }
        .user-pick-main small {
          color: #666;
          font-size: 0.65rem;
          font-weight: 800;
        }
        .user-pick.selected {
          border-color: rgba(22,163,74,0.45);
          color: #86efac;
          background: rgba(22,163,74,0.08);
        }
        .user-pick.selected .user-pick-main small {
          color: rgba(134,239,172,0.68);
        }
        .empty-state.compact {
          min-height: 70px;
        }
        .create-btn {
          width: 100%;
          background: #3b82f6;
        }
        .spin {
          animation: chat-spin 0.8s linear infinite;
        }
        @keyframes chat-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 860px) {
          .chat-module {
            padding: 0;
            width: 100vw;
            overflow: hidden;
          }
          .chat-shell {
            height: 100vh;
            height: 100dvh;
            width: 100vw;
            grid-template-columns: 1fr;
            border: 0;
            border-radius: 0;
          }
          .chat-sidebar {
            display: ${activeThread ? 'none' : 'flex'};
          }
          .chat-sidebar-head {
            min-height: 90px;
            padding: 18px 14px 18px ${isSuperAdmin ? '14px' : '74px'};
            gap: 10px;
          }
          .chat-sidebar-head h1 {
            font-size: 1.8rem;
            line-height: 1;
          }
          .chat-main {
            display: ${activeThread ? 'flex' : 'none'};
            min-width: 0;
          }
          .mobile-back {
            display: inline-flex;
          }
          .chat-header {
            min-height: 66px;
            padding: 10px 10px 10px 74px;
            gap: 8px;
            display: grid;
            grid-template-columns: 36px minmax(0, 1fr) auto;
            align-items: center;
          }
          .chat-header .icon-btn {
            width: 34px;
            height: 34px;
            border-radius: 8px;
          }
          .active-chat-title {
            gap: 8px;
            min-width: 0;
          }
          .active-chat-avatar {
            width: 36px;
            height: 36px;
            border-radius: 8px;
          }
          .active-chat-title h2 {
            max-width: 100%;
            font-size: 1rem;
            line-height: 1.08;
          }
          .participants-line {
            max-width: 100%;
            font-size: 0.62rem;
            margin-top: 2px;
          }
          .chat-header-actions {
            margin-left: 0;
            gap: 6px;
          }
          .messages-panel {
            padding: 12px 10px;
            gap: 9px;
          }
          .message-bubble {
            max-width: 86vw;
            padding: 9px;
          }
          .message-row.mine .message-bubble,
          .message-bubble {
            border-radius: 8px;
          }
          .message-image-link img {
            max-width: calc(86vw - 20px);
            max-height: 48vh;
          }
          .image-preview-backdrop {
            padding: 10px;
          }
          .image-preview-modal {
            max-width: 100vw;
            max-height: 96vh;
          }
          .image-preview-modal > img {
            max-height: calc(96vh - 56px);
          }
          .message-text {
            font-size: 0.9rem;
          }
          .message-author {
            font-size: 0.68rem;
          }
          .message-meta {
            font-size: 0.66rem;
          }
          .composer {
            padding: 8px 8px max(8px, env(safe-area-inset-bottom));
            box-shadow: 0 -8px 22px rgba(0,0,0,0.35);
          }
          .composer-row {
            grid-template-columns: 36px minmax(0, 1fr) 42px;
            gap: 8px;
          }
          .composer-row .icon-btn {
            width: 36px;
            height: 36px;
          }
          .composer textarea {
            min-height: 38px;
            padding: 10px;
            font-size: 0.86rem;
          }
          .send-btn {
            width: 42px;
            height: 38px;
          }
          .pending-image {
            grid-template-columns: 46px 1fr 36px;
          }
          .pending-image img {
            width: 46px;
            height: 46px;
          }
          .modal-backdrop {
            padding: 10px;
            align-items: flex-end;
          }
          .new-chat-modal {
            max-height: 92vh;
            width: 100%;
            padding: 14px;
          }
          .users-picker {
            max-height: 42vh;
          }
          .settings-users {
            max-height: 32vh;
          }
          .avatar-editor {
            grid-template-columns: 64px 1fr;
            padding: 10px;
          }
          .group-avatar-preview {
            width: 64px;
            height: 64px;
          }
        }
      `}</style>
    </div>
  )
}

export default ChatModule
