import React from 'react'
import { MessageCircle, Plus } from 'lucide-react'
import { useChatData, bytesToLabel, formatDateDivider, formatMessageTime, formatThreadTime } from './chat/hooks/useChatData.js'
import ChatSidebar from './chat/components/ChatSidebar.jsx'
import ChatHeader from './chat/components/ChatHeader.jsx'
import ChatMessageList from './chat/components/ChatMessageList.jsx'
import ChatComposerBar from './chat/components/ChatComposerBar.jsx'
import ChatNewThreadModal from './chat/components/modals/ChatNewThreadModal.jsx'
import ChatThreadSettingsModal from './chat/components/modals/ChatThreadSettingsModal.jsx'
import ChatImagePreviewModal from './chat/components/modals/ChatImagePreviewModal.jsx'
import { ChannelPollModal } from './chat/ChatChannelModule.jsx'
import { KanbanTaskModal } from './KanbanModule.jsx'
import { encryptChatMessage } from '../utils/chatCrypto.js'
import './chat/ChatStyles.css'

export const ChatModule = () => {
  const chat = useChatData()

  return (
    <div className="chat-module">
      <div className="chat-shell">
        <ChatSidebar
          isSuperAdmin={chat.isSuperAdmin}
          navigate={chat.navigate}
          setShowNewChat={chat.setShowNewChat}
          search={chat.search}
          setSearch={chat.setSearch}
          loadingThreads={chat.loadingThreads}
          filteredThreads={chat.filteredThreads}
          participants={chat.participants}
          activeThreadId={chat.activeThreadId}
          setActiveThreadId={chat.setActiveThreadId}
          getThreadAvatar={chat.getThreadAvatar}
          getThreadDisplayTitle={chat.getThreadDisplayTitle}
          formatThreadTime={formatThreadTime}
          me={chat.me}
        />

        <main className={`chat-main ${chat.activeIsChannel ? 'channel-mode' : ''}`}>
          {chat.activeThread ? (
            <>
              <ChatHeader
                activeThread={chat.activeThread}
                activeParticipants={chat.activeParticipants}
                handleMobileBack={chat.handleMobileBack}
                getThreadAvatar={chat.getThreadAvatar}
                getThreadDisplayTitle={chat.getThreadDisplayTitle}
                isSuperAdmin={chat.isSuperAdmin}
                me={chat.me}
                openThreadSettings={chat.openThreadSettings}
                sending={chat.sending}
                showChatMenu={chat.showChatMenu}
                setShowChatMenu={chat.setShowChatMenu}
                clearChatHistory={chat.clearChatHistory}
                archiveThread={chat.archiveThread}
                users={chat.users}
                systemUsers={chat.systemUsers}
              />

              {chat.error && <div className="error-box">{chat.error}</div>}

              <ChatMessageList
                loadingMessages={chat.loadingMessages}
                messages={chat.messages}
                me={chat.me}
                readHorizon={chat.readHorizon}
                activeParticipants={chat.activeParticipants}
                polls={chat.polls}
                votePoll={chat.votePoll}
                toggleReaction={chat.toggleReaction}
                reactions={chat.reactions}
                setImagePreview={chat.setImagePreview}
                navigate={chat.navigate}
                formatDateDivider={formatDateDivider}
                formatMessageTime={formatMessageTime}
                bytesToLabel={bytesToLabel}
                showSetupError={chat.showSetupError}
                messagesEndRef={chat.messagesEndRef}
              />

              <ChatComposerBar
                activeIsChannel={chat.activeIsChannel}
                canPostHere={chat.canPostHere}
                pendingImage={chat.pendingImage}
                clearPendingImage={chat.clearPendingImage}
                bytesToLabel={bytesToLabel}
                showEmojiPicker={chat.showEmojiPicker}
                setShowEmojiPicker={chat.setShowEmojiPicker}
                setComposer={chat.setComposer}
                composer={chat.composer}
                fileInputRef={chat.fileInputRef}
                cameraInputRef={chat.cameraInputRef}
                handleFile={chat.handleFile}
                showAttachMenu={chat.showAttachMenu}
                setShowAttachMenu={chat.setShowAttachMenu}
                sending={chat.sending}
                setShowPollModal={chat.setShowPollModal}
                activeParticipants={chat.activeParticipants}
                me={chat.me}
                setTaskForm={chat.setTaskForm}
                setShowTaskModal={chat.setShowTaskModal}
                sendMessage={chat.sendMessage}
                scrollToBottom={chat.scrollToBottom}
              />
            </>
          ) : (
            <div className="no-chat">
              <MessageCircle size={42} />
              <h2>Вибери чат або створи новий</h2>
              {chat.error && <div className="error-box">{chat.error}</div>}
              <button className="primary-btn" onClick={() => chat.setShowNewChat(true)}>
                <Plus size={18} /> Новий чат
              </button>
            </div>
          )}
        </main>
      </div>

      <ChatNewThreadModal
        showNewChat={chat.showNewChat}
        setShowNewChat={chat.setShowNewChat}
        isSuperAdmin={chat.isSuperAdmin}
        newChatType={chat.newChatType}
        setNewChatType={chat.setNewChatType}
        setSelectedUserIds={chat.setSelectedUserIds}
        setNewTitle={chat.setNewTitle}
        newTitle={chat.newTitle}
        userSearch={chat.userSearch}
        setUserSearch={chat.setUserSearch}
        filteredUsers={chat.filteredUsers}
        selectedUserIds={chat.selectedUserIds}
        toggleSelectedUser={chat.toggleSelectedUser}
        createThread={chat.createThread}
        sending={chat.sending}
        users={chat.users}
      />

      <ChannelPollModal
        visible={chat.showPollModal}
        sending={chat.sending}
        onClose={() => chat.setShowPollModal(false)}
        onCreate={async (payload) => {
          chat.setSending(true)
          chat.setError('')
          try {
            const createdPoll = await chat.createPoll({ threadId: chat.activeThreadId, ...payload })
            if (createdPoll?.message) {
              chat.updateMessagesState(previous => {
                if (previous.some(message => String(message.id) === String(createdPoll.message.id))) return previous
                return [...previous, createdPoll.message].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
              })
              chat.applyMessageToThreadList(createdPoll.message)
              chat.scrollToBottom({ force: true })
            }
          } catch (err) {
            console.error(err)
            chat.showSetupError(err)
          } finally {
            chat.setSending(false)
          }
        }}
      />

      <ChatThreadSettingsModal
        showThreadSettings={chat.showThreadSettings}
        activeThread={chat.activeThread}
        setShowThreadSettings={chat.setShowThreadSettings}
        setSettingsAvatar={chat.setSettingsAvatar}
        settingsAvatar={chat.settingsAvatar}
        getThreadDisplayTitle={chat.getThreadDisplayTitle}
        avatarInputRef={chat.avatarInputRef}
        settingsSaving={chat.settingsSaving}
        handleAvatarFile={chat.handleAvatarFile}
        settingsTitle={chat.settingsTitle}
        setSettingsTitle={chat.setSettingsTitle}
        settingsUserSearch={chat.settingsUserSearch}
        setSettingsUserSearch={chat.setSettingsUserSearch}
        settingsUserIds={chat.settingsUserIds}
        settingsFilteredUsers={chat.settingsFilteredUsers}
        toggleSettingsUser={chat.toggleSettingsUser}
        saveThreadSettings={chat.saveThreadSettings}
      />

      <ChatImagePreviewModal
        imagePreview={chat.imagePreview}
        setImagePreview={chat.setImagePreview}
      />

      {chat.showTaskModal && (
        <KanbanTaskModal
          initialAssignee={chat.taskForm.assignee?.user_login || chat.taskForm.assignee?.user_id}
          onClose={() => chat.setShowTaskModal(false)}
          onCreated={async (data) => {
            const task = Array.isArray(data) ? data[0] : data
            if (task && chat.activeThreadId) {
              try {
                const sysText = `Нове завдання: ${task.title}`
                const encryptedBody = await encryptChatMessage(sysText, chat.activeThreadId)
                await chat.supabase.from('chat_messages').insert([{
                  thread_id: chat.activeThreadId,
                  sender_id: chat.me.id || null,
                  sender_login: chat.me.login,
                  sender_name: chat.me.name,
                  body: encryptedBody,
                  attachment_type: 'system_task',
                  attachment_name: task.title,
                  attachment_url: task.id?.toString(),
                  attachment_path: task.deadline || null
                }])
              } catch(e) {}
            }
          }}
        />
      )}
    </div>
  )
}

export default ChatModule
