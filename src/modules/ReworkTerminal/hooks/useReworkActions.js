import { useState } from 'react'
import { supabase } from '../../../supabase.js'

export function useReworkActions() {
  const [isProcessing, setIsProcessing] = useState(false)

  const takeInWork = async (cardId, operatorName) => {
    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('work_cards')
        .update({ status: 'in-progress' })
        .eq('id', cardId)
      if (error) throw error

      await supabase.from('work_card_history').insert([{
        card_id: cardId,
        operator_name: operatorName || 'Оператор доопрацювання',
        stage_name: 'Доопрацювання (Взяття)',
        action: 'Взято в роботу'
      }])
    } catch (e) {
      alert('Помилка: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const completeWork = async (card, operatorName) => {
    setIsProcessing(true)
    try {
      const { error } = await supabase
        .from('work_cards')
        .update({ status: 'at-shop2-buffer' })
        .eq('id', card.id)
      if (error) throw error

      await supabase.from('work_card_history').insert([{
        card_id: card.id,
        operator_name: operatorName || 'Оператор доопрацювання',
        stage_name: 'Доопрацювання (Завершення)',
        action: 'Завершено',
        qty_completed: card.quantity,
        nomenclature_id: card.nomenclature_id,
        task_id: card.task_id
      }])
    } catch (e) {
      alert('Помилка: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return { takeInWork, completeWork, isProcessing }
}
