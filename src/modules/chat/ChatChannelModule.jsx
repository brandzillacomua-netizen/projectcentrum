import React, { useEffect, useMemo, useState } from 'react'
import { BarChart3, Megaphone, Plus, Trash2, X, Check } from 'lucide-react'

export const CHANNEL_REACTIONS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F525}', '\u{1F44F}', '\u{1F62E}', '\u2705']

export const isRomanPiletsky = (user) => {
  const name = [user?.last_name, user?.first_name, user?.user_name, user?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const login = String(user?.login || user?.user_login || '').toLowerCase()
  return (
    (name.includes('пілецьк') || name.includes('пiлецьк') || name.includes('piletsk')) &&
    (name.includes('роман') || login.includes('roman') || login.includes('piletsk'))
  )
}

export const isChannelThread = (thread) => thread?.thread_type === 'channel'

export const canPostToThread = ({ thread, currentUser, activeParticipants, systemUsers }) => {
  if (!isChannelThread(thread)) return true
  if (currentUser?.role === 'admin' || currentUser?.position === 'Адмін') return true

  const participant = activeParticipants.find(row => String(row.user_id) === String(currentUser?.id))
  if (participant?.can_post || ['owner', 'editor'].includes(participant?.participant_role)) return true

  const systemUser = (systemUsers || []).find(user => String(user.id) === String(currentUser?.id))
  return isRomanPiletsky(systemUser || currentUser || participant)
}

export const buildChannelParticipantRows = ({ threadId, memberIds, me, currentUser, users, systemUsers, formatUserName }) => {
  return memberIds.map(userId => {
    const user = String(userId) === String(me.id)
      ? currentUser
      : (users || []).find(item => String(item.id) === String(userId)) ||
        (systemUsers || []).find(item => String(item.id) === String(userId))
    const canPost = String(userId) === String(me.id) || isRomanPiletsky(user)

    return {
      thread_id: threadId,
      user_id: userId,
      user_login: user?.login || '',
      user_name: formatUserName(user),
      last_read_at: String(userId) === String(me.id) ? new Date().toISOString() : null,
      participant_role: canPost ? 'editor' : 'reader',
      can_post: canPost
    }
  })
}

export const ChannelBadge = ({ thread }) => {
  if (!isChannelThread(thread)) return null
  return (
    <span className="channel-badge" title="Канал">
      <Megaphone size={12} /> Канал
    </span>
  )
}

export const ReadOnlyChannelNotice = ({ visible }) => {
  if (!visible) return null
  return (
    <div className="channel-readonly-notice">
      Канал тільки для читання. Можна ставити реакції на повідомлення.
    </div>
  )
}

export const useChatReactions = ({ supabase, activeThreadId, messages, me }) => {
  const [reactions, setReactions] = useState({})

  const messageIds = useMemo(() => messages.map(message => message.id).filter(Boolean), [messages])

  const loadReactions = async () => {
    if (!activeThreadId || messageIds.length === 0) {
      setReactions({})
      return
    }

    const { data, error } = await supabase
      .from('chat_message_reactions')
      .select('*')
      .in('message_id', messageIds)
      .order('created_at', { ascending: true })

    if (error) {
      if (!String(error.message || '').includes('chat_message_reactions')) throw error
      setReactions({})
      return
    }

    const grouped = {}
    ;(data || []).forEach(row => {
      if (!grouped[row.message_id]) grouped[row.message_id] = {}
      if (!grouped[row.message_id][row.reaction]) {
        grouped[row.message_id][row.reaction] = { count: 0, mine: false, users: [] }
      }
      grouped[row.message_id][row.reaction].count += 1
      grouped[row.message_id][row.reaction].users.push(row.user_name)
      if (String(row.user_id) === String(me.id)) grouped[row.message_id][row.reaction].mine = true
    })
    setReactions(grouped)
  }

  useEffect(() => {
    loadReactions().catch(err => console.warn('[Chat] reactions load failed:', err))
  }, [activeThreadId, messageIds.join('|'), me.id])

  useEffect(() => {
    if (!activeThreadId) return undefined
    const channel = supabase
      .channel(`chat-reactions-${activeThreadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, () => {
        loadReactions().catch(err => console.warn('[Chat] reactions refresh failed:', err))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThreadId, messageIds.join('|'), me.id])

  const toggleReaction = async (messageId, reaction) => {
    if (!messageId || !reaction || !me.id) return
    const existing = reactions[messageId]?.[reaction]?.mine
    if (existing) {
      const { error } = await supabase
        .from('chat_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', me.id)
        .eq('reaction', reaction)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('chat_message_reactions')
        .upsert([{
          message_id: messageId,
          user_id: me.id,
          user_login: me.login,
          user_name: me.name,
          reaction
        }], { onConflict: 'message_id,user_id,reaction' })
      if (error) throw error
    }
    await loadReactions()
  }

  return { reactions, toggleReaction }
}

export const useChannelPolls = ({ supabase, activeThreadId, messages, me, refreshMessages }) => {
  const [polls, setPolls] = useState({})
  const pollIds = useMemo(() => {
    return messages
      .filter(message => message.attachment_type === 'channel_poll' && message.attachment_url)
      .map(message => message.attachment_url)
  }, [messages])

  const loadPolls = async () => {
    if (!activeThreadId || pollIds.length === 0) {
      setPolls({})
      return
    }

    const { data: pollRows, error: pollError } = await supabase
      .from('chat_polls')
      .select('*')
      .in('id', pollIds)

    if (pollError) {
      if (!String(pollError.message || '').includes('chat_polls')) throw pollError
      setPolls({})
      return
    }

    const { data: optionRows, error: optionError } = await supabase
      .from('chat_poll_options')
      .select('*')
      .in('poll_id', pollIds)
      .order('sort_order', { ascending: true })

    if (optionError) throw optionError

    const { data: voteRows, error: voteError } = await supabase
      .from('chat_poll_votes')
      .select('*')
      .in('poll_id', pollIds)

    if (voteError) throw voteError

    const grouped = {}
    ;(pollRows || []).forEach(poll => {
      const options = (optionRows || [])
        .filter(option => option.poll_id === poll.id)
        .map(option => {
          const votes = (voteRows || []).filter(vote => vote.option_id === option.id)
          return {
            ...option,
            votes,
            votes_count: votes.length,
            mine: votes.some(vote => String(vote.user_id) === String(me.id))
          }
        })
      grouped[poll.id] = {
        ...poll,
        options,
        total_votes: options.reduce((sum, option) => sum + option.votes_count, 0),
        my_votes: (voteRows || []).filter(vote => vote.poll_id === poll.id && String(vote.user_id) === String(me.id))
      }
    })
    setPolls(grouped)
  }

  useEffect(() => {
    loadPolls().catch(err => console.warn('[Chat] polls load failed:', err))
  }, [activeThreadId, pollIds.join('|'), me.id])

  useEffect(() => {
    if (!activeThreadId) return undefined
    const channel = supabase
      .channel(`chat-polls-${activeThreadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_polls' }, () => {
        loadPolls().catch(err => console.warn('[Chat] polls refresh failed:', err))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_poll_options' }, () => {
        loadPolls().catch(err => console.warn('[Chat] poll options refresh failed:', err))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_poll_votes' }, () => {
        loadPolls().catch(err => console.warn('[Chat] poll votes refresh failed:', err))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThreadId, pollIds.join('|'), me.id])

  const createPoll = async ({ threadId, question, options, allowMultiple }) => {
    const cleanQuestion = question.trim()
    const cleanOptions = options.map(option => option.trim()).filter(Boolean)
    if (!threadId || !cleanQuestion || cleanOptions.length < 2) return null

    const { data: pollRows, error: pollError } = await supabase
      .from('chat_polls')
      .insert([{
        thread_id: threadId,
        question: cleanQuestion,
        allow_multiple: allowMultiple,
        created_by: me.id || null,
        created_by_login: me.login,
        created_by_name: me.name
      }])
      .select()

    if (pollError) throw pollError
    const poll = pollRows?.[0]
    if (!poll?.id) throw new Error('Не вдалося створити опитування')

    const { error: optionsError } = await supabase
      .from('chat_poll_options')
      .insert(cleanOptions.map((option, index) => ({
        poll_id: poll.id,
        option_text: option,
        sort_order: index
      })))

    if (optionsError) throw optionsError

    const { data: messageRows, error: messageError } = await supabase
      .from('chat_messages')
      .insert([{
        thread_id: threadId,
        sender_id: me.id || null,
        sender_login: me.login,
        sender_name: me.name,
        body: null,
        attachment_url: poll.id,
        attachment_type: 'channel_poll',
        attachment_name: cleanQuestion
      }])
      .select()

    if (messageError) throw messageError

    const message = messageRows?.[0]
    if (message?.id) {
      await supabase
        .from('chat_polls')
        .update({ message_id: message.id })
        .eq('id', poll.id)
    }

    await refreshMessages?.()
    await loadPolls()
    return poll
  }

  const votePoll = async (poll, optionId) => {
    if (!poll?.id || !optionId || !me.id) return
    const option = poll.options.find(item => item.id === optionId)
    if (!option) return

    if (option.mine) {
      const { error } = await supabase
        .from('chat_poll_votes')
        .delete()
        .eq('poll_id', poll.id)
        .eq('option_id', optionId)
        .eq('user_id', me.id)
      if (error) throw error
      await loadPolls()
      return
    }

    if (!poll.allow_multiple) {
      const { error: deleteError } = await supabase
        .from('chat_poll_votes')
        .delete()
        .eq('poll_id', poll.id)
        .eq('user_id', me.id)
      if (deleteError) throw deleteError
    }

    const { error } = await supabase
      .from('chat_poll_votes')
      .insert([{
        poll_id: poll.id,
        option_id: optionId,
        user_id: me.id,
        user_login: me.login,
        user_name: me.name
      }])

    if (error && error.code !== '23505') throw error
    await loadPolls()
  }

  return { polls, createPoll, votePoll }
}

export const ChannelPollModal = ({ visible, sending, onClose, onCreate }) => {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)

  if (!visible) return null

  const cleanOptionsCount = options.filter(option => option.trim()).length
  const canCreate = question.trim() && cleanOptionsCount >= 2 && !sending

  const resetAndClose = () => {
    setQuestion('')
    setOptions(['', ''])
    setAllowMultiple(false)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={resetAndClose}>
      <div className="channel-poll-modal" onClick={event => event.stopPropagation()}>
        <div className="channel-poll-head">
          <div>
            <span><BarChart3 size={14} /> Опитування каналу</span>
            <h3>Запитати весь завод</h3>
          </div>
          <button className="icon-btn" onClick={resetAndClose}><X size={18} /></button>
        </div>
        <input
          className="channel-poll-input"
          value={question}
          onChange={event => setQuestion(event.target.value)}
          placeholder="Питання..."
          autoFocus
        />
        <div className="channel-poll-options">
          {options.map((option, index) => (
            <div className="channel-poll-option-row" key={index}>
              <input
                value={option}
                onChange={event => setOptions(prev => prev.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                placeholder={`Варіант ${index + 1}`}
              />
              {options.length > 2 && (
                <button type="button" onClick={() => setOptions(prev => prev.filter((_, itemIndex) => itemIndex !== index))}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="channel-poll-add" type="button" onClick={() => setOptions(prev => [...prev, ''])}>
          <Plus size={15} /> Додати варіант
        </button>
        <label className="channel-poll-check">
          <input type="checkbox" checked={allowMultiple} onChange={event => setAllowMultiple(event.target.checked)} />
          Можна вибрати кілька варіантів
        </label>
        <button
          className="channel-poll-create"
          disabled={!canCreate}
          onClick={async () => {
            await onCreate({ question, options, allowMultiple })
            resetAndClose()
          }}
        >
          Створити опитування
        </button>
      </div>
    </div>
  )
}

export const PollMessage = ({ poll, onVote }) => {
  if (!poll) {
    return <div className="channel-poll-card loading">Опитування завантажується...</div>
  }

  return (
    <div className="channel-poll-card">
      <div className="channel-poll-card-head">
        <span><BarChart3 size={14} /> Опитування</span>
        {poll.allow_multiple && <b>кілька відповідей</b>}
      </div>
      <h4>{poll.question}</h4>
      <div className="channel-poll-results">
        {poll.options.map(option => {
          const total = Math.max(1, poll.total_votes || 0)
          const pct = Math.round((option.votes_count / total) * 100)
          return (
            <button
              key={option.id}
              type="button"
              className={`channel-poll-result ${option.mine ? 'mine' : ''}`}
              onClick={() => onVote(poll, option.id)}
            >
              <span className="channel-poll-fill" style={{ width: `${pct}%` }} />
              <span className="channel-poll-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', flex: 1 }}>
                <div className={`poll-checkbox ${option.mine ? 'checked' : ''}`}>
                  {option.mine && <Check size={12} strokeWidth={4} />}
                </div>
                <span>{option.option_text}</span>
              </span>
              <b>{option.votes_count}</b>
            </button>
          )
        })}
      </div>
      <div className="channel-poll-total">{poll.total_votes || 0} голосів</div>
    </div>
  )
}

export const MessageReactions = ({ messageId, reactions, onToggle }) => {
  const messageReactions = reactions?.[messageId] || {}
  const hasAny = Object.keys(messageReactions).length > 0
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className={`message-reactions ${hasAny ? 'has-reactions' : ''}`} onMouseLeave={() => setShowPicker(false)}>
      {Object.entries(messageReactions).map(([reaction, item]) => (
        <button
          key={reaction}
          type="button"
          className={`reaction-pill ${item.mine ? 'mine' : ''}`}
          onClick={() => onToggle(messageId, reaction)}
          title={(item.users || []).join(', ')}
        >
          <span>{reaction}</span>
          <b>{item.count}</b>
        </button>
      ))}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button 
          className="reaction-add-btn" 
          onClick={() => setShowPicker(!showPicker)}
          title="Додати реакцію"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
        {showPicker && (
          <div className="reaction-picker popup">
            {CHANNEL_REACTIONS.map(reaction => (
              <button key={reaction} type="button" onClick={() => { onToggle(messageId, reaction); setShowPicker(false); }}>
                {reaction}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const channelStyles = `
  .chat-main.channel-mode {
    background:
      radial-gradient(circle at 12% 12%, rgba(16,185,129,0.14), transparent 28%),
      radial-gradient(circle at 88% 8%, rgba(59,130,246,0.16), transparent 32%),
      linear-gradient(180deg, #080b0f 0%, #050505 100%);
  }
  .chat-main.channel-mode .chat-header {
    border-bottom-color: rgba(59,130,246,0.24);
    background: linear-gradient(90deg, rgba(10,14,20,0.96), rgba(13,28,38,0.94));
  }
  .chat-main.channel-mode .active-chat-title h2 {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .chat-main.channel-mode .message-bubble {
    border-color: rgba(59,130,246,0.18);
    background: linear-gradient(145deg, rgba(20,24,31,0.96), rgba(10,15,20,0.96));
  }
  .chat-main.channel-mode .message-row.mine .message-bubble {
    border-color: rgba(16,185,129,0.28);
    background: linear-gradient(145deg, rgba(16,185,129,0.20), rgba(59,130,246,0.13));
  }
  .channel-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(59,130,246,0.14);
    color: #93c5fd;
    border: 1px solid rgba(59,130,246,0.24);
    font-size: 0.68rem;
    font-weight: 900;
    text-transform: uppercase;
  }
  .channel-readonly-notice {
    margin: 0 12px 8px;
    padding: 9px 12px;
    border: 1px solid rgba(59,130,246,0.22);
    background: rgba(59,130,246,0.08);
    color: #bfdbfe;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
  }
  .message-reactions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 5px;
  }
  .message-reactions .reaction-pill,
  .reaction-picker.popup button,
  .reaction-add-btn {
    min-width: 30px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.05);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    font-size: 0.78rem;
    transition: all 0.2s;
  }
  .reaction-add-btn {
    width: 26px;
    min-width: unset;
    border-radius: 50%;
    color: #666;
    background: transparent;
    border-color: transparent;
    opacity: 0.4;
  }
  .message-wrapper:hover .reaction-add-btn {
    opacity: 1;
    color: #aaa;
  }
  .reaction-add-btn:hover {
    background: rgba(255,255,255,0.1) !important;
    color: #3b82f6 !important;
  }
  .message-reactions .reaction-pill.mine {
    border-color: rgba(59,130,246,0.45);
    background: rgba(59,130,246,0.2);
  }
  .message-reactions .reaction-pill b {
    font-size: 0.68rem;
  }
  .reaction-picker.popup {
    display: flex;
    gap: 4px;
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(20,20,22,0.95);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 6px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    z-index: 100;
  }
  .message-row.mine .reaction-picker.popup {
    left: auto;
    right: 0;
    transform: none;
  }
  .reaction-picker.popup button {
    border: none;
    background: transparent;
    font-size: 1.25rem;
    padding: 4px;
    min-width: 34px;
    height: 34px;
  }
  .reaction-picker.popup button:hover {
    background: rgba(255,255,255,0.1);
    transform: scale(1.15);
  }
  .channel-poll-modal {
    width: min(440px, calc(100vw - 28px));
    background: linear-gradient(180deg, #111827, #07090d);
    border: 1px solid rgba(59,130,246,0.28);
    border-radius: 12px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.55);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .channel-poll-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .channel-poll-head span,
  .channel-poll-card-head span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #93c5fd;
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
  }
  .channel-poll-head h3 {
    margin: 4px 0 0;
    color: #fff;
    font-size: 1.2rem;
  }
  .channel-poll-input,
  .channel-poll-option-row input {
    width: 100%;
    min-height: 40px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.05);
    color: #fff;
    padding: 0 12px;
    outline: none;
  }
  .channel-poll-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .channel-poll-option-row {
    display: flex;
    gap: 8px;
  }
  .channel-poll-option-row button,
  .channel-poll-add {
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.05);
    color: #fff;
    border-radius: 8px;
    min-height: 38px;
    padding: 0 10px;
    cursor: pointer;
  }
  .channel-poll-add,
  .channel-poll-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    color: rgba(255,255,255,0.78);
  }
  .channel-poll-create {
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    background: linear-gradient(135deg, #2563eb, #10b981);
    color: #fff;
    font-weight: 900;
    cursor: pointer;
  }
  .channel-poll-create:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .channel-poll-card {
    width: 100%;
    max-width: 400px;
  }
  .channel-poll-card.loading {
    color: rgba(255,255,255,0.62);
  }
  .channel-poll-card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .channel-poll-card-head b {
    color: rgba(255,255,255,0.5);
    font-size: 0.68rem;
  }
  .channel-poll-card h4 {
    margin: 0 0 10px;
    color: #fff;
    font-size: 1rem;
  }
  .channel-poll-results {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .channel-poll-result {
    position: relative;
    overflow: hidden;
    min-height: 38px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 10px;
    cursor: pointer;
  }
  .channel-poll-result.mine {
    border-color: rgba(16,185,129,0.46);
  }
  .channel-poll-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(90deg, rgba(59,130,246,0.28), rgba(16,185,129,0.22));
    pointer-events: none;
  }
  .channel-poll-label,
  .channel-poll-result b {
    position: relative;
    z-index: 1;
  }
  .poll-checkbox {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.2);
    flex-shrink: 0;
  }
  .poll-checkbox.checked {
    background: #10b981;
    border-color: #10b981;
    color: #fff;
  }
  .channel-poll-total {
    margin-top: 8px;
    color: rgba(255,255,255,0.5);
    font-size: 0.75rem;
    font-weight: 800;
  }
`
