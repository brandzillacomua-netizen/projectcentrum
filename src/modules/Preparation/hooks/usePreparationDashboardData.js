import { useState, useEffect, useMemo } from 'react'
import { useMES } from '../../../MESContext'
import { useWarehouseComputed } from '../../Warehouse/hooks/useWarehouseComputed'

export const PREP_PAGE_SIZE = 4
export const BOX_PAGE_SIZE = 3
export const ROTATION_MS = 12000

export const formatElapsed = (start, now) => {
  if (!start) return '—'
  const seconds = Math.max(0, Math.floor((now - new Date(start)) / 1000))
  const hours = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export const getAgeMinutes = (start, now) => {
  if (!start) return 0
  return Math.max(0, Math.floor((now - new Date(start)) / 60000))
}

export function usePreparationDashboardData() {
  const {
    tasks, nomenclatures, requests, inventory, receptionDocs,
    machineOperations, workCards, orders
  } = useMES()

  const [now, setNow] = useState(new Date())
  const [prepPage, setPrepPage] = useState(0)
  const [boxesPage, setBoxesPage] = useState(0)
  const [lastDataChange, setLastDataChange] = useState(new Date())

  const { cardsWithBoxes } = useWarehouseComputed({
    requests, tasks, receptionDocs, nomenclatures, inventory,
    activeTab: 'boxes', machineOperations, workCards, searchQuery: ''
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setLastDataChange(new Date())
  }, [tasks, workCards, requests, inventory])

  const orderById = useMemo(() => new Map((orders || []).map(order => [String(order.id), order])), [orders])

  const prepQueue = useMemo(() => {
    const queue = []
    ;(tasks || [])
      .filter(task => task.step === 'Підготовка' && task.status !== 'completed' && (
        task.warehouse_conf === 'true' ||
        Object.values(task.plan_snapshot || {}).some(item => item?.status === 'in-progress' || item?.status === 'completed')
      ))
      .forEach(task => {
        const snapshot = task.plan_snapshot || {}
        Object.entries(snapshot).forEach(([nomenclatureId, item]) => {
          if (nomenclatureId.startsWith('_') || item?.status === 'completed') return
          const order = orderById.get(String(task.order_id))
          queue.push({
            id: `${task.id}_${nomenclatureId}`,
            prepNum: snapshot._prep_num || 'НП------',
            orderNum: order?.order_num || '—',
            name: item?.name || nomenclatures.find(n => String(n.id) === String(nomenclatureId))?.name || 'Матеріал',
            plan: Number(item?.plan || item?.need || 0),
            status: item?.status || 'new',
            operator: item?.operator || 'Не призначено',
            shift: item?.shift || '—',
            startedAt: item?.started_at || task.started_at,
            hasScrap: Number(item?.total_scrap || item?.actual_scrap || 0) > 0
          })
        })
      })

    return queue.sort((a, b) => {
      if (a.hasScrap !== b.hasScrap) return a.hasScrap ? -1 : 1
      if (a.status !== b.status) return a.status === 'in-progress' ? -1 : 1
      return String(a.prepNum).localeCompare(String(b.prepNum), 'uk')
    })
  }, [tasks, nomenclatures, orderById])

  const boxOrders = useMemo(() => {
    const grouped = new Map()
    ;(cardsWithBoxes || []).forEach(item => {
      const orderId = String(item.card.order_id || item.task?.order_id || '')
      const order = orderById.get(orderId)
      const orderNum = order?.order_num || 'Без наряду'
      if (!grouped.has(orderId)) grouped.set(orderId, { id: orderId, orderNum, items: new Map(), total: 0, prepared: 0 })
      const orderGroup = grouped.get(orderId)
      const nomKey = String(item.nom?.id || item.card.nomenclature_id || item.nom?.name || 'unknown')
      if (!orderGroup.items.has(nomKey)) {
        orderGroup.items.set(nomKey, { id: nomKey, name: item.nom?.name || 'Без номенклатури', total: 0, prepared: 0 })
      }
      const nomGroup = orderGroup.items.get(nomKey)
      nomGroup.total += 1
      orderGroup.total += 1
      if (item.isPrepared) {
        nomGroup.prepared += 1
        orderGroup.prepared += 1
      }
    })

    return Array.from(grouped.values()).map(group => ({
      ...group,
      items: Array.from(group.items.values()).sort((a, b) => (a.prepared / a.total) - (b.prepared / b.total)),
      pending: group.total - group.prepared
    })).sort((a, b) => b.pending - a.pending || String(a.orderNum).localeCompare(String(b.orderNum), 'uk'))
  }, [cardsWithBoxes, orderById])

  // The TV queue is operational: completed orders stay in totals, but never
  // occupy a dashboard card or a rotation slot.
  const activeBoxOrders = useMemo(
    () => boxOrders.filter(order => order.pending > 0),
    [boxOrders]
  )

  const totals = useMemo(() => {
    const boxesTotal = boxOrders.reduce((sum, order) => sum + order.total, 0)
    const boxesPrepared = boxOrders.reduce((sum, order) => sum + order.prepared, 0)
    return {
      prepActive: prepQueue.filter(item => item.status === 'in-progress').length,
      prepWaiting: prepQueue.filter(item => item.status !== 'in-progress').length,
      boxesTotal,
      boxesPrepared,
      boxesPending: boxesTotal - boxesPrepared
    }
  }, [prepQueue, boxOrders])

  const alerts = useMemo(() => {
    const result = []
    prepQueue.forEach(item => {
      const age = getAgeMinutes(item.startedAt, now)
      if (item.hasScrap) result.push({ level: 'danger', text: `${item.prepNum}: зафіксовано брак — потрібна повторна підготовка` })
      else if (item.status === 'in-progress' && age >= 120) result.push({ level: 'warning', text: `${item.prepNum}: ${item.name} у роботі вже ${formatElapsed(item.startedAt, now)}` })
    })
    activeBoxOrders.slice(0, 3).forEach(order => {
      result.push({ level: order.pending >= 5 ? 'danger' : 'warning', text: `Наряд №${order.orderNum}: потрібно зібрати ще ${order.pending} боксів` })
    })
    return result.slice(0, 4)
  }, [prepQueue, activeBoxOrders, now])

  const prepPages = Math.max(1, Math.ceil(prepQueue.length / PREP_PAGE_SIZE))
  const boxesPages = Math.max(1, Math.ceil(activeBoxOrders.length / BOX_PAGE_SIZE))

  useEffect(() => {
    const timer = setInterval(() => {
      setPrepPage(page => (page + 1) % prepPages)
      setBoxesPage(page => (page + 1) % boxesPages)
    }, ROTATION_MS)
    return () => clearInterval(timer)
  }, [prepPages, boxesPages])

  useEffect(() => setPrepPage(page => Math.min(page, prepPages - 1)), [prepPages])
  useEffect(() => setBoxesPage(page => Math.min(page, boxesPages - 1)), [boxesPages])

  const visiblePrep = prepQueue.slice(prepPage * PREP_PAGE_SIZE, prepPage * PREP_PAGE_SIZE + PREP_PAGE_SIZE)
  const visibleBoxOrders = activeBoxOrders.slice(boxesPage * BOX_PAGE_SIZE, boxesPage * BOX_PAGE_SIZE + BOX_PAGE_SIZE)
  const staleSeconds = Math.floor((now - lastDataChange) / 1000)

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
      else await document.exitFullscreen()
    } catch (error) {}
  }

  return {
    now,
    prepPage,
    boxesPage,
    prepPages,
    boxesPages,
    totals,
    alerts,
    visiblePrep,
    visibleBoxOrders,
    activeBoxOrders,
    staleSeconds,
    toggleFullscreen
  }
}
