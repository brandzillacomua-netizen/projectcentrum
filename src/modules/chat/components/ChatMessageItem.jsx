import React from 'react'
import { Check, CheckCheck, CheckSquare } from 'lucide-react'
import { MessageReactions, PollMessage } from '../ChatChannelModule.jsx'

export const ChatMessageItem = ({
  message,
  index,
  messages,
  me,
  readHorizon,
  activeParticipants,
  polls,
  votePoll,
  toggleReaction,
  reactions,
  setImagePreview,
  navigate,
  formatDateDivider,
  formatMessageTime,
  bytesToLabel,
  showSetupError
}) => {
  const isMine = message.sender_id === me.id
  const msgTime = new Date(message.created_at).getTime()

  let showUnreadDivider = false
  if (readHorizon && msgTime > readHorizon) {
    const firstUnreadOtherIndex = messages.findIndex(m => new Date(m.created_at).getTime() > readHorizon && m.sender_id !== me.id)
    if (index === firstUnreadOtherIndex) {
      showUnreadDivider = true
    }
  }

  const prevMessage = index > 0 ? messages[index - 1] : null
  const nextMessage = index < messages.length - 1 ? messages[index + 1] : null

  const isFirstOfDay = !prevMessage || formatDateDivider(message.created_at) !== formatDateDivider(prevMessage.created_at)

  const showMeta = !nextMessage ||
    nextMessage.sender_id !== message.sender_id ||
    formatMessageTime(nextMessage.created_at) !== formatMessageTime(message.created_at)

  let isReadByOthers = false
  if (isMine) {
    isReadByOthers = activeParticipants.some(p => p.user_id !== me.id && p.last_read_at && new Date(p.last_read_at).getTime() >= msgTime)
  }

  return (
    <React.Fragment key={message.id}>
      {isFirstOfDay && (
        <div className="date-divider">
          <span>{formatDateDivider(message.created_at)}</span>
        </div>
      )}
      {showUnreadDivider && (
        <div id="unread-divider" className="unread-divider">
          <span>Нові повідомлення</span>
        </div>
      )}
      <div className={`message-row ${isMine ? 'mine' : ''}`}>
        <div className="message-wrapper">
          {!isMine && <div className="message-author">{message.sender_name}</div>}

          <div className={`message-bubble ${message.attachment_type === 'system_task' ? 'sys-task-bubble' : ''}`}>
            {message.attachment_type === 'channel_poll' ? (
              <PollMessage
                poll={polls[message.attachment_url]}
                onVote={(poll, optionId) => {
                  votePoll(poll, optionId).catch(err => {
                    console.error(err)
                    showSetupError(err)
                  })
                }}
              />
            ) : message.attachment_type === 'system_task' ? (
              <div className="task-sys-message" style={{ cursor: "pointer" }} onClick={() => navigate(`/tasks?taskId=${message.attachment_url}`)}>
                <div className="tsm-icon"><CheckSquare size={22} /></div>
                <div className="tsm-content">
                  <h4><b>{message.sender_name}</b> створив(ла) для вас завдання</h4>
                  <div className="tsm-card">
                    <div className="tsm-title">{message.attachment_name}</div>
                    {message.attachment_path && <div className="tsm-deadline">Дедлайн: {new Date(message.attachment_path).toLocaleDateString('uk-UA')}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
          <MessageReactions
            messageId={message.id}
            reactions={reactions}
            onToggle={(messageId, reaction) => {
              toggleReaction(messageId, reaction).catch(err => {
                console.error(err)
                showSetupError(err)
              })
            }}
          />
          {(showMeta || message.attachment_size) && (
            <div className="message-meta">
              {message.attachment_size ? <span className="meta-size">{bytesToLabel(message.attachment_size)}</span> : null}
              {showMeta && <span className="meta-time">{formatMessageTime(message.created_at)}</span>}
              {isMine && showMeta && (
                <span className="meta-read-status" style={{ marginLeft: 4, color: isReadByOthers ? '#3b82f6' : '#888', display: 'inline-flex', alignItems: 'center' }}>
                  {isReadByOthers ? <CheckCheck size={14} /> : <Check size={14} />}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </React.Fragment>
  )
}

export default ChatMessageItem
