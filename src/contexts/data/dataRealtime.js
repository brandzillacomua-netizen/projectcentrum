import { useEffect } from 'react'
import { supabase, isLocalWrite } from '../../supabase.js'
import { wsBatcher } from '../../services/wsBatcher.js'
import { sendPushToUsers } from '../../services/pushService.js'
import { productionHistoryContribution } from './dataProfiles.js'

export function useDataRealtime(state, fetchers) {
  const {
    currentUser,
    realtimeProfile,
    routeDataTableKey,
    routeHasTable,
    needsProductionSummary,
    performIncrementalCatchUp,
    setWorkCards,
    setTasks,
    setInventory,
    setOrders,
    setManagementTasks,
    setTaskProjects,
    setCustomers,
    setRequests,
    setReceptionDocs,
    setPurchaseRequests,
    setMachines,
    setMachineOperations,
    setMachineCalls,
    setSystemUsers,
    setCompanyStructure,
    setCompanyPositions,
    setWorkCardHistory,
    setServerProductionData,
    setWorkCardScrapTotals,
    setWorkCardFlowTotals,
    systemUsersRef,
    machinesRef,
    workCardHistoryRef,
    tasksRef,
    ordersRef,
    matReqPushBufferRef,
    targetRefreshLastRef
  } = state

  const { refreshProductionSummary, fetchData } = fetchers

  // ── Primary Channel: Operational & Production Data ──
  useEffect(() => {
    const needsPrimaryChannel = needsProductionSummary || [
      'work_cards',
      'tasks',
      'inventory',
      'work_card_history',
      'work_card_scrap_totals',
      'work_card_flow_totals'
    ].some(tableName => routeHasTable(tableName))

    if (!currentUser?.id || realtimeProfile === 'public' || !needsPrimaryChannel) return undefined

    const needsProductionHistory = routeHasTable('work_card_history') || needsProductionSummary
    const needsScrapTotals = routeHasTable('work_card_scrap_totals')
    const needsFlowTotals = routeHasTable('work_card_flow_totals')
    let productionSummaryRefreshTimer = null

    const scheduleProductionSummaryRefresh = () => {
      if (!needsProductionSummary) return
      if (productionSummaryRefreshTimer) clearTimeout(productionSummaryRefreshTimer)
      productionSummaryRefreshTimer = setTimeout(() => {
        productionSummaryRefreshTimer = null
        refreshProductionSummary({ force: true })
          .catch(error => console.warn('Realtime production summary refresh failed:', error))
      }, 1500)
    }

    wsBatcher.registerHandler('work_cards', (batchEvents) => {
      setWorkCards(prev => {
        let next = [...prev]
        batchEvents.forEach(payload => {
          if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'completed') {
              next = next.filter(c => c.id !== payload.new.id)
            } else {
              next = next.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c)
            }
          } else if (payload.eventType === 'INSERT') {
            if (payload.new.status !== 'completed') {
              next = next.some(c => c.id === payload.new.id) ? next : [payload.new, ...next]
            }
          } else if (payload.eventType === 'DELETE') {
            next = next.filter(c => c.id !== payload.old.id)
          }
        })
        return next
      })
    })

    wsBatcher.registerHandler('tasks', (batchEvents) => {
      setTasks(prev => {
        let next = [...prev]
        batchEvents.forEach(payload => {
          if (payload.eventType === 'UPDATE') {
            const exists = next.some(t => t.id === payload.new.id)
            if (exists) {
              next = next.map(t => {
                if (t.id === payload.new.id) {
                  const merged = { ...t, ...payload.new }
                  if (t.plan_snapshot && !payload.new.plan_snapshot) {
                    merged.plan_snapshot = t.plan_snapshot
                  }
                  return merged
                }
                return t
              })
            } else {
              next = [payload.new, ...next]
            }
          } else if (payload.eventType === 'INSERT') {
            next = next.some(t => t.id === payload.new.id) ? next : [payload.new, ...next]
          } else if (payload.eventType === 'DELETE') {
            next = next.filter(t => t.id !== payload.old.id)
          }
        })
        return next
      })
    })

    wsBatcher.registerHandler('inventory', (batchEvents) => {
      setInventory(prev => {
        let next = [...prev]
        batchEvents.forEach(payload => {
          if (payload.eventType === 'UPDATE') {
            next = next.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i)
          } else if (payload.eventType === 'INSERT') {
            next = next.some(i => i.id === payload.new.id) ? next : [payload.new, ...next]
          } else if (payload.eventType === 'DELETE') {
            next = next.filter(i => i.id !== payload.old.id)
          }
        })
        return next
      })
    })

    let activeChannel = supabase.channel('mes-global-updates')

    if (routeHasTable('work_cards')) {
      activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, (payload) => {
        wsBatcher.enqueue('work_cards', payload)
      })
    }

    if (routeHasTable('tasks')) {
      activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        wsBatcher.enqueue('tasks', payload)
        if (payload.eventType === 'UPDATE') {
          const wasPackaged = payload.old?.plan_snapshot?._metadata?.is_packaged
          const isNowPackaged = payload.new?.plan_snapshot?._metadata?.is_packaged
          if (!wasPackaged && isNowPackaged) {
            if (isLocalWrite('tasks', payload.new)) {
              const notifyIds = (systemUsersRef.current || []).filter(u => {
                if (!u?.access_rights) return false
                const s = u.notification_settings || {}
                if (s.ready_to_ship === false) return false
                return u.access_rights.shipping || u.access_rights.director
              }).map(u => u.id)
              if (notifyIds.length > 0) {
                const packedBy = payload.new?.plan_snapshot?._metadata?.packaged_by || ''
                const batchIdx = payload.new?.batch_index || '1'
                sendPushToUsers(
                  notifyIds,
                  '🚚 Готово до відвантаження',
                  `Партія №${batchIdx}${packedBy ? ` (${packedBy})` : ''} запакована і очікує відвантаження`,
                  '/shipping',
                  { tag: `task-ready-to-ship-${payload.new.id}` }
                ).catch(() => { })
              }
            }
          }
        }
      })
    }

    if (routeHasTable('inventory')) {
      activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        wsBatcher.enqueue('inventory', payload)
      })
    }

    if (needsProductionHistory) {
      activeChannel = activeChannel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_card_history' }, (payload) => {
          const alreadyKnown = workCardHistoryRef.current.some(h => String(h.id) === String(payload.new.id))
          if (alreadyKnown) return

          const nextHistory = [payload.new, ...workCardHistoryRef.current].slice(0, 200)
          workCardHistoryRef.current = nextHistory
          setWorkCardHistory(nextHistory)

          const contribution = productionHistoryContribution(payload.new)
          setServerProductionData(prev => prev ? {
            ...prev,
            totalProduced: (Number(prev.totalProduced) || 0) + contribution.produced,
            totalScrap: (Number(prev.totalScrap) || 0) + contribution.scrap,
            historyCount: Number.isFinite(Number(prev.historyCount))
              ? Number(prev.historyCount) + 1
              : prev.historyCount
          } : prev)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_card_history' }, (payload) => {
          const previous = workCardHistoryRef.current.find(h => String(h.id) === String(payload.new.id))
          const nextHistory = workCardHistoryRef.current.map(h => h.id === payload.new.id ? { ...h, ...payload.new } : h)
          workCardHistoryRef.current = nextHistory
          setWorkCardHistory(nextHistory)

          if (previous) {
            const before = productionHistoryContribution(previous)
            const after = productionHistoryContribution({ ...previous, ...payload.new })
            setServerProductionData(prev => prev ? {
              ...prev,
              totalProduced: (Number(prev.totalProduced) || 0) + after.produced - before.produced,
              totalScrap: (Number(prev.totalScrap) || 0) + after.scrap - before.scrap
            } : prev)
          } else {
            scheduleProductionSummaryRefresh()
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'work_card_history' }, (payload) => {
          const deletedId = payload.old?.id
          if (deletedId != null) {
            const nextHistory = workCardHistoryRef.current.filter(h => String(h.id) !== String(deletedId))
            workCardHistoryRef.current = nextHistory
            setWorkCardHistory(nextHistory)
          }
          scheduleProductionSummaryRefresh()
        })
    }

    if (needsScrapTotals) {
      activeChannel = activeChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_card_scrap_totals' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setWorkCardScrapTotals(prev => prev.some(row => row.id === payload.new.id) ? prev : [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setWorkCardScrapTotals(prev => prev.map(row => row.id === payload.new.id ? { ...row, ...payload.new } : row))
          } else if (payload.eventType === 'DELETE') {
            setWorkCardScrapTotals(prev => prev.filter(row => row.id !== payload.old.id))
          }
        })
    }

    if (needsFlowTotals) {
      activeChannel = activeChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_card_flow_totals' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setWorkCardFlowTotals(prev => prev.some(row => row.id === payload.new.id) ? prev : [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setWorkCardFlowTotals(prev => prev.map(row => row.id === payload.new.id ? { ...row, ...payload.new } : row))
          } else if (payload.eventType === 'DELETE') {
            setWorkCardFlowTotals(prev => prev.filter(row => row.id !== payload.old.id))
          }
        })
    }

    let hasSubscribed = false
    let reconnectRefreshTimer = null
    let onlineCatchUpTimer = null

    const handleOnlineNetworkCatchUp = () => {
      if (onlineCatchUpTimer) clearTimeout(onlineCatchUpTimer)
      const jitterMs = 300 + Math.floor(Math.random() * 1500)
      onlineCatchUpTimer = setTimeout(() => {
        onlineCatchUpTimer = null
        const targets = ['tasks', 'work_cards', 'inventory', 'material_requests', 'orders']
          .filter(tableName => routeHasTable(tableName))
        if (targets.length > 0) performIncrementalCatchUp(targets)
      }, jitterMs)
    }

    window.addEventListener('online', handleOnlineNetworkCatchUp)

    activeChannel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      const shouldCatchUp = hasSubscribed
      hasSubscribed = true
      if (!shouldCatchUp) return

      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      const reconnectJitterMs = 400 + Math.floor(Math.random() * 1200)
      reconnectRefreshTimer = setTimeout(() => {
        reconnectRefreshTimer = null
        const targets = ['tasks', 'work_cards', 'inventory', 'material_requests', 'orders']
          .filter(tableName => routeHasTable(tableName))
        if (targets.length > 0) performIncrementalCatchUp(targets)
      }, reconnectJitterMs)
    })

    return () => {
      window.removeEventListener('online', handleOnlineNetworkCatchUp)
      if (onlineCatchUpTimer) clearTimeout(onlineCatchUpTimer)
      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      if (productionSummaryRefreshTimer) clearTimeout(productionSummaryRefreshTimer)
      supabase.removeChannel(activeChannel)
    }
  }, [
    currentUser?.id,
    realtimeProfile,
    routeDataTableKey,
    routeHasTable,
    needsProductionSummary,
    performIncrementalCatchUp,
    refreshProductionSummary,
    setInventory,
    setServerProductionData,
    setTasks,
    setWorkCardFlowTotals,
    setWorkCardHistory,
    setWorkCardScrapTotals,
    setWorkCards,
    systemUsersRef,
    workCardHistoryRef
  ])

  // ── Secondary Channel: Orders, Management, Warehouse, Machines, Users ──
  useEffect(() => {
    const secondaryTables = [
      'orders',
      'management_tasks',
      'task_projects',
      'customers',
      'material_requests',
      'reception_docs',
      'purchase_requests',
      'machines',
      'machine_operations',
      'machine_calls',
      'system_users',
      'company_structure',
      'company_positions'
    ]
    if (!currentUser?.id || realtimeProfile === 'public' || !secondaryTables.some(tableName => routeHasTable(tableName))) return undefined

    const isSettings = realtimeProfile === 'settings'
    const orderHydrationTimers = new Map()

    const mergeRealtimeOrder = (incoming) => {
      if (!incoming?.id) return
      setOrders(prev => {
        const existing = prev.find(order => String(order.id) === String(incoming.id))
        const merged = existing
          ? { ...existing, ...incoming, order_items: incoming.order_items || existing.order_items || [] }
          : { ...incoming, order_items: incoming.order_items || [] }
        return [merged, ...prev.filter(order => String(order.id) !== String(incoming.id))]
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      })
    }

    const scheduleOrderHydration = (orderId) => {
      if (!orderId || orderHydrationTimers.has(String(orderId))) return
      const timer = setTimeout(async () => {
        orderHydrationTimers.delete(String(orderId))
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .maybeSingle()
        if (!error && data) mergeRealtimeOrder(data)
      }, 750 + Math.floor(Math.random() * 1751))
      orderHydrationTimers.set(String(orderId), timer)
    }

    let activeChannel2 = supabase.channel('mes-secondary-updates')

    if (routeHasTable('orders')) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          mergeRealtimeOrder(payload.new)
          scheduleOrderHydration(payload.new?.id)
          if (isLocalWrite('orders', payload.new)) {
            const notifyIds = (systemUsersRef.current || []).filter(u => {
              if (!u?.access_rights) return false
              const settings = u.notification_settings || {}
              if (settings.new_order === false) return false
              return u.access_rights.director || u.access_rights.master || u.access_rights.manager
            }).map(u => u.id)
            if (notifyIds.length > 0) {
              const orderNum = payload.new?.order_num || ''
              const customer = payload.new?.customer || ''
              sendPushToUsers(
                notifyIds,
                '📦 Нове замовлення',
                `№ ${orderNum}${customer ? ` — ${customer}` : ''} очікує на створення наряду`,
                '/manager',
                { tag: `order-new-${payload.new.id}` }
              ).catch(() => { })
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
          mergeRealtimeOrder(payload.new)
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
          const deletedId = payload.old?.id
          if (deletedId != null) {
            setOrders(prev => prev.filter(order => String(order.id) !== String(deletedId)))
          }
        })
    }

    if (routeHasTable('management_tasks')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'management_tasks' }, (payload) => {
        let statusUpdates = {}
        try {
          statusUpdates = JSON.parse(localStorage.getItem('centrum_task_status_updates') || '{}')
        } catch {
          /* ignore json parse error */
        }

        if (payload.eventType === 'INSERT') {
          const item = statusUpdates[payload.new.id] ? { ...payload.new, ...statusUpdates[payload.new.id] } : payload.new
          setManagementTasks(prev => prev.some(t => t.id === item.id) ? prev.map(t => t.id === item.id ? { ...t, ...item } : t) : [item, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          const item = statusUpdates[payload.new.id] ? { ...payload.new, ...statusUpdates[payload.new.id] } : payload.new
          setManagementTasks(prev => prev.map(t => t.id === item.id ? { ...t, ...item } : t))
        } else if (payload.eventType === 'DELETE') {
          setManagementTasks(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('task_projects')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'task_projects' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTaskProjects(prev => prev.some(p => p.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setTaskProjects(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        } else if (payload.eventType === 'DELETE') {
          setTaskProjects(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('customers')) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, (payload) => {
          setCustomers(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customers' }, (payload) => {
          setCustomers(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c))
        })
    }

    if (routeHasTable('material_requests')) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'material_requests' }, (payload) => {
          setRequests(prev => prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev])
          if (isLocalWrite('material_requests', payload.new)) {
            const isPackaging = payload.new?.details?.includes('КОМПЛЕКТУВАННЯ')
            const orderId = payload.new?.order_id || payload.new?.task_id || 'unknown'
            let orderNum = 'новий'
            if (payload.new?.task_id) {
              const t = tasksRef.current.find(item => item.id === payload.new.task_id)
              if (t) {
                if (t.step === 'Підготовка' && t.plan_snapshot?._prep_num) {
                  orderNum = t.plan_snapshot._prep_num
                } else {
                  const suffix = t.batch_index ? `/${t.batch_index}` : ''
                  if (t.order_id) {
                    const o = ordersRef.current.find(item => item.id === t.order_id)
                    if (o?.order_num) orderNum = `${o.order_num}${suffix}`
                  } else if (t.plan_snapshot?._prep_num) {
                    orderNum = t.plan_snapshot._prep_num
                  }
                }
              }
            } else if (payload.new?.order_id) {
              const o = ordersRef.current.find(item => item.id === payload.new.order_id)
              if (o?.order_num) orderNum = o.order_num
            }
            const notifyIds = (systemUsersRef.current || []).filter(u => {
              if (!u?.access_rights) return false
              const settings = u.notification_settings || {}
              if (isPackaging) {
                if (settings.packaging_request === false) return false
                return u.access_rights.warehouse || u.access_rights.supply
              } else {
                if (settings.material_request === false) return false
                return u.access_rights.warehouse
              }
            }).map(u => u.id)
            if (notifyIds.length > 0) {
              const buf = matReqPushBufferRef.current
              if (!buf[orderId]) {
                buf[orderId] = { items: [], isPackaging, notifyIds, orderNum }
              }
              buf[orderId].items.push(payload.new)
              if (buf[orderId].timer) clearTimeout(buf[orderId].timer)
              buf[orderId].timer = setTimeout(() => {
                const entry = buf[orderId]
                if (!entry) return
                delete buf[orderId]
                const itemCount = entry.items.length
                const num = entry.orderNum
                const title = entry.isPackaging ? '📦 Запит на комплектування' : '📋 Новий запит на СО'
                const body = entry.isPackaging
                  ? `Наряд №${num} — ${itemCount} позицій до комплектування`
                  : `Наряд №${num} — ${itemCount} позицій (листи, фрези)`
                sendPushToUsers(entry.notifyIds, title, body, '/warehouse', { tag: `req-group-${orderId}` }).catch(() => { })
              }, 1500)
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'material_requests' }, (payload) => {
          setRequests(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r))
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'material_requests' }, (payload) => {
          setRequests(prev => prev.filter(r => r.id !== payload.old.id))
        })
    }

    if (routeHasTable('reception_docs')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'reception_docs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setReceptionDocs(prev => prev.some(d => d.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setReceptionDocs(prev => prev.map(d => d.id === payload.new.id ? { ...d, ...payload.new } : d))
        } else if (payload.eventType === 'DELETE') {
          setReceptionDocs(prev => prev.filter(d => d.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('purchase_requests')) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'purchase_requests' }, (payload) => {
          setPurchaseRequests(prev => prev.some(p => p.id === payload.new.id) ? prev : [payload.new, ...prev])
          if (isLocalWrite('purchase_requests', payload.new)) {
            const notifyIds = (systemUsersRef.current || []).filter(u => {
              if (!u?.access_rights) return false
              const settings = u.notification_settings || {}
              if (settings.supply_request === false) return false
              return u.access_rights.supply || u.access_rights.procurement || u.access_rights.director
            }).map(u => u.id)
            if (notifyIds.length > 0) {
              const orderNum = payload.new?.order_num || ''
              const dest = payload.new?.destination_warehouse === 'production' ? 'СВ' : 'СО'
              sendPushToUsers(
                notifyIds,
                '🛒 Новий запит постачання',
                `Замовлення №${orderNum} → ${dest} потребує закупівлі матеріалів`,
                '/supply',
                { tag: `pr-${payload.new.id}` }
              ).catch(() => { })
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'purchase_requests' }, (payload) => {
          setPurchaseRequests(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'purchase_requests' }, (payload) => {
          setPurchaseRequests(prev => prev.filter(p => p.id !== payload.old.id))
        })
    }

    if (routeHasTable('machines')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMachines(prev => prev.some(machine => machine.id === payload.new.id)
            ? prev
            : [...prev, payload.new].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
        } else if (payload.eventType === 'UPDATE') {
          setMachines(prev => prev.map(machine => machine.id === payload.new.id
            ? { ...machine, ...payload.new }
            : machine))
        } else if (payload.eventType === 'DELETE') {
          setMachines(prev => prev.filter(machine => machine.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('machine_operations')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'machine_operations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMachineOperations(prev => prev.some(o => o.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setMachineOperations(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
        } else if (payload.eventType === 'DELETE') {
          setMachineOperations(prev => prev.filter(o => o.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('machine_calls')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'machine_calls' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMachineCalls(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev])
          if (isLocalWrite('machine_calls', payload.new)) {
            const call = payload.new
            const calledEmployeeId = call.called_employee_id
            const calledRole = call.called_role
            const operator = call.operator_name || 'Оператор'
            const machineObj = (machinesRef.current || []).find(m => m.id === call.machine_id)
            const machineName = machineObj ? machineObj.name : 'Верстат'
            let notifyIds
            if (calledEmployeeId) {
              notifyIds = [calledEmployeeId]
            } else {
              notifyIds = (systemUsersRef.current || []).filter(u => {
                if (!u?.access_rights) return false
                const settings = u.notification_settings || {}
                if (settings.machine_call === false) return false
                if (calledRole === 'master') {
                  return u.access_rights.master || u.access_rights.foreman || (u.position && u.position.toLowerCase().includes('майстер'))
                }
                if (calledRole === 'engineer') {
                  return u.access_rights.engineer || (u.position && u.position.toLowerCase().includes('інженер'))
                }
                if (calledRole === 'qc') {
                  return u.access_rights.brak || (u.position && (u.position.toLowerCase().includes('вкя') || u.position.toLowerCase().includes('якост')))
                }
                return false
              }).map(u => u.id)
            }
            if (notifyIds.length > 0) {
              let roleLabel = 'Майстра'
              let targetPath = '/master'
              if (calledRole === 'engineer') {
                roleLabel = 'Інженера'
                targetPath = '/engineer'
              }
              if (calledRole === 'qc') {
                roleLabel = 'ВКЯ'
                targetPath = '/brak'
              }
              sendPushToUsers(
                notifyIds,
                `🚨 Виклик ${roleLabel}`,
                `${operator} викликає на ${machineName}`,
                targetPath,
                { tag: `call-${payload.new.id}` }
              ).catch(() => { })
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          setMachineCalls(prev => prev.map(c => c.id === payload.new.id ? payload.new : c))
        } else if (payload.eventType === 'DELETE') {
          setMachineCalls(prev => prev.filter(c => c.id !== payload.old.id))
        }
      })
    }

    activeChannel2 = activeChannel2
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_users' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSystemUsers(prev => {
            if (prev.some(u => u.id === payload.new.id)) return prev
            const updated = [...prev, payload.new]
            return updated.sort((a, b) => (a.login || '').localeCompare(b.login || ''))
          })
        } else if (payload.eventType === 'UPDATE') {
          setSystemUsers(prev => {
            const existing = prev.find(u => u.id === payload.new.id)
            if (existing) {
              const keys = ['login', 'first_name', 'last_name', 'position', 'access_rights', 'department', 'shift', 'notification_settings', 'avatar']
              const hasChanges = keys.some(k => JSON.stringify(existing[k]) !== JSON.stringify(payload.new[k]))
              if (!hasChanges) {
                existing.last_seen = payload.new.last_seen
                return prev
              }
            }
            return prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u)
          })
        } else if (payload.eventType === 'DELETE') {
          setSystemUsers(prev => prev.filter(u => u.id !== payload.old.id))
        }
      })

    if (isSettings) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_structure' }, () => {
          supabase.from('company_structure').select('*').order('name').then(({ data, error }) => {
            if (!error && data && data.length > 0) setCompanyStructure(data)
          })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_positions' }, () => {
          supabase.from('company_positions').select('*').order('name').then(({ data, error }) => {
            if (!error && data && data.length > 0) setCompanyPositions(data)
          })
        })
    }

    let hasSubscribed = false
    let reconnectRefreshTimer = null
    activeChannel2.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      const shouldCatchUp = hasSubscribed
      hasSubscribed = true
      if (!shouldCatchUp) return

      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      reconnectRefreshTimer = setTimeout(() => {
        const targetList = secondaryTables.filter(tableName => routeHasTable(tableName))
        if (targetList.length === 0) return

        targetList.forEach(tableName => { delete targetRefreshLastRef.current[tableName] })
        fetchData(targetList).catch(error => console.warn('Secondary Realtime catch-up failed:', error))
      }, Math.floor(Math.random() * 2001))
    })

    return () => {
      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      orderHydrationTimers.forEach(timer => clearTimeout(timer))
      orderHydrationTimers.clear()
      supabase.removeChannel(activeChannel2)
    }
  }, [
    currentUser?.id,
    fetchData,
    machinesRef,
    matReqPushBufferRef,
    ordersRef,
    realtimeProfile,
    routeDataTableKey,
    routeHasTable,
    setCompanyPositions,
    setCompanyStructure,
    setCustomers,
    setMachineCalls,
    setMachineOperations,
    setMachines,
    setManagementTasks,
    setOrders,
    setPurchaseRequests,
    setReceptionDocs,
    setRequests,
    setSystemUsers,
    setTaskProjects,
    systemUsersRef,
    targetRefreshLastRef,
    tasksRef
  ])
}
