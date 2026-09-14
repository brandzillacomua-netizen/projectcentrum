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
    targetRefreshLastRef,
    lastSyncTimestampRef
  } = state

  const { refreshProductionSummary, fetchData, getTargetRefreshKey } = fetchers

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

    const primaryTopic = `mes-primary:${realtimeProfile}:${currentUser?.id || 'anon'}:${routeDataTableKey}`
    let activeChannel = supabase.channel(primaryTopic)

    // ── EGRESS OPTIMIZATION: Heavy tables are now polled instead of Realtime ──
    // if (routeHasTable('work_cards')) {
    //   activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, (payload) => {
    //     wsBatcher.enqueue('work_cards', payload)
    //   })
    // }

    // if (routeHasTable('tasks')) {
    //   activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => { ... })
    // }

    // if (routeHasTable('inventory')) {
    //   activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
    //     wsBatcher.enqueue('inventory', payload)
    //   })
    // }

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

    const catchUpWithFullRefreshFallback = async (targets) => {
      let failedTables = targets
      try {
        const result = await performIncrementalCatchUp(targets)
        failedTables = result?.failedTables || []
      } catch (error) {
        console.warn('[CatchUpSync] Incremental catch-up crashed; using full refresh:', error)
      }

      if (failedTables.length === 0) return
      console.warn(`[CatchUpSync] Falling back to full refresh for [${failedTables.join(', ')}]`)
      failedTables.forEach(tableName => {
        targetRefreshLastRef.current.delete(getTargetRefreshKey(tableName))
      })
      await fetchData(failedTables, { force: true })
    }

    const handleOnlineNetworkCatchUp = () => {
      if (onlineCatchUpTimer) clearTimeout(onlineCatchUpTimer)
      const jitterMs = 300 + Math.floor(Math.random() * 1500)
      onlineCatchUpTimer = setTimeout(() => {
        onlineCatchUpTimer = null
        const targets = ['tasks', 'work_cards', 'inventory', 'material_requests', 'orders']
          .filter(tableName => routeHasTable(tableName))
        if (targets.length > 0) {
          catchUpWithFullRefreshFallback(targets)
            .catch(error => console.warn('[CatchUpSync] Full refresh fallback failed:', error))
        }
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
        if (targets.length > 0) {
          catchUpWithFullRefreshFallback(targets)
            .catch(error => console.warn('[CatchUpSync] Full refresh fallback failed:', error))
        }
      }, reconnectJitterMs)
    })

    // ── EGRESS OPTIMIZATION: Instant Lightweight Ping Subscriptions ──
    // Instead of polling or heavy WebSocket payloads, we listen to a tiny ping table
    activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'sys_sync_pings' }, (payload) => {
      const changedTable = payload.new?.table_name
      if (changedTable && routeHasTable(changedTable)) {
        // Add random jitter to prevent thundering herd if many clients are connected
        const jitterMs = Math.floor(Math.random() * 800)
        setTimeout(() => {
          catchUpWithFullRefreshFallback([changedTable])
            .catch(error => console.warn(`[CatchUpSync] Ping refresh failed for ${changedTable}:`, error))
        }, jitterMs)
      }
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
    fetchData,
    getTargetRefreshKey,
    refreshProductionSummary,
    setInventory,
    setServerProductionData,
    setTasks,
    setWorkCardFlowTotals,
    setWorkCardHistory,
    setWorkCardScrapTotals,
    setWorkCards,
    systemUsersRef,
    targetRefreshLastRef,
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

    wsBatcher.registerHandler('material_requests', (batchEvents) => {
      setRequests(prev => {
        let next = [...prev]
        batchEvents.forEach(payload => {
          if (payload.eventType === 'UPDATE') {
            next = next.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r)
          } else if (payload.eventType === 'INSERT') {
            next = next.some(r => r.id === payload.new.id) ? next : [payload.new, ...next]
          } else if (payload.eventType === 'DELETE') {
            next = next.filter(r => r.id !== payload.old.id)
          }
        })
        return next
      })
    })

    const secondaryTopic = `mes-secondary:${realtimeProfile}:${currentUser?.id || 'anon'}:${routeDataTableKey}`
    let activeChannel2 = supabase.channel(secondaryTopic)

    // ── EGRESS OPTIMIZATION: Orders are polled instead of Realtime ──
    // if (routeHasTable('orders')) {
    //   activeChannel2 = activeChannel2
    //     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => { ... })
    //     .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => { ... })
    //     .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => { ... })
    // }

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

    /* 
      The push notifications for material_requests are currently disabled
      because material_requests are polled rather than streaming through realtime 
      to save Egress. If push notifications are needed, they should be fired
      directly from the component performing the insert.
    */

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
              const keys = ['login', 'first_name', 'last_name', 'position', 'access_rights', 'department', 'shift', 'notification_settings', 'avatar', 'last_seen']
              const hasChanges = keys.some(k => JSON.stringify(existing[k]) !== JSON.stringify(payload.new[k]))
              if (!hasChanges) {
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

        targetList.forEach(tableName => { targetRefreshLastRef.current.delete(getTargetRefreshKey(tableName)) })
        fetchData(targetList, { force: true }).catch(error => console.warn('Secondary Realtime catch-up failed:', error))
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
    getTargetRefreshKey,
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
