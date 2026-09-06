import React from 'react'
import { Loader2 } from 'lucide-react'
import ChatMessageItem from './ChatMessageItem.jsx'

export const ChatMessageList = ({
  loadingMessages,
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
  showSetupError,
  messagesEndRef
}) => {
  return (
    <section className="messages-panel">
      {loadingMessages ? (
        <div className="empty-state"><Loader2 className="spin" size={20} /> Завантаження повідомлень...</div>
      ) : messages.length === 0 ? (
        <div className="empty-state">Тут ще немає повідомлень</div>
      ) : messages.map((message, index) => (
        <ChatMessageItem
          key={message.id || index}
          message={message}
          index={index}
          messages={messages}
          me={me}
          readHorizon={readHorizon}
          activeParticipants={activeParticipants}
          polls={polls}
          votePoll={votePoll}
          toggleReaction={toggleReaction}
          reactions={reactions}
          setImagePreview={setImagePreview}
          navigate={navigate}
          formatDateDivider={formatDateDivider}
          formatMessageTime={formatMessageTime}
          bytesToLabel={bytesToLabel}
          showSetupError={showSetupError}
        />
      ))}
      <div ref={messagesEndRef} style={{ height: '32px', flexShrink: 0, minHeight: '32px' }} />
    </section>
  )
}

export default ChatMessageList
