import { useState, useEffect } from 'react'
import { supabase } from '../../../supabase.js'

export function useReworkData(mes) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { nomenclatures = [], orders = [], tasks = [] } = mes || {}

  useEffect(() => {
    let mounted = true

    const fetchCards = async () => {
      try {
        setLoading(true)
        const { data, error: fetchError } = await supabase
          .from('work_cards')
          .select('*')
          .eq('operation', 'Доопрацювання')
          .in('status', ['new', 'in-progress'])

        if (fetchError) throw fetchError

        if (mounted) {
          setCards(data || [])
          setError(null)
        }
      } catch (err) {
        console.error('Error fetching rework cards:', err)
        if (mounted) setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchCards()

    const sub = supabase
      .channel('rework_cards_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards', filter: "operation=eq.Доопрацювання" }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (['new', 'in-progress'].includes(payload.new.status)) {
            setCards(prev => [...prev, payload.new])
          }
        } else if (payload.eventType === 'UPDATE') {
          if (['new', 'in-progress'].includes(payload.new.status)) {
            setCards(prev => {
              const exists = prev.some(c => c.id === payload.new.id)
              return exists ? prev.map(c => c.id === payload.new.id ? payload.new : c) : [...prev, payload.new]
            })
          } else {
            setCards(prev => prev.filter(c => c.id !== payload.new.id))
          }
        } else if (payload.eventType === 'DELETE') {
          setCards(prev => prev.filter(c => c.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(sub)
    }
  }, [])

  const enrichedCards = cards.map(c => {
    const nom = nomenclatures.find(n => n.id === c.nomenclature_id)
    const task = tasks.find(t => t.id === c.task_id)
    const order = orders.find(o => o.id === c.order_id)
    return { ...c, nom, task, order }
  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  return { cards: enrichedCards, loading, error }
}
