import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabase'
import { corporateApi } from '../services/corporateApi'

export function useCorporateFeed(currentUser) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await corporateApi.fetchPosts()
      setPosts(data || [])
      setError(null)
    } catch (err) {
      console.warn('[useCorporateFeed] Fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPosts()

    // Realtime channel for posts and acks
    const channel = supabase
      .channel('corporate_feed_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corporate_posts' }, () => {
        loadPosts()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'corporate_post_acks' }, () => {
        loadPosts()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadPosts])

  const handleCreatePost = async (postData) => {
    try {
      setIsSubmitting(true)
      const newPost = await corporateApi.createPost({
        ...postData,
        author_id: currentUser?.id
      }, postData.attachments || [])

      setPosts(prev => [newPost, ...prev])
      return newPost
    } catch (err) {
      console.error('[useCorporateFeed] Create post error:', err)
      alert('Помилка публікації: ' + err.message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Видалити цей допис?')) return
    try {
      await corporateApi.deletePost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch (err) {
      alert('Помилка видалення: ' + err.message)
    }
  }

  const handleTogglePin = async (postId, currentPinned) => {
    try {
      const nextPinned = await corporateApi.togglePinPost(postId, currentPinned)
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_pinned: nextPinned } : p))
    } catch (err) {
      alert('Помилка закріплення: ' + err.message)
    }
  }

  const handleToggleAck = async (postId) => {
    if (!currentUser?.id) return
    try {
      const isNowAcked = await corporateApi.toggleAcknowledgePost(postId, currentUser.id)
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p
        const currentAcks = Array.isArray(p.acks) ? p.acks : []
        const updatedAcks = isNowAcked
          ? [...currentAcks, { user_id: currentUser.id, acknowledged_at: new Date().toISOString() }]
          : currentAcks.filter(a => String(a.user_id) !== String(currentUser.id))
        return { ...p, acks: updatedAcks }
      }))
    } catch (err) {
      console.error(err)
      alert('Помилка підтвердження: ' + err.message)
    }
  }

  return {
    posts,
    loading,
    isSubmitting,
    error,
    refreshPosts: loadPosts,
    createPost: handleCreatePost,
    deletePost: handleDeletePost,
    togglePin: handleTogglePin,
    toggleAck: handleToggleAck
  }
}

