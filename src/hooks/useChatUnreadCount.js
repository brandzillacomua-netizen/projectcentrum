import { useState, useEffect } from 'react'

export const useChatUnreadCount = (currentUser, supabase) => {
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  useEffect(() => {
    if (!currentUser?.id || !supabase || currentUser?.access_rights?.chat !== true) {
      setChatUnreadCount(0)
      return undefined
    }

    let cancelled = false
    let refreshTimer = null
    let refreshInFlight = null
    let rerunAfterFlight = false
    let hasLoaded = false
    let lastRefreshAt = 0
    let subscribedOnce = false
    let participantsByThread = new Map()
    let unreadByThread = new Map()
    const seenMessageIds = new Set()
    const rememberMessageId = (messageId) => {
      if (!messageId) return false
      const key = String(messageId)
      if (seenMessageIds.has(key)) return true
      seenMessageIds.add(key)
      if (seenMessageIds.size > 5000) {
        seenMessageIds.delete(seenMessageIds.values().next().value)
      }
      return false
    }

    const performRefresh = async () => {
      try {
        const { data: participantRows, error: participantError } = await supabase
          .from('chat_participants')
          .select('thread_id, last_read_at')
          .eq('user_id', currentUser.id)

        if (participantError) throw participantError
        if (!participantRows?.length) {
          participantsByThread = new Map()
          unreadByThread = new Map()
          seenMessageIds.clear()
          hasLoaded = true
          lastRefreshAt = Date.now()
          if (!cancelled) setChatUnreadCount(0)
          return
        }

        const nextParticipantsByThread = new Map(
          participantRows.map(row => [String(row.thread_id), row.last_read_at || null])
        )
        const threadIds = Array.from(nextParticipantsByThread.keys())

        const rpcUserId = Number(currentUser.id) || currentUser.id
        const { data: unreadRows, error: unreadRpcError } = await supabase
          .rpc('chat_unread_counts', { p_user_id: rpcUserId })

        if (!unreadRpcError) {
          const nextUnreadByThread = new Map(threadIds.map(threadId => [threadId, 0]))
          ;(unreadRows || []).forEach(row => {
            nextUnreadByThread.set(String(row.thread_id), Number(row.unread_count) || 0)
          })
          if (cancelled) return
          participantsByThread = nextParticipantsByThread
          unreadByThread = nextUnreadByThread
          hasLoaded = true
          lastRefreshAt = Date.now()
          setChatUnreadCount(Array.from(nextUnreadByThread.values()).reduce((sum, value) => sum + value, 0))
          return
        }

        const rpcErrorCode = String(unreadRpcError.code || '')
        const rpcErrorMessage = String(unreadRpcError.message || '').toLowerCase()
        const rpcIsUnavailable = ['PGRST202', '42883'].includes(rpcErrorCode) ||
          (rpcErrorMessage.includes('chat_unread_counts') && (
            rpcErrorMessage.includes('not find') ||
            rpcErrorMessage.includes('does not exist') ||
            rpcErrorMessage.includes('schema cache')
          ))
        if (!rpcIsUnavailable) throw unreadRpcError

        const validReadTimes = participantRows
          .map(row => row.last_read_at ? new Date(row.last_read_at).getTime() : 0)
          .filter(value => Number.isFinite(value) && value > 0)
        const canBoundByOldestRead = validReadTimes.length === participantRows.length
        const oldestReadAt = canBoundByOldestRead ? Math.min(...validReadTimes) : 0
        const messageRows = []
        const pageSize = 1000
        const maxUnreadRows = 5000

        for (let offset = 0; !cancelled && offset < maxUnreadRows; offset += pageSize) {
          const currentPageSize = Math.min(pageSize, maxUnreadRows - offset)
          let query = supabase
            .from('chat_messages')
            .select('id, thread_id, sender_id, created_at')
            .in('thread_id', threadIds)
            .is('deleted_at', null)
            .neq('sender_id', currentUser.id)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + currentPageSize - 1)

          if (oldestReadAt) query = query.gt('created_at', new Date(oldestReadAt).toISOString())

          const { data: rows, error } = await query
          if (error) throw error
          messageRows.push(...(rows || []))
          if (!rows || rows.length < currentPageSize) break
        }

        if (cancelled) return

        const nextUnreadByThread = new Map(threadIds.map(threadId => [threadId, 0]))
        messageRows.forEach(message => {
          const threadId = String(message.thread_id)
          const lastReadAt = nextParticipantsByThread.get(threadId)
          const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0
          const messageTime = new Date(message.created_at).getTime()
          if (!lastReadTime || messageTime > lastReadTime) {
            nextUnreadByThread.set(threadId, (nextUnreadByThread.get(threadId) || 0) + 1)
          }
          rememberMessageId(message.id)
        })

        participantsByThread = nextParticipantsByThread
        unreadByThread = nextUnreadByThread
        hasLoaded = true
        lastRefreshAt = Date.now()
        setChatUnreadCount(Array.from(nextUnreadByThread.values()).reduce((sum, value) => sum + value, 0))
      } catch (err) {
        const message = err?.message || ''
        if (!message.includes('chat_')) console.warn('Chat unread count failed:', err)
        if (!cancelled && !hasLoaded) setChatUnreadCount(0)
      }
    }

    const refreshUnread = () => {
      if (cancelled) return Promise.resolve()
      if (refreshInFlight) {
        rerunAfterFlight = true
        return refreshInFlight
      }

      refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null
        if (rerunAfterFlight && !cancelled) {
          rerunAfterFlight = false
          if (refreshTimer) clearTimeout(refreshTimer)
          refreshTimer = setTimeout(refreshUnread, 100)
        }
      })
      return refreshInFlight
    }

    const scheduleRefresh = (delay = 300, respectCooldown = false) => {
      if (cancelled) return
      const cooldownDelay = respectCooldown ? Math.max(0, 5000 - (Date.now() - lastRefreshAt)) : 0
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshUnread, Math.max(delay, cooldownDelay))
    }

    const handleMessageChange = (payload) => {
      const row = payload.new || payload.old
      const messageId = row?.id ? String(row.id) : ''
      const threadId = row?.thread_id ? String(row.thread_id) : ''

      if (payload.eventType !== 'INSERT' || !row || !participantsByThread.has(threadId)) {
        if (payload.eventType !== 'INSERT' || !hasLoaded) scheduleRefresh(350)
        return
      }

      if (refreshInFlight) rerunAfterFlight = true
      if (rememberMessageId(messageId)) return
      if (row.deleted_at || String(row.sender_id) === String(currentUser.id)) return

      const lastReadAt = participantsByThread.get(threadId)
      const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0
      const messageTime = new Date(row.created_at).getTime()
      if (lastReadTime && messageTime <= lastReadTime) return

      unreadByThread.set(threadId, (unreadByThread.get(threadId) || 0) + 1)
      setChatUnreadCount(value => value + 1)
    }

    refreshUnread()
    const channel = supabase
      .channel(`chat-unread-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, handleMessageChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${currentUser.id}`
      }, () => scheduleRefresh(300))
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return
        if (subscribedOnce) scheduleRefresh(100)
        subscribedOnce = true
      })

    const handleVisibleRefresh = () => {
      if (document.visibilityState === 'visible') scheduleRefresh(100, true)
    }

    const handleFocusRefresh = () => scheduleRefresh(100, true)

    document.addEventListener('visibilitychange', handleVisibleRefresh)
    window.addEventListener('focus', handleFocusRefresh)

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', handleVisibleRefresh)
      window.removeEventListener('focus', handleFocusRefresh)
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id, currentUser?.access_rights?.chat, supabase])

  return chatUnreadCount
}
