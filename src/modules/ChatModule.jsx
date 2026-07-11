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
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [composer, setComposer] = useState('')
  const [pendingImage, setPendingImage] = useState(null)
  const [error, setError] = useState('')
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
  const fileInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const me = useMemo(() => ({
    id: currentUser?.id,
    login: currentUser?.login || '',
    name: formatUserName(currentUser)
  }), [currentUser])

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

  const getThreadAvatar = (thread) => {
    if (!thread) return ''
    if (thread.avatar_url) return thread.avatar_url

    const rows = participants.filter(p => p.thread_id === thread.id)
    const other = rows.find(p => p.user_id !== me.id)
    if (!other) return ''

    const user = (systemUsers || []).find(u => u.id === other.user_id || u.login === other.user_login)
    return getUserAvatar(user)
  }

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return threads
    return threads.filter(t => {
      const names = participants
        .filter(p => p.thread_id === t.id)
        .map(p => p.user_name)
        .join(' ')
      return `${t.title} ${t.last_message || ''} ${names}`.toLowerCase().includes(q)
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

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
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

  const loadThreads = async () => {
    setLoadingThreads(true)
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

      const visibleThreads = (threadRows || []).filter(thread => {
        const rows = (participantRows || []).filter(p => p.thread_id === thread.id)
        return rows.length === 0 || rows.some(p => p.user_id === me.id)
      })

      setThreads(visibleThreads)
      setParticipants(participantRows || [])
      setActiveThreadId(prev => {
        if (prev && visibleThreads.some(t => t.id === prev)) return prev
        return visibleThreads[0]?.id || null
      })
    } catch (err) {
      console.error(err)
      showSetupError(err)
    } finally {
      setLoadingThreads(false)
    }
  }

  const loadMessages = async (threadId) => {
    if (!threadId) {
      setMessages([])
      return
    }
    setLoadingMessages(true)
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
      setMessages(data || [])
      scrollToBottom()

      if (me.id) {
        await supabase
          .from('chat_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('thread_id', threadId)
          .eq('user_id', me.id)
      }
    } catch (err) {
      console.error(err)
      showSetupError(err)
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    loadThreads()
  }, [me.id])

  useEffect(() => {
    loadMessages(activeThreadId)
  }, [activeThreadId])

  useEffect(() => {
    if (!activeThreadId) return undefined

    const channel = supabase
      .channel(`chat-thread-${activeThreadId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${activeThreadId}`
      }, () => {
        loadMessages(activeThreadId)
        loadThreads()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_threads'
      }, () => {
        loadThreads()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThreadId])

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
        sendPushToUsers(
          Array.from(new Set(notifyUserIds)),
          activeThread?.title || 'Нове повідомлення в чаті',
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
      await loadMessages(activeThreadId)
      await loadThreads()
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
              <button className="icon-btn system-menu" onClick={() => navigate('/')} title="До системи">
                <Menu size={18} />
              </button>
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
              return (
                <button
                  key={thread.id}
                  className={`thread-card ${thread.id === activeThreadId ? 'active' : ''}`}
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <div className="thread-icon">
                    {threadAvatar ? <img src={threadAvatar} alt={thread.title} /> : <Users size={16} />}
                  </div>
                  <div className="thread-main">
                    <div className="thread-title">{thread.title}</div>
                    <div className="thread-last">{thread.last_message || `${rows.length} учасн.`}</div>
                  </div>
                  <div className="thread-time">{formatTime(thread.last_message_at || thread.updated_at)}</div>
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
                return (
              <header className="chat-header">
                <button className="icon-btn mobile-back" onClick={() => setActiveThreadId(null)} title="До списку чатів">
                  <ArrowLeft size={18} />
                </button>
                <div className="active-chat-title">
                  <div className="active-chat-avatar">
                    {activeAvatar ? <img src={activeAvatar} alt={activeThread.title} /> : <Users size={17} />}
                  </div>
                  <div>
                    <h2>{activeThread.title}</h2>
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
                ) : messages.map(message => {
                  const isMine = message.sender_id === me.id
                  return (
                    <div key={message.id} className={`message-row ${isMine ? 'mine' : ''}`}>
                      <div className="message-bubble">
                        {!isMine && <div className="message-author">{message.sender_name}</div>}
                        {message.attachment_url && (
                          <a href={message.attachment_url} target="_blank" rel="noreferrer" className="message-image-link">
                            <img src={message.attachment_url} alt={message.attachment_name || 'Фото'} />
                          </a>
                        )}
                        {message.body && <div className="message-text">{message.body}</div>}
                        <div className="message-meta">
                          {message.attachment_size ? <span>{bytesToLabel(message.attachment_size)}</span> : null}
                          <span>{formatTime(message.created_at)}</span>
                        </div>
                      </div>
                    </div>
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
                  <img src={activeThread.avatar_url} alt={activeThread.title} />
                ) : (
                  <Users size={28} />
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
          gap: 10px;
          padding: 12px;
          background: #0f0f10;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
        }
        .thread-card.active {
          border-color: rgba(59,130,246,0.7);
          background: rgba(59,130,246,0.12);
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
          overflow-y: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background:
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            #09090a;
          background-size: 100% 32px;
        }
        .message-row {
          display: flex;
          justify-content: flex-start;
        }
        .message-row.mine {
          justify-content: flex-end;
        }
        .message-bubble {
          max-width: min(680px, 72%);
          border: 1px solid rgba(255,255,255,0.08);
          background: #141416;
          border-radius: 8px;
          padding: 10px;
        }
        .message-row.mine .message-bubble {
          background: rgba(59,130,246,0.18);
          border-color: rgba(59,130,246,0.28);
        }
        .message-author {
          font-size: 0.72rem;
          color: #60a5fa;
          font-weight: 900;
          margin-bottom: 6px;
        }
        .message-text {
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 0.94rem;
          line-height: 1.45;
        }
        .message-meta {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 6px;
        }
        .message-image-link {
          display: block;
          margin-bottom: 8px;
        }
        .message-image-link img {
          display: block;
          max-width: 100%;
          max-height: 420px;
          border-radius: 8px;
          object-fit: contain;
          background: #050505;
        }
        .composer {
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 12px;
          background: #0d0d0f;
        }
        .composer-row {
          display: grid;
          grid-template-columns: 38px 1fr 46px;
          gap: 10px;
          align-items: end;
        }
        .composer textarea {
          min-height: 42px;
          max-height: 120px;
          resize: vertical;
          padding: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: #151517;
        }
        .send-btn,
        .primary-btn,
        .create-btn {
          height: 42px;
          border: 0;
          border-radius: 8px;
          background: #16a34a;
          color: #fff;
          font-weight: 950;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
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
          }
          .chat-shell {
            height: 100vh;
            grid-template-columns: 1fr;
            border: 0;
            border-radius: 0;
          }
          .chat-sidebar {
            display: ${activeThread ? 'none' : 'flex'};
          }
          .chat-main {
            display: ${activeThread ? 'flex' : 'none'};
          }
          .mobile-back {
            display: inline-flex;
          }
          .message-bubble {
            max-width: 88%;
          }
          .participants-line {
            max-width: 62vw;
          }
        }
      `}</style>
    </div>
  )
}

export default ChatModule
