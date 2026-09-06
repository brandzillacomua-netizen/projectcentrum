import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMES } from '../../../MESContext.jsx'
import { sendPushToUsers } from '../../../services/pushService.js'
import { encryptChatMessage, decryptChatMessage, decryptMessageList } from '../../../utils/chatCrypto.js'
import {
  buildChannelParticipantRows,
  canPostToThread,
  isChannelThread,
  useChannelPolls,
  useChatReactions
} from '../ChatChannelModule.jsx'

const CHAT_BUCKET = 'chat-attachments'
const MAX_IMAGE_EDGE = 1280
const TARGET_IMAGE_BYTES = 350 * 1024
const HARD_IMAGE_BYTES = 950 * 1024

export const formatUserName = (user) => {
  if (!user) return 'Користувач'
  const fullName = [user.last_name, user.first_name].filter(Boolean).join(' ').trim()
  return fullName || user.login || 'Користувач'
}

export const getUserAvatar = (user) => {
  return user?.avatar || user?.notification_settings?.avatar || ''
}

export const getInitials = (nameOrUser) => {
  const name = typeof nameOrUser === 'string' ? nameOrUser : formatUserName(nameOrUser)
  const parts = name.split(/\s+/).filter(Boolean)
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase()
}

export const getAvatarGradient = (value = '') => {
  switch (value) {
    case 'purple': return 'linear-gradient(135deg, #a855f7, #6366f1)'
    case 'blue': return 'linear-gradient(135deg, #3b82f6, #06b6d4)'
    case 'emerald': return 'linear-gradient(135deg, #10b981, #059669)'
    case 'ruby': return 'linear-gradient(135deg, #f43f5e, #be123c)'
    case 'orange': return 'linear-gradient(135deg, #ff9000, #ff5500)'
    default: return 'linear-gradient(135deg, #1f2937, #111827)'
  }
}

export const getDirectThreadKey = (userIds) => {
  const key = userIds
    .map(userId => String(userId || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .join(':')
  return key ? `direct:${key}` : ''
}

export const formatMessageTime = (value) => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  } catch { return '' }
}

export const formatDateDivider = (value) => {
  if (!value) return ''
  try {
    const d = new Date(value)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (targetDate.getTime() === today.getTime()) return 'Сьогодні'
    if (targetDate.getTime() === yesterday.getTime()) return 'Вчора'
    const diffDays = Math.ceil(Math.abs(today - targetDate) / (1000 * 60 * 60 * 24))
    if (diffDays < 7) {
      return new Intl.DateTimeFormat('uk-UA', { weekday: 'long' }).format(d).replace(/^./, str => str.toUpperCase())
    }
    if (targetDate.getFullYear() === today.getFullYear()) {
      return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' }).format(d)
    }
    return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  } catch { return '' }
}

export const formatThreadTime = (value) => {
  if (!value) return ''
  try {
    const d = new Date(value)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (targetDate.getTime() === today.getTime()) {
      return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(d)
    }
    if (targetDate.getTime() === yesterday.getTime()) return 'Вчора'
    const diffDays = Math.ceil(Math.abs(today - targetDate) / (1000 * 60 * 60 * 24))
    if (diffDays < 7) {
      return new Intl.DateTimeFormat('uk-UA', { weekday: 'short' }).format(d).replace(/^./, str => str.toUpperCase())
    }
    return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' }).format(d)
  } catch { return '' }
}

export const bytesToLabel = (bytes) => {
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

export const compressImage = async (file) => {
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

export const compressAvatar = async (file) => {
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

export const useChatData = () => {
  const { currentUser, systemUsers, supabase, addManagementTask } = useMES()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [newChatType, setNewChatType] = useState('private')
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showPollModal, setShowPollModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignee: null })

  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const avatarInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const activeThreadIdRef = useRef(null)
  const meIdRef = useRef(null)
  const threadsRef = useRef([])
  const participantsRef = useRef([])
  const messagesRef = useRef([])
  const loadThreadsInFlightRef = useRef(null)
  const loadThreadsQueuedRef = useRef(false)
  const loadMessagesInFlightRef = useRef(new Map())
  const loadMessagesQueuedRef = useRef(new Map())
  const threadsReloadTimerRef = useRef(null)
  const messagesReloadTimersRef = useRef(new Map())
  const readReceiptTimersRef = useRef(new Map())
  const pendingReadReceiptsRef = useRef(new Map())
  const lastVisibilitySyncRef = useRef(0)
  const sidebarMessageIdsRef = useRef(new Set())
  const listSubscribedOnceRef = useRef(false)
  const wasInChat = useRef(false)
  const supportOpeningRef = useRef(false)

  const handleMobileBack = () => {
    if (window.history.state?.chatModuleOpen) {
      window.history.back()
    } else {
      setActiveThreadId(null)
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      setActiveThreadId(null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const inChat = !!activeThreadId
    if (inChat && !wasInChat.current) {
      window.history.pushState({ chatModuleOpen: true }, '')
    }
    wasInChat.current = inChat
  }, [activeThreadId])

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

  const canPostHere = canPostToThread({ thread: activeThread, currentUser, activeParticipants, systemUsers })
  const activeIsChannel = isChannelThread(activeThread)
  const { reactions, toggleReaction } = useChatReactions({ supabase, activeThreadId, messages, me })
  const { polls, createPoll, votePoll } = useChannelPolls({
    supabase,
    activeThreadId,
    messages,
    me
  })

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId
  }, [activeThreadId])

  useEffect(() => {
    meIdRef.current = me.id
  }, [me.id])

  useEffect(() => {
    threadsRef.current = threads
  }, [threads])

  useEffect(() => {
    participantsRef.current = participants
  }, [participants])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => () => {
    if (threadsReloadTimerRef.current) clearTimeout(threadsReloadTimerRef.current)
    messagesReloadTimersRef.current.forEach(timer => clearTimeout(timer))
    messagesReloadTimersRef.current.clear()

    readReceiptTimersRef.current.forEach(timer => clearTimeout(timer))
    readReceiptTimersRef.current.clear()
    const numericMyId = Number(meIdRef.current) || meIdRef.current
    if (numericMyId) {
      pendingReadReceiptsRef.current.forEach((lastReadAt, threadId) => {
        supabase
          .from('chat_participants')
          .update({ last_read_at: lastReadAt })
          .eq('thread_id', threadId)
          .eq('user_id', numericMyId)
          .then(({ error: readError }) => {
            if (readError) console.warn('[Chat] Failed to flush read receipt:', readError)
          })
      })
    }
    pendingReadReceiptsRef.current.clear()
  }, [supabase])

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
    const baseThreads = !q ? threads : threads.filter(t => {
      const names = participants
        .filter(p => p.thread_id === t.id)
        .map(p => p.user_name)
        .join(' ')
      return `${getThreadDisplayTitle(t)} ${t.title || ''} ${t.lastMessagePreview || t.last_message || ''} ${names}`.toLowerCase().includes(q)
    })
    return [...baseThreads].sort((a, b) => {
      const aPinned = a.is_pinned || isChannelThread(a)
      const bPinned = b.is_pinned || isChannelThread(b)
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      return new Date(b.last_message_at || b.updated_at || b.created_at || 0) - new Date(a.last_message_at || a.updated_at || a.created_at || 0)
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
    const { instant = false, isInitial = false, force = false } = options
    setTimeout(() => {
      const panel = document.querySelector('.messages-panel')
      let isScrolledUp = false
      if (panel) {
        isScrolledUp = (panel.scrollHeight - panel.scrollTop - panel.clientHeight) > 150
      }

      if (!isInitial && !force && isScrolledUp) {
        return
      }

      const unreadDivider = document.getElementById('unread-divider')
      if (isInitial && unreadDivider) {
        unreadDivider.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'center' })
      } else if (panel) {
        if (instant) {
          panel.scrollTop = panel.scrollHeight
        } else {
          panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' })
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'end' })
      }
    }, 20)
  }

  const showSetupError = (err) => {
    const message = err?.message || String(err)
    if (message.includes('chat_threads') || message.includes('chat_messages') || message.includes('chat_participants')) {
      setError('Чат ще не підготовлений у базі. Застосуй міграцію 20260711130000_chat_module.sql.')
      return
    }
    setError(message)
  }

  const signChatAttachment = async (message) => {
    if (!message?.attachment_url || message.attachment_type === 'channel_poll' || message.attachment_type === 'system_task') {
      return message
    }

    const path = message.attachment_path || message.attachment_url
    const looksLikeStoragePath = path && !String(path).startsWith('http')
    if (!looksLikeStoragePath) return message

    const { data, error } = await supabase.storage
      .from(CHAT_BUCKET)
      .createSignedUrl(path, 60 * 60)

    if (error) {
      console.warn('[Chat] Failed to sign attachment:', error)
      return { ...message, attachment_url: '' }
    }

    return {
      ...message,
      attachment_url: data?.signedUrl || '',
      attachment_path: path
    }
  }

  const signChatAttachments = async (rows = []) => {
    return Promise.all((rows || []).map(signChatAttachment))
  }

  const getMessagePreview = (message) => {
    if (!message) return ''
    const body = String(message.body || '').trim()
    if (body) return body.length > 120 ? `${body.slice(0, 117)}...` : body
    if (message.attachment_type === 'channel_poll') return '[Опитування]'
    if (message.attachment_type === 'system_task') return '[Завдання]'
    if (message.attachment_url || message.attachment_path) return '[Фото]'
    return '[Повідомлення]'
  }

  const getThreadPreview = (thread, message, rows) => {
    if (!message) return thread.last_message || `${rows.length} учасн.`

    const preview = getMessagePreview(message)
    const isMultiUserThread = rows.length > 2 || isChannelThread(thread)
    if (!isMultiUserThread) return preview

    if (String(message.sender_id) === String(me.id)) return `Ви: ${preview}`
    return `${message.sender_name || 'Учасник'}: ${preview}`
  }

  const performLoadThreads = async (options = {}) => {
    const { silent = false } = options
    if (!silent) setLoadingThreads(true)
    setError('')
    try {
      const { data: myParticipantRows, error: participantError } = await supabase
        .from('chat_participants')
        .select('*')
        .eq('user_id', me.id)
        .order('created_at', { ascending: true })
        .limit(500)

      if (participantError) throw participantError

      const membershipThreadIds = [...new Set((myParticipantRows || []).map(row => row.thread_id).filter(Boolean))]
      const threadRows = []
      for (let offset = 0; offset < membershipThreadIds.length; offset += 40) {
        const { data, error } = await supabase
          .from('chat_threads')
          .select('*')
          .in('id', membershipThreadIds.slice(offset, offset + 40))
          .eq('is_archived', false)
          .order('updated_at', { ascending: false })
        if (error) throw error
        threadRows.push(...(data || []))
      }

      const visibleBaseThreads = threadRows
        .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
        .slice(0, 200)
      const visibleThreadIds = visibleBaseThreads.map(thread => thread.id)
      const visibleThreadIdSet = new Set(visibleThreadIds.map(String))
      const visibleParticipantList = []
      for (let offset = 0; offset < visibleThreadIds.length; offset += 40) {
        const { data, error } = await supabase
          .from('chat_participants')
          .select('*')
          .in('thread_id', visibleThreadIds.slice(offset, offset + 40))
          .order('created_at', { ascending: true })
        if (error) throw error
        visibleParticipantList.push(...(data || []))
      }

      let unreadCountsByThread = null
      let messageRows = []
      if (visibleThreadIds.length > 0) {
        const rpcUserId = Number(me.id) || me.id
        const { data: unreadRows, error: unreadRpcError } = await supabase
          .rpc('chat_unread_counts', { p_user_id: rpcUserId })

        if (unreadRpcError) {
          const rpcErrorCode = String(unreadRpcError.code || '')
          const rpcErrorMessage = String(unreadRpcError.message || '').toLowerCase()
          const rpcIsUnavailable = ['PGRST202', '42883'].includes(rpcErrorCode) ||
            (rpcErrorMessage.includes('chat_unread_counts') && (
              rpcErrorMessage.includes('not find') ||
              rpcErrorMessage.includes('does not exist') ||
              rpcErrorMessage.includes('schema cache')
            ))
          if (!rpcIsUnavailable) {
            console.warn('[Chat] Unread counts are temporarily unavailable; keeping the last known values:', unreadRpcError)
            const previousUnreadCounts = new Map((threadsRef.current || []).map(thread => [
              String(thread.id),
              Number(thread.unreadCount) || 0
            ]))
            unreadCountsByThread = new Map(visibleThreadIds.map(threadId => [
              String(threadId),
              previousUnreadCounts.get(String(threadId)) || 0
            ]))
          }
        } else {
          unreadCountsByThread = new Map(visibleThreadIds.map(threadId => [String(threadId), 0]))
          ;(unreadRows || []).forEach(row => {
            const threadId = String(row.thread_id)
            if (visibleThreadIdSet.has(threadId)) {
              unreadCountsByThread.set(threadId, Number(row.unread_count) || 0)
            }
          })
        }

        if (!unreadCountsByThread) {
          const myVisibleParticipants = (myParticipantRows || [])
            .filter(row => visibleThreadIdSet.has(String(row.thread_id)))
          const validReadTimes = myVisibleParticipants
            .map(row => row.last_read_at ? new Date(row.last_read_at).getTime() : 0)
            .filter(value => Number.isFinite(value) && value > 0)
          const canBoundByReadTime = validReadTimes.length === myVisibleParticipants.length
          const oldestReadAt = canBoundByReadTime && validReadTimes.length > 0
            ? new Date(Math.min(...validReadTimes)).toISOString()
            : null

          for (let offset = 0; offset < visibleThreadIds.length && messageRows.length < 1000; offset += 40) {
            let query = supabase
              .from('chat_messages')
              .select('id, thread_id, sender_id, sender_name, body, attachment_url, attachment_path, attachment_type, created_at')
              .in('thread_id', visibleThreadIds.slice(offset, offset + 40))
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(Math.min(1000 - messageRows.length, 1000))
            if (oldestReadAt) query = query.gt('created_at', oldestReadAt)
            const { data, error } = await query
            if (error) throw error
            messageRows.push(...(data || []))
          }
        }

        const decryptedMessageRows = await decryptMessageList(messageRows)
        decryptedMessageRows.forEach(message => {
          if (message.id) sidebarMessageIdsRef.current.add(String(message.id))
        })
        while (sidebarMessageIdsRef.current.size > 5000) {
          const oldest = sidebarMessageIdsRef.current.values().next().value
          sidebarMessageIdsRef.current.delete(oldest)
        }
        messageRows = decryptedMessageRows
      }

      const messagesByThread = messageRows.reduce((map, message) => {
        const rows = map.get(message.thread_id) || []
        rows.push(message)
        map.set(message.thread_id, rows)
        return map
      }, new Map())

      const visibleThreads = visibleBaseThreads.map(thread => {
        const rows = visibleParticipantList.filter(p => p.thread_id === thread.id)
        const myPart = rows.find(p => String(p.user_id) === String(me.id))
        const threadMessages = messagesByThread.get(thread.id) || []
        const lastReadAt = myPart?.last_read_at ? new Date(myPart.last_read_at).getTime() : 0
        const unreadCount = unreadCountsByThread
          ? (unreadCountsByThread.get(String(thread.id)) || 0)
          : threadMessages.filter(message => {
              if (String(message.sender_id) === String(me.id)) return false
              if (!lastReadAt) return true
              return new Date(message.created_at).getTime() > lastReadAt
            }).length

        return {
          ...thread,
          unreadCount,
          lastMessageSenderId: threadMessages[0]?.sender_id || null,
          lastMessagePreview: getThreadPreview(thread, threadMessages[0], rows)
        }
      })

      if (meIdRef.current !== me.id) return
      threadsRef.current = visibleThreads
      participantsRef.current = visibleParticipantList
      setThreads(visibleThreads)
      setParticipants(visibleParticipantList)
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

  const loadThreads = async (options = {}) => {
    if (loadThreadsInFlightRef.current) {
      loadThreadsQueuedRef.current = true
      return loadThreadsInFlightRef.current
    }

    const request = performLoadThreads(options)
    loadThreadsInFlightRef.current = request
    try {
      return await request
    } finally {
      if (loadThreadsInFlightRef.current === request) loadThreadsInFlightRef.current = null
      if (loadThreadsQueuedRef.current) {
        loadThreadsQueuedRef.current = false
        if (threadsReloadTimerRef.current) clearTimeout(threadsReloadTimerRef.current)
        threadsReloadTimerRef.current = setTimeout(() => loadThreads({ silent: true }), 100)
      }
    }
  }

  const performLoadMessages = async (threadId, options = {}) => {
    const { silent = false, forceScroll = false } = options
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
      const signedMessages = await signChatAttachments(data || [])
      const nextMessages = await decryptMessageList(signedMessages, threadId)

      if (activeThreadIdRef.current !== threadId) return
      const isInitialLoad = messagesRef.current.length === 0
      messagesRef.current = nextMessages
      setMessages(nextMessages)

      if (nextMessages.length > 0) {
        scrollToBottom({ instant: isInitialLoad, isInitial: isInitialLoad, force: forceScroll })
      }
    } catch (err) {
      console.error(err)
      showSetupError(err)
    } finally {
      if (!silent && activeThreadIdRef.current === threadId) setLoadingMessages(false)
    }
  }

  const loadMessages = async (threadId, options = {}) => {
    const { forceScroll = false } = options
    const currentRequest = loadMessagesInFlightRef.current.get(threadId)
    if (currentRequest) {
      const queued = loadMessagesQueuedRef.current.get(threadId) || { forceScroll: false }
      loadMessagesQueuedRef.current.set(threadId, { forceScroll: queued.forceScroll || forceScroll })
      return currentRequest
    }

    const request = performLoadMessages(threadId, options)
    loadMessagesInFlightRef.current.set(threadId, request)
    try {
      return await request
    } finally {
      if (loadMessagesInFlightRef.current.get(threadId) === request) {
        loadMessagesInFlightRef.current.delete(threadId)
      }
      const queued = loadMessagesQueuedRef.current.get(threadId)
      if (queued) {
        loadMessagesQueuedRef.current.delete(threadId)
        const previousTimer = messagesReloadTimersRef.current.get(threadId)
        if (previousTimer) clearTimeout(previousTimer)
        const timer = setTimeout(() => {
          messagesReloadTimersRef.current.delete(threadId)
          if (activeThreadIdRef.current === threadId) {
            loadMessages(threadId, { silent: true, forceScroll: queued.forceScroll })
          }
        }, 100)
        messagesReloadTimersRef.current.set(threadId, timer)
      }
    }
  }

  const updateThreadsState = (updater) => {
    setThreads(previous => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      threadsRef.current = next
      return next
    })
  }

  const updateParticipantsState = (updater) => {
    setParticipants(previous => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      participantsRef.current = next
      return next
    })
  }

  const updateMessagesState = (updater) => {
    setMessages(previous => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      messagesRef.current = next
      return next
    })
  }

  const scheduleThreadsReload = (delay = 300) => {
    if (threadsReloadTimerRef.current) clearTimeout(threadsReloadTimerRef.current)
    threadsReloadTimerRef.current = setTimeout(() => {
      threadsReloadTimerRef.current = null
      loadThreads({ silent: true })
    }, delay)
  }

  const scheduleMessagesReload = (threadId, options = {}) => {
    if (!threadId) return
    const previousTimer = messagesReloadTimersRef.current.get(threadId)
    if (previousTimer) clearTimeout(previousTimer)
    const timer = setTimeout(() => {
      messagesReloadTimersRef.current.delete(threadId)
      if (activeThreadIdRef.current === threadId) {
        loadMessages(threadId, { silent: true, ...options })
      }
    }, options.delay ?? 250)
    messagesReloadTimersRef.current.set(threadId, timer)
  }

  const rememberSidebarMessage = (messageId) => {
    if (!messageId) return false
    const key = String(messageId)
    if (sidebarMessageIdsRef.current.has(key)) return true
    sidebarMessageIdsRef.current.add(key)
    if (sidebarMessageIdsRef.current.size > 5000) {
      const oldest = sidebarMessageIdsRef.current.values().next().value
      sidebarMessageIdsRef.current.delete(oldest)
    }
    return false
  }

  const isActiveThreadAtBottom = (threadId) => {
    if (String(activeThreadIdRef.current) !== String(threadId)) return false
    const panel = document.querySelector('.messages-panel')
    return !panel || (panel.scrollHeight - panel.scrollTop - panel.clientHeight) <= 150
  }

  const markThreadReadLocally = (threadId, readAt) => {
    updateParticipantsState(previous => previous.map(row => (
      String(row.thread_id) === String(threadId) && String(row.user_id) === String(meIdRef.current)
        ? { ...row, last_read_at: readAt }
        : row
    )))
    updateThreadsState(previous => previous.map(thread => (
      String(thread.id) === String(threadId) ? { ...thread, unreadCount: 0 } : thread
    )))
  }

  const scheduleReadReceipt = (threadId, readAt = new Date().toISOString(), delay = 250) => {
    if (!threadId || !meIdRef.current) return
    pendingReadReceiptsRef.current.set(threadId, readAt)
    markThreadReadLocally(threadId, readAt)

    const previousTimer = readReceiptTimersRef.current.get(threadId)
    if (previousTimer) clearTimeout(previousTimer)
    const timer = setTimeout(async () => {
      readReceiptTimersRef.current.delete(threadId)
      const latestReadAt = pendingReadReceiptsRef.current.get(threadId)
      pendingReadReceiptsRef.current.delete(threadId)
      const numericMyId = Number(meIdRef.current) || meIdRef.current
      const { error: readError } = await supabase
        .from('chat_participants')
        .update({ last_read_at: latestReadAt })
        .eq('thread_id', threadId)
        .eq('user_id', numericMyId)
      if (readError) console.warn('[Chat] Failed to update read receipt:', readError)
    }, delay)
    readReceiptTimersRef.current.set(threadId, timer)
  }

  const applyMessageToThreadList = async (message) => {
    if (!message?.thread_id || message.deleted_at || rememberSidebarMessage(message.id)) return
    const threadId = String(message.thread_id)
    if (!threadsRef.current.some(thread => String(thread.id) === threadId)) return

    let decryptedMsg = message
    if (message.body && typeof message.body === 'string' && message.body.startsWith('[ENC:v1:')) {
      const decryptedBody = await decryptChatMessage(message.body, threadId)
      decryptedMsg = { ...message, body: decryptedBody }
    }

    const isMine = String(message.sender_id) === String(meIdRef.current)
    const readImmediately = !isMine && isActiveThreadAtBottom(threadId)
    updateThreadsState(previous => previous.map(thread => {
      if (String(thread.id) !== threadId) return thread
      const rows = participantsRef.current.filter(row => String(row.thread_id) === threadId)
      return {
        ...thread,
        last_message: getMessagePreview(decryptedMsg),
        last_message_at: message.created_at || thread.last_message_at,
        updated_at: message.created_at || thread.updated_at,
        lastMessageSenderId: message.sender_id || null,
        lastMessagePreview: getThreadPreview(thread, decryptedMsg, rows),
        unreadCount: isMine
          ? (thread.unreadCount || 0)
          : (readImmediately ? 0 : (thread.unreadCount || 0) + 1)
      }
    }))

    if (readImmediately) scheduleReadReceipt(threadId, new Date().toISOString())
  }

  const applyThreadChange = (payload) => {
    const row = payload.new || payload.old
    const threadId = row?.id ? String(row.id) : ''
    if (!threadId) {
      scheduleThreadsReload()
      return
    }

    if (payload.eventType === 'DELETE' || row.is_archived) {
      updateThreadsState(previous => previous.filter(thread => String(thread.id) !== threadId))
      if (String(activeThreadIdRef.current) === threadId) setActiveThreadId(null)
      return
    }

    const exists = threadsRef.current.some(thread => String(thread.id) === threadId)
    if (!exists) {
      return
    }
    updateThreadsState(previous => previous.map(thread => (
      String(thread.id) === threadId ? { ...thread, ...row } : thread
    )))
  }

  const applyParticipantChange = (payload) => {
    const incoming = payload.new || payload.old
    const existing = incoming?.id
      ? participantsRef.current.find(row => String(row.id) === String(incoming.id))
      : null
    const row = { ...(existing || {}), ...(incoming || {}) }
    if (!row.id) {
      scheduleThreadsReload()
      return
    }

    const belongsToMe = String(row.user_id) === String(meIdRef.current)
    const threadIsVisible = threadsRef.current.some(thread => String(thread.id) === String(row.thread_id))
    if (!belongsToMe && !threadIsVisible) return

    if (payload.eventType === 'DELETE') {
      updateParticipantsState(previous => previous.filter(item => String(item.id) !== String(row.id)))
      if (belongsToMe) {
        updateThreadsState(previous => previous.filter(thread => String(thread.id) !== String(row.thread_id)))
        if (String(activeThreadIdRef.current) === String(row.thread_id)) setActiveThreadId(null)
      }
      return
    }

    updateParticipantsState(previous => {
      const index = previous.findIndex(item => String(item.id) === String(row.id))
      if (index === -1) return [...previous, row]
      return previous.map((item, itemIndex) => itemIndex === index ? { ...item, ...row } : item)
    })

    if (belongsToMe) {
      if (!threadsRef.current.some(thread => String(thread.id) === String(row.thread_id))) {
        scheduleThreadsReload(150)
      } else if (row.last_read_at) {
        updateThreadsState(previous => previous.map(thread => (
          String(thread.id) === String(row.thread_id) ? { ...thread, unreadCount: 0 } : thread
        )))
      }
    }
  }

  useEffect(() => {
    if (!me.id) return
    loadThreads()
  }, [me.id])

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId, { silent: true })

      const myPart = participants.find(p => p.thread_id === activeThreadId && String(p.user_id) === String(me.id))
      setReadHorizon(myPart?.last_read_at ? new Date(myPart.last_read_at).getTime() : null)

      if (me.id) {
        scheduleReadReceipt(activeThreadId, new Date().toISOString(), 50)
      }
    } else {
      messagesRef.current = []
      setMessages([])
      setReadHorizon(null)
    }
  }, [activeThreadId])

  useEffect(() => {
    if (!activeThreadId) return undefined

    let subscribedOnce = false
    const channel = supabase
      .channel(`chat-thread-${activeThreadId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${activeThreadId}`
      }, async (payload) => {
        if (payload.eventType === 'DELETE' || payload.new?.deleted_at) {
          const removedId = payload.old?.id || payload.new?.id
          if (removedId) {
            updateMessagesState(previous => previous.filter(message => String(message.id) !== String(removedId)))
          } else {
            scheduleMessagesReload(activeThreadId)
          }
          return
        }

        const incomingSigned = await signChatAttachment(payload.new)
        if (!incomingSigned || String(incomingSigned.thread_id) !== String(activeThreadIdRef.current)) return

        let incoming = incomingSigned
        if (incomingSigned.body && typeof incomingSigned.body === 'string' && incomingSigned.body.startsWith('[ENC:v1:')) {
          const decryptedBody = await decryptChatMessage(incomingSigned.body, incomingSigned.thread_id)
          incoming = { ...incomingSigned, body: decryptedBody }
        }

        if (payload.eventType === 'INSERT') {
          updateMessagesState(previous => {
            if (previous.some(message => String(message.id) === String(incoming.id))) return previous
            const sorted = [...previous, incoming].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            return sorted.length > 100 ? sorted.slice(-100) : sorted
          })
          applyMessageToThreadList(incoming)

          const isMine = String(incoming.sender_id) === String(meIdRef.current)
          if (isMine || isActiveThreadAtBottom(activeThreadId)) {
            setReadHorizon(null)
            if (!isMine) scheduleReadReceipt(activeThreadId, new Date().toISOString())
          }
          scrollToBottom({ force: isMine })
          return
        }

        updateMessagesState(previous => previous.map(message => (
          String(message.id) === String(incoming.id) ? { ...message, ...incoming } : message
        )))
      })
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return
        if (subscribedOnce) scheduleMessagesReload(activeThreadId, { delay: 100 })
        subscribedOnce = true
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThreadId])

  useEffect(() => {
    if (!me.id) return undefined

    listSubscribedOnceRef.current = false
    const channel = supabase
      .channel(`chat-list-${me.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_threads'
      }, (payload) => {
        applyThreadChange(payload)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants'
      }, (payload) => {
        applyParticipantChange(payload)
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, (payload) => {
        applyMessageToThreadList(payload.new)
      })
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return
        if (listSubscribedOnceRef.current) {
          scheduleThreadsReload(100)
          if (activeThreadIdRef.current) scheduleMessagesReload(activeThreadIdRef.current, { delay: 100 })
        }
        listSubscribedOnceRef.current = true
      })

    const handleVisibleRefresh = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        if (now - lastVisibilitySyncRef.current < 60 * 1000) return
        lastVisibilitySyncRef.current = now
        const delay = 250 + Math.floor(Math.random() * 1501)
        scheduleThreadsReload(delay)
        if (activeThreadIdRef.current) scheduleMessagesReload(activeThreadIdRef.current, { delay })
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

  const findExistingDirectThread = async (memberIds) => {
    const directKey = getDirectThreadKey(memberIds)
    if (!directKey) return null

    const { data: keyedThread, error: keyedError } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('is_archived', false)
      .eq('direct_key', directKey)
      .maybeSingle()

    if (keyedThread) return keyedThread
    if (keyedError && !String(keyedError.message || '').includes('direct_key')) {
      throw keyedError
    }

    const normalizedIds = memberIds.map(userId => String(userId))
    const { data: partialRows, error: partialError } = await supabase
      .from('chat_participants')
      .select('thread_id, user_id')
      .in('user_id', memberIds)

    if (partialError) throw partialError

    const candidateIds = Array.from(new Set((partialRows || []).map(row => row.thread_id)))
    if (candidateIds.length === 0) return null

    const { data: allRows, error: allRowsError } = await supabase
      .from('chat_participants')
      .select('thread_id, user_id')
      .in('thread_id', candidateIds)

    if (allRowsError) throw allRowsError

    const exactThreadIds = candidateIds.filter(threadId => {
      const rows = (allRows || []).filter(row => row.thread_id === threadId)
      if (rows.length !== normalizedIds.length) return false
      return normalizedIds.every(userId => rows.some(row => String(row.user_id) === userId))
    })

    if (exactThreadIds.length === 0) return null

    const { data: threadsRows, error: threadsError } = await supabase
      .from('chat_threads')
      .select('*')
      .in('id', exactThreadIds)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (threadsError) throw threadsError
    return threadsRows?.[0] || null
  }

  const openDirectThread = async (targetUser, options = {}) => {
    if (!targetUser?.id || !me.id || String(targetUser.id) === String(me.id)) return null

    const memberIds = [me.id, targetUser.id]
    const directKey = getDirectThreadKey(memberIds)
    const title = options.title || formatUserName(targetUser)
    const rows = memberIds.map(userId => {
      const user = String(userId) === String(me.id)
        ? currentUser
        : (systemUsers || []).find(item => String(item.id) === String(userId))
      return {
        thread_id: null,
        user_id: userId,
        user_login: user?.login || '',
        user_name: formatUserName(user),
        last_read_at: String(userId) === String(me.id) ? new Date().toISOString() : null
      }
    })

    const openThread = async (thread) => {
      if (!thread?.id) return null
      const participantRows = rows.map(row => ({ ...row, thread_id: thread.id }))
      const { error: participantError } = await supabase
        .from('chat_participants')
        .upsert(participantRows, { onConflict: 'thread_id,user_id' })
      if (participantError) throw participantError
      await loadThreads({ silent: true })
      setActiveThreadId(thread.id)
      return thread
    }

    const existingThread = await findExistingDirectThread(memberIds)
    if (existingThread) return openThread(existingThread)

    const now = new Date().toISOString()
    const threadPayload = {
      title,
      thread_type: 'direct',
      direct_key: directKey,
      created_by: me.id || null,
      created_by_login: me.login,
      created_by_name: me.name,
      last_message: 'Чат створено',
      last_message_at: now
    }

    let result = await supabase
      .from('chat_threads')
      .insert([threadPayload])
      .select()

    if (result.error && String(result.error.message || '').includes('direct_key')) {
      const { direct_key, ...fallbackPayload } = threadPayload
      result = await supabase
        .from('chat_threads')
        .insert([fallbackPayload])
        .select()
    }

    if (result.error?.code === '23505') {
      const thread = await findExistingDirectThread(memberIds)
      return openThread(thread)
    }
    if (result.error) throw result.error

    const thread = result.data?.[0]
    if (!thread?.id) throw new Error('Не вдалося створити чат')
    return openThread(thread)
  }

  useEffect(() => {
    if (searchParams.get('support') !== 'true' || !me.id || !systemUsers?.length || supportOpeningRef.current) return

    const targetUser = systemUsers.find(user => {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim().toUpperCase()
      const login = String(user.login || '').trim().toLowerCase()
      return fullName === 'ADMIN SYSTEM' ||
        fullName === 'SYSTEM ADMIN' ||
        login === 'admin' ||
        String(user.id) === '00000000-0000-0000-0000-000000000000' ||
        user.role === 'admin' ||
        user.is_admin
    })

    setSearchParams({}, { replace: true })
    if (!targetUser) return

    supportOpeningRef.current = true
    openDirectThread(targetUser, { title: 'Технічна підтримка' })
      .catch(err => {
        console.error('Support chat failed:', err)
        showSetupError(err)
      })
      .finally(() => {
        supportOpeningRef.current = false
      })
  }, [searchParams, me.id, systemUsers])

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
      if (newChatType === 'private') {
        const thread = await openDirectThread(selectedUsers[0], { title })
        if (thread) {
          setShowNewChat(false)
          setNewTitle('')
          setUserSearch('')
          setSelectedUserIds([])
        }
        return
      }

      const { data: threadRows, error: threadError } = await supabase
        .from('chat_threads')
        .insert([{
          title,
          thread_type: newChatType === 'channel' ? 'channel' : 'group',
          is_pinned: newChatType === 'channel',
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

      const rows = newChatType === 'channel'
        ? buildChannelParticipantRows({ threadId: thread.id, memberIds, me, currentUser, users, systemUsers, formatUserName })
        : memberIds.map(userId => {
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

    return {
      url: path,
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
    if (!canPostHere) {
      setError('У цьому каналі писати можуть тільки автори каналу.')
      return
    }
    const text = composer.trim()
    if (!text && !pendingImage) return

    setSending(true)
    setError('')
    try {
      setReadHorizon(null)
      const attachment = await uploadPendingImage(activeThreadId)
      const encryptedText = text ? encryptChatMessage(text, activeThreadId) : null
      const { data: sentMessage, error: sendError } = await supabase
        .from('chat_messages')
        .insert([{
          thread_id: activeThreadId,
          sender_id: me.id || null,
          sender_login: me.login,
          sender_name: me.name,
          body: encryptedText,
          attachment_url: attachment?.url || null,
          attachment_path: attachment?.path || null,
          attachment_type: attachment?.type || null,
          attachment_name: attachment?.name || null,
          attachment_size: attachment?.size || null,
          image_width: attachment?.width || null,
          image_height: attachment?.height || null
        }])
        .select()
        .single()

      if (sendError) throw sendError

      if (sentMessage) {
        const signedMessage = await signChatAttachment(sentMessage)
        const displayedMessage = { ...signedMessage, body: text || null }
        updateMessagesState(previous => {
          if (previous.some(message => String(message.id) === String(displayedMessage.id))) return previous
          return [...previous, displayedMessage].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        })
        applyMessageToThreadList(displayedMessage)
        scrollToBottom({ force: true })
      }

      const notifyUserIds = activeParticipants
        .map(p => p.user_id)
        .filter(userId => userId && userId !== me.id)

      if (notifyUserIds.length > 0) {
        const isDirectChat = activeParticipants.length === 2
        const notificationTitle = activeIsChannel
          ? (activeThread?.title || 'Нове повідомлення в каналі')
          : (isDirectChat ? 'Нове приватне повідомлення' : (activeThread?.title || 'Нове повідомлення в чаті'))
        sendPushToUsers(
          Array.from(new Set(notifyUserIds)),
          notificationTitle,
          activeIsChannel ? 'У каналі є нове повідомлення' : 'Відкрийте чат, щоб переглянути повідомлення',
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
    if (!activeThreadId || !window.confirm('Видалити цей чат?')) return
    setSending(true)
    try {
      const { error: archiveError } = await supabase
        .from('chat_threads')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', activeThreadId)

      if (archiveError) throw archiveError
      setActiveThreadId(null)
      await loadThreads()
      setShowChatMenu(false)
    } catch (err) {
      console.error(err)
      showSetupError(err)
    } finally {
      setSending(false)
    }
  }

  const clearChatHistory = async () => {
    if (!activeThreadId || !window.confirm('Очистити історію чату? Всі повідомлення будуть видалені.')) return
    setSending(true)
    try {
      const { error: clearError } = await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('thread_id', activeThreadId)
        .is('deleted_at', null)

      if (clearError) throw clearError
      setMessages([])
      await loadThreads()
      setShowChatMenu(false)
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
        const rows = activeIsChannel
          ? buildChannelParticipantRows({ threadId: activeThreadId, memberIds: toAdd, me, currentUser, users, systemUsers, formatUserName })
              .map(row => ({ ...row, last_read_at: null }))
          : toAdd.map(userId => {
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

  return {
    currentUser,
    systemUsers,
    supabase,
    navigate,
    me,
    isSuperAdmin,
    users,
    threads,
    participants,
    messages,
    activeThreadId,
    setActiveThreadId,
    activeThread,
    activeParticipants,
    canPostHere,
    activeIsChannel,
    loadingThreads,
    loadingMessages,
    sending,
    composer,
    setComposer,
    pendingImage,
    error,
    setError,
    readHorizon,
    search,
    setSearch,
    showNewChat,
    setShowNewChat,
    newChatType,
    setNewChatType,
    newTitle,
    setNewTitle,
    userSearch,
    setUserSearch,
    selectedUserIds,
    setSelectedUserIds,
    showThreadSettings,
    setShowThreadSettings,
    settingsTitle,
    setSettingsTitle,
    settingsUserSearch,
    setSettingsUserSearch,
    settingsUserIds,
    setSettingsUserIds,
    settingsAvatar,
    setSettingsAvatar,
    settingsSaving,
    imagePreview,
    setImagePreview,
    showEmojiPicker,
    setShowEmojiPicker,
    showChatMenu,
    setShowChatMenu,
    showAttachMenu,
    setShowAttachMenu,
    showTaskModal,
    setShowTaskModal,
    showPollModal,
    setShowPollModal,
    taskForm,
    setTaskForm,
    fileInputRef,
    cameraInputRef,
    avatarInputRef,
    messagesEndRef,
    reactions,
    toggleReaction,
    polls,
    createPoll,
    votePoll,
    handleMobileBack,
    getThreadAvatar,
    getThreadDisplayTitle,
    filteredThreads,
    filteredUsers,
    settingsFilteredUsers,
    scrollToBottom,
    openDirectThread,
    createThread,
    handleFile,
    clearPendingImage,
    sendMessage,
    archiveThread,
    clearChatHistory,
    openThreadSettings,
    handleAvatarFile,
    saveThreadSettings,
    toggleSelectedUser,
    toggleSettingsUser
  }
}

export default useChatData
