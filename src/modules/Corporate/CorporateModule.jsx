import React, { useState, useEffect } from 'react'
import { useMES } from '../../MESContext'
import { supabase } from '../../supabase'
import './CorporateHub.css'
import { CorporateLayout } from './components/CorporateLayout'
import { CorporateFeed } from './components/feed/CorporateFeed'
import { CorporateTasksView } from './components/tasks/CorporateTasksView'
import { useCorporateFeed } from './hooks/useCorporateFeed'
import KanbanModule from '../KanbanModule'
import { KanbanTaskModal } from '../Kanban/components/modals/KanbanTaskModal'
import { isTaskVisibleToUser } from '../Kanban/utils/kanbanHelpers'

export default function CorporateModule() {
  const { currentUser, managementTasks, companyStructure = [], refreshTable } = useMES()
  const [activeTab, setActiveTab] = useState('feed')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [companyUsers, setCompanyUsers] = useState([])
  const [taskModalPostData, setTaskModalPostData] = useState(null)
  const [isQuickTaskModalOpen, setIsQuickTaskModalOpen] = useState(false)

  // Ensure management tasks are loaded immediately when opening Corporate Module
  useEffect(() => {
    if (typeof refreshTable === 'function') {
      refreshTable('management_tasks')
    }
  }, [refreshTable])

  // Corporate Feed Hook
  const {
    posts,
    loading: feedLoading,
    isSubmitting: isFeedSubmitting,
    createPost,
    deletePost,
    togglePin,
    toggleAck,
    refreshPosts
  } = useCorporateFeed(currentUser)

  // Filter tasks relevant to current user: personal (assigned/checklist/author) or collective
  const userRelevantTasks = useMemo(() => {
    return (managementTasks || []).filter(t => isTaskVisibleToUser(t, currentUser, companyStructure))
  }, [managementTasks, currentUser, companyStructure])

  const activeTasks = useMemo(() => {
    return userRelevantTasks.filter(t => t.status !== 'done')
  }, [userRelevantTasks])

  // Fetch company users for mentions and assignees
  useEffect(() => {
    let mounted = true
    supabase
      .from('system_users')
      .select('id, login, first_name, last_name, avatar, position, department, shift')
      .order('first_name', { ascending: true })
      .then(({ data }) => {
        if (mounted && data) {
          setCompanyUsers(data)
        }
      })
      .catch(err => console.warn('[CorporateModule] Could not load users list:', err))

    return () => { mounted = false }
  }, [])

  // Calculate pending acks count for current user
  const unreadAcksCount = (posts || []).filter(p => {
    if (!p.requires_ack) return false
    const isAcked = (p.acks || []).some(a => String(a.user_id) === String(currentUser?.id))
    return !isAcked
  }).length

  const handleRefresh = () => {
    refreshPosts()
    if (typeof refreshTable === 'function') {
      refreshTable('management_tasks')
    }
  }

  const handleCreateTaskFromPost = (post) => {
    const authorName = post.author ? `${post.author.first_name || ''} ${post.author.last_name || ''}`.trim() || post.author.login : 'колеги'
    setTaskModalPostData({
      title: post.title || `Завдання по обговоренню від ${authorName}`,
      description: post.content ? `Контекст обговорення:\n"${post.content.slice(0, 300)}${post.content.length > 300 ? '...' : ''}"` : '',
      post_id: post.id
    })
  }

  return (
    <CorporateLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedCategory={selectedCategory}
      onSelectCategory={setSelectedCategory}
      postsCount={posts.length}
      tasksCount={activeTasks.length}
      unreadAcksCount={unreadAcksCount}
      onRefresh={handleRefresh}
      loading={feedLoading}
      currentUser={currentUser}
      users={companyUsers}
      tasks={userRelevantTasks}
      companyStructure={companyStructure}
      posts={posts}
      onToggleAck={toggleAck}
      onOpenNewTaskModal={() => setIsQuickTaskModalOpen(true)}
    >
      {activeTab === 'feed' ? (
        <CorporateFeed
          posts={posts}
          currentUser={currentUser}
          users={companyUsers}
          onCreatePost={createPost}
          onDeletePost={deletePost}
          onToggleAck={toggleAck}
          onTogglePin={togglePin}
          onCreateTaskFromPost={handleCreateTaskFromPost}
          isSubmitting={isFeedSubmitting}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      ) : (
        <CorporateTasksView onOpenNewTaskModal={() => setIsQuickTaskModalOpen(true)} />
      )}

      {/* Convert post to task modal — using unified company KanbanTaskModal */}
      {taskModalPostData && (
        <KanbanTaskModal
          initialTitle={taskModalPostData.title}
          initialDescription={taskModalPostData.description}
          onClose={() => setTaskModalPostData(null)}
        />
      )}

      {/* Standalone new task modal from right aside — using unified company KanbanTaskModal */}
      {isQuickTaskModalOpen && (
        <KanbanTaskModal
          onClose={() => setIsQuickTaskModalOpen(false)}
        />
      )}
    </CorporateLayout>
  )
}
