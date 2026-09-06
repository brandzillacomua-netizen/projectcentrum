import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Monitor,
  Package,
  AlertTriangle,
  KanbanSquare,
  ShoppingBag,
  Tablet,
  Warehouse,
  ClipboardList
} from 'lucide-react';
import { getAvailableModules } from '../../../config/moduleRegistry';
import { subscribeToPush } from '../../../services/pushService';

// Ukrainian relative time helper
export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    if (isNaN(diffMs) || diffMs < 0) return 'щойно';

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'щойно';

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} хв. тому`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} год. тому`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'вчора';
    if (diffDays < 7) return `${diffDays} дн. тому`;

    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  } catch (e) {
    return '';
  }
};

export function useNavNotifications({
  currentUser,
  isNotificationPanelOpen,
  notifSettings,
  contextData,
  supabase,
  onCloseMenu
}) {
  const {
    managementTasks,
    requests,
    workCards,
    purchaseRequests,
    receptionDocs,
    nomenclatures,
    machineCalls,
    machines,
    tasks,
    orders,
    bomItems,
    workCardHistory,
    fetchData
  } = contextData || {};

  const navigate = useNavigate();
  const prevNotificationsRef = useRef([]);
  const shownNotifsRef = useRef(new Set());
  const pageLoadTimeRef = useRef(Date.now());

  const [completedCards, setCompletedCards] = useState([]);
  const [completedHistory, setCompletedHistory] = useState([]);

  // Persistence of read notification IDs
  const [readIds, setReadIds] = useState(() => {
    if (!currentUser?.id) return [];
    try {
      const saved = localStorage.getItem(`MES_READ_NOTIF_${currentUser.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (currentUser?.id) {
      localStorage.setItem(`MES_READ_NOTIF_${currentUser.id}`, JSON.stringify(readIds));
    }
  }, [readIds, currentUser?.id]);

  const isManager = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser?.access_rights?.director ||
      currentUser?.access_rights?.master ||
      currentUser?.access_rights?.foreman ||
      (currentUser?.position && (
        currentUser.position.toLowerCase().includes('директор') ||
        currentUser.position.toLowerCase().includes('нач') ||
        currentUser.position.toLowerCase().includes('начальник') ||
        currentUser.position.toLowerCase().includes('майстер')
      ))
    );
  }, [currentUser]);

  const activeTasks = useMemo(() => {
    return (tasks || []).filter(t => t.status !== 'completed');
  }, [tasks]);

  const activeTaskIds = useMemo(() => [...new Set(activeTasks.map(task => task.id).filter(Boolean))], [activeTasks]);
  const activeTaskIdsKey = useMemo(() => activeTaskIds.map(String).sort().join('|'), [activeTaskIds]);
  const activeTaskIdSet = useMemo(() => new Set(activeTaskIds.map(String)), [activeTaskIdsKey]);
  const activeWorkCardIdsKey = useMemo(() => (workCards || [])
    .filter(card => activeTaskIdSet.has(String(card.task_id)))
    .map(card => String(card.id))
    .sort()
    .join('|'), [workCards, activeTaskIdSet]);

  // Load only the sources the current user may see, only after they open notifications
  useEffect(() => {
    if (!isNotificationPanelOpen || !currentUser?.id || typeof fetchData !== 'function') return;

    const moduleIds = new Set(getAvailableModules(currentUser, 0).map(module => module.id));
    const hasAnyModule = (...ids) => ids.some(id => moduleIds.has(id));
    const targets = new Set();

    if (moduleIds.has('kanban')) targets.add('management_tasks');

    if (hasAnyModule('director', 'master', 'foreman', 'shop1', 'shop2', 'shop2_terminal', 'packaging')) {
      ['orders', 'tasks', 'work_cards', 'nomenclatures', 'bom_items']
        .forEach(tableName => targets.add(tableName));
    }

    if (hasAnyModule('warehouse', 'supply', 'master', 'foreman', 'director')) {
      ['material_requests', 'orders', 'tasks'].forEach(tableName => targets.add(tableName));
    }

    if (hasAnyModule('warehouse', 'supply', 'procurement')) {
      ['purchase_requests', 'reception_docs'].forEach(tableName => targets.add(tableName));
    }

    if (hasAnyModule('master', 'foreman', 'engineer', 'brak', 'machines')) {
      ['machine_calls', 'machines'].forEach(tableName => targets.add(tableName));
    }

    if (targets.size > 0) {
      fetchData([...targets]).catch(error => console.warn('Notification data refresh failed:', error));
    }
  }, [isNotificationPanelOpen, currentUser?.id, fetchData]);

  useEffect(() => {
    if (!isNotificationPanelOpen || !currentUser?.id || !isManager || activeTaskIds.length === 0 || !supabase) {
      setCompletedCards([]);
      setCompletedHistory([]);
      return;
    }

    let cancelled = false;
    const loadCompletedNotificationData = async () => {
      try {
        const chunkSize = 40;
        const cardsData = [];
        for (let offset = 0; offset < activeTaskIds.length; offset += chunkSize) {
          const { data, error } = await supabase
            .from('work_cards')
            .select('*')
            .in('task_id', activeTaskIds.slice(offset, offset + chunkSize))
            .eq('status', 'completed');
          if (error) throw error;
          cardsData.push(...(data || []));
        }

        if (cancelled) return;
        setCompletedCards(cardsData);

        const activeCardIds = (workCards || [])
          .filter(card => activeTaskIdSet.has(String(card.task_id)))
          .map(card => card.id);
        const cardIds = [...new Set([...cardsData.map(card => card.id), ...activeCardIds].filter(Boolean))];
        const historyData = [];
        for (let offset = 0; offset < cardIds.length; offset += chunkSize) {
          const { data, error } = await supabase
            .from('work_card_history')
            .select('card_id, nomenclature_id, scrap_qty')
            .in('card_id', cardIds.slice(offset, offset + chunkSize));
          if (error) throw error;
          historyData.push(...(data || []));
        }

        if (!cancelled) setCompletedHistory(historyData);
      } catch (error) {
        if (!cancelled) console.error('Error fetching completed cards for notifications:', error);
      }
    };

    loadCompletedNotificationData();
    return () => { cancelled = true; };
  }, [isNotificationPanelOpen, currentUser?.id, isManager, activeTaskIdsKey, activeWorkCardIdsKey, supabase]);

  // Compile notification feed from 10 sources matching role access
  const notifications = useMemo(() => {
    const list = [];
    if (!currentUser) return list;
    const availableModules = getAvailableModules(currentUser, 0);
    const hasModule = (id) => availableModules.some(m => m.id === id);

    // 0. New Orders awaiting Batch/Task Creation
    const hasOrderCreationAccess = hasModule('director') || hasModule('master') || hasModule('foreman');
    if (hasOrderCreationAccess && orders) {
      orders.forEach(order => {
        if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return;

        const orderTasks = (tasks || []).filter(t => t.order_id === order.id);
        if (orderTasks.length === 0 && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'shipped') {
          let path = '/';
          if (hasModule('master')) path = '/master';
          else if (hasModule('foreman')) path = '/foreman';
          else if (hasModule('director')) path = '/director';

          const productNames = (order.order_items || [])
            .map(it => nomenclatures?.find(n => n.id === it.nomenclature_id)?.name)
            .filter(Boolean)
            .join(', ') || '—';

          list.push({
            id: `order-new-${order.id}`,
            type: 'order_new',
            title: `Нове замовлення № ${order.order_num}`,
            description: `Очікує на створення наряду. Виріб: ${productNames}`,
            createdAt: order.created_at,
            path,
            color: '#3b82f6',
            icon: <Monitor size={14} />
          });
        }
      });
    }

    // 1. Kanban Tasks
    if (hasModule('kanban') && managementTasks) {
      managementTasks.forEach(t => {
        if (t.status !== 'done' && (t.assigned_to === currentUser.login || t.created_by === currentUser.login)) {
          list.push({
            id: `task-${t.id}`,
            type: 'task',
            title: `Задача: ${t.title || 'Без назви'}`,
            description: t.description || 'Немає опису',
            createdAt: t.created_at,
            path: '/tasks',
            color: '#8b5cf6',
            icon: <KanbanSquare size={14} />
          });
        }
      });
    }

    // 2. Material Requests
    const hasWarehouseAccess = hasModule('warehouse') || hasModule('supply') || hasModule('master') || hasModule('foreman') || hasModule('director');
    if (hasWarehouseAccess && requests) {
      const groups = {};
      requests.forEach(r => {
        if (r.status === 'pending') {
          const order = orders?.find(o => o.id === r.order_id);
          const orderNum = order?.order_num || '';

          let batchIndex = '';
          if (r.details) {
            const batchMatch = r.details.match(/\(([^)]+\/\d+)\)/);
            if (batchMatch) {
              const parts = batchMatch[1].split('/');
              batchIndex = parts[parts.length - 1];
            }
          }
          if (!batchIndex && r.task_id && tasks) {
            const task = tasks.find(t => t.id === r.task_id);
            if (task?.batch_index) batchIndex = task.batch_index;
          }

          const groupKey = `${r.order_id}_${r.task_id || 'null'}_${batchIndex || 'no-batch'}`;

          if (!groups[groupKey]) {
            groups[groupKey] = {
              orderId: r.order_id,
              orderNum: orderNum,
              batchIndex: batchIndex,
              taskId: r.task_id,
              count: 0,
              items: [],
              latestCreatedAt: r.created_at
            };
          }

          groups[groupKey].count += 1;
          if (r.created_at > groups[groupKey].latestCreatedAt) {
            groups[groupKey].latestCreatedAt = r.created_at;
          }

          let itemName = '';
          if (r.details) {
            const splitCol = r.details.split(': ');
            if (splitCol.length > 1) {
              itemName = splitCol[1].split(' — ')[0];
            } else {
              itemName = r.details;
            }
          }
          if (itemName) {
            groups[groupKey].items.push(itemName);
          }
        }
      });

      Object.entries(groups).forEach(([key, g]) => {
        let path = '/';
        if (hasModule('supply')) path = '/supply';
        else if (hasModule('warehouse')) path = '/warehouse';
        else if (hasModule('foreman')) path = '/foreman';
        else if (hasModule('master')) path = '/master';
        else if (hasModule('director')) path = '/director';

        const batchStr = g.batchIndex ? `/${g.batchIndex}` : '';
        const orderPart = g.orderNum ? ` (№ ${g.orderNum}${batchStr})` : '';

        let desc = '';
        if (g.count === 1) {
          desc = g.items[0] || 'Новий запит матеріалу';
        } else {
          desc = `Запит на ${g.count} позицій: ${g.items.slice(0, 3).join(', ')}${g.items.length > 3 ? '...' : ''}`;
        }

        list.push({
          id: `req-group-${key}`,
          type: 'request',
          title: `Запит матеріалів${orderPart}`,
          description: desc,
          createdAt: g.latestCreatedAt,
          path,
          color: '#10b981',
          icon: <ClipboardList size={14} />,
          state: { highlightTaskId: g.taskId }
        });
      });
    }

    // 3. Work Cards (Shop 1 or Shop 2)
    if (workCards) {
      workCards.forEach(w => {
        if (w.status === 'new') {
          const op = (w.operation || '').toLowerCase();
          const isShop1 = ['розкрій', 'галтовка', 'прийомка'].some(o => op.includes(o));
          const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання'].some(o => op.includes(o));

          let isRelevant = false;
          let path = '/';

          if (isShop1) {
            isRelevant = hasModule('shop1') || hasModule('master') || hasModule('foreman') || hasModule('director');
            if (isRelevant) {
              if (hasModule('shop1')) path = '/shop1';
              else if (hasModule('master')) path = '/master';
              else if (hasModule('foreman')) path = '/foreman';
              else if (hasModule('director')) path = '/director';
            }
          } else if (isShop2) {
            isRelevant = hasModule('shop2_terminal') || hasModule('shop2') || hasModule('master') || hasModule('foreman') || hasModule('director');
            if (isRelevant) {
              if (hasModule('shop2_terminal')) path = '/shop2-terminal';
              else if (hasModule('shop2')) path = '/shop2';
              else if (hasModule('foreman')) path = '/foreman';
              else if (hasModule('master')) path = '/master';
              else if (hasModule('director')) path = '/director';
            }
          } else {
            isRelevant = hasModule('master') || hasModule('foreman') || hasModule('director');
            if (isRelevant) {
              if (hasModule('foreman')) path = '/foreman';
              else if (hasModule('master')) path = '/master';
              else if (hasModule('director')) path = '/director';
            }
          }

          if (isRelevant) {
            list.push({
              id: `wc-${w.id}`,
              type: 'work_card',
              title: `Нова картка: ${w.operation || 'Операція'}`,
              description: w.card_info || `Кількість: ${w.quantity}`,
              createdAt: w.created_at,
              path,
              color: '#eab308',
              icon: <Tablet size={14} />
            });
          }
        }
      });
    }

    // 4. Purchase Requests
    const hasSupplyProcurementAccess = hasModule('supply') || hasModule('procurement') || hasModule('warehouse');
    if (hasSupplyProcurementAccess && purchaseRequests) {
      purchaseRequests.forEach(pr => {
        if (pr.status === 'pending') {
          let path = '/';
          if (hasModule('procurement')) path = '/procurement';
          else if (hasModule('supply')) path = '/supply';
          else if (hasModule('warehouse')) path = '/warehouse';

          list.push({
            id: `pr-${pr.id}`,
            type: 'purchase_request',
            title: `Запит закупівлі ${pr.order_num ? `(№${pr.order_num})` : ''}`,
            description: pr.nomenclature_name || pr.details || (pr.items && pr.items.length > 0 ? pr.items.map(it => `${it.name || 'ТМЦ'} (к-ть: ${it.qty || it.quantity})`).join(', ') : 'Очікує розгляду'),
            createdAt: pr.created_at,
            path,
            color: '#ec4899',
            icon: <ShoppingBag size={14} />
          });
        }
      });
    }

    // 5. Reception Docs
    if (hasSupplyProcurementAccess && receptionDocs) {
      receptionDocs.forEach(rec => {
        if (rec.status === 'ordered' || rec.status === 'shipped') {
          let path = '/';
          if (rec.target_warehouse === 'operational' && hasModule('warehouse')) {
            path = '/warehouse';
          } else if (rec.target_warehouse === 'production' && hasModule('supply')) {
            path = '/supply';
          } else {
            if (hasModule('procurement')) path = '/procurement';
            else if (hasModule('supply')) path = '/supply';
            else if (hasModule('warehouse')) path = '/warehouse';
          }

          const docId = rec.order_id === null && rec.task_id === null
            ? `№РП-${String(rec.id).substring(0, 6).toUpperCase()}`
            : `#${String(rec.id).substring(0, 6)}`;

          list.push({
            id: `rec-${rec.id}`,
            type: 'reception_doc',
            title: `Прийомка ${docId} (${rec.status === 'shipped' ? 'Відправлено' : 'Замовлено'})`,
            description: rec.items && rec.items.length > 0 ? rec.items.map(it => `${it.name || 'ТМЦ'} (к-ть: ${it.qty || it.quantity})`).join(', ') : 'Очікує надходження',
            createdAt: rec.created_at,
            path,
            color: '#06b6d4',
            icon: <Warehouse size={14} />
          });
        }
      });
    }

    // 6. Machine Calls
    if (machineCalls) {
      machineCalls.forEach(c => {
        if (c.status === 'pending') {
          const mach = machines?.find(m => m.id === c.machine_id);
          const machName = mach ? mach.name : 'Верстат';

          let isRelevant = false;
          let roleLabel = '';

          if (c.called_employee_id) {
            isRelevant = currentUser?.id === c.called_employee_id;
          } else {
            if (c.called_role === 'master') {
              isRelevant = currentUser?.access_rights?.master || currentUser?.access_rights?.foreman;
            } else if (c.called_role === 'engineer') {
              isRelevant = currentUser?.access_rights?.engineer;
            } else if (c.called_role === 'quality' || c.called_role === 'qc') {
              isRelevant = currentUser?.access_rights?.brak || currentUser?.position?.toLowerCase().includes('вкя') || currentUser?.position?.toLowerCase().includes('якост');
            }
          }

          if (c.called_role === 'master') {
            roleLabel = 'Майстра';
          } else if (c.called_role === 'engineer') {
            roleLabel = 'Інженера';
          } else if (c.called_role === 'quality' || c.called_role === 'qc') {
            roleLabel = 'ВКЯ';
          }

          if (isRelevant) {
            list.push({
              id: `call-${c.id}`,
              type: 'machine_call',
              title: `⚠️ Виклик ${roleLabel}`,
              description: `Верстат: ${machName}. Локація: ${mach?.floor || 'Не вказано'}. ${c.operator_name ? `Викликав: ${c.operator_name}` : ''}${c.called_employee_name ? ` (Для: ${c.called_employee_name})` : ''}`,
              createdAt: c.created_at,
              path: '/machines',
              color: '#ef4444',
              icon: <AlertTriangle size={14} />
            });
          }
        }
      });
    }

    // 7. Shortage / Dovyпуск notifications for Managers
    if (isManager && tasks) {
      const prodCache = {};
      const sCache = {};
      const rCache = {};

      const activeTaskIdSetLocal = new Set(activeTasks.map(t => t.id));
      const activeCards = (workCards || []).filter(c => activeTaskIdSetLocal.has(c.task_id));
      const allCards = [...activeCards, ...completedCards];

      const countAsProduced = (card) => {
        if (card.status === 'completed') return true;
        if (card.status === 'at-shop2-buffer') return true;
        return false;
      };

      allCards.forEach(card => {
        const tid = card.task_id;
        const nid = String(card.nomenclature_id);

        if (!prodCache[tid]) prodCache[tid] = {};
        if (!sCache[tid]) sCache[tid] = {};
        if (!rCache[tid]) rCache[tid] = {};

        if (countAsProduced(card)) {
          prodCache[tid][nid] = (prodCache[tid][nid] || 0) + (Number(card.quantity) || 0);
        }

        const isRedo = (card.card_info || '').includes('[REDO]');
        const isActive = !countAsProduced(card);
        if (isRedo && isActive) {
          rCache[tid][nid] = true;
        }
      });

      const activeCardIds = new Set(activeCards.map(c => c.id));
      const activeHistory = (workCardHistory || []).filter(h => h.card_id && activeCardIds.has(h.card_id));
      const allHistory = [...completedHistory, ...activeHistory];

      const cardScrapCache = {};
      allHistory.forEach(h => {
        if (h.card_id) {
          cardScrapCache[h.card_id] = (cardScrapCache[h.card_id] || 0) + (Number(h.scrap_qty) || 0);
        }
        const card = allCards.find(c => c.id === h.card_id);
        if (card) {
          const tid = card.task_id;
          const nid = String(card.nomenclature_id);
          if (!sCache[tid]) sCache[tid] = {};
          sCache[tid][nid] = (sCache[tid][nid] || 0) + (Number(h.scrap_qty) || 0);
        }
      });

      activeTasks.forEach(task => {
        const snapshot = task.plan_snapshot || {};
        const taskScrap = sCache[task.id] || {};
        const taskCards = allCards.filter(c => c.task_id === task.id);

        let hasShortage = false;
        let shortageDetails = '';

        Object.keys(snapshot).forEach(nomIdStr => {
          if (hasShortage) return;
          const nom = nomenclatures?.find(n => String(n.id) === String(nomIdStr));
          if (nom?.type !== 'part') return;
          const snap = snapshot[nomIdStr];
          if (!snap) return;

          const need = snap.need || 0;
          const stockBZ = snap.stock || 0;
          const unitsPerSheet = snap.units_per_sheet || 1;

          const activeCardsForNom = taskCards.filter(c => String(c.nomenclature_id) === String(nomIdStr));
          const activeProductionCards = activeCardsForNom.filter(c => c.operation !== 'Склад БЗ');
          if (activeProductionCards.length === 0) return;

          const totalSheets = activeCardsForNom.reduce((sum, c) => {
            if (c.operation === 'Склад БЗ') return sum;
            const cardScrap = cardScrapCache[c.id] || 0;
            const originalQty = (Number(c.quantity) || 0) + cardScrap;
            return sum + (c.actualSheets ? Number(c.actualSheets) : Math.ceil(originalQty / unitsPerSheet));
          }, 0);

          const totalBZ = (totalSheets * unitsPerSheet) + stockBZ - need;
          const groupScrap = taskScrap[nomIdStr] || 0;
          const shortage = (totalBZ - groupScrap) < 0 ? Math.abs(totalBZ - groupScrap) : 0;

          if (shortage > 0) {
            hasShortage = true;
            shortageDetails = `${nom.name || 'деталь'} (нестача: ${shortage} шт.)`;
          }
        });

        if (hasShortage) {
          const order = orders?.find(o => o.id === task.order_id);
          const orderNum = order ? order.order_num : '???';
          const customer = order ? order.customer : '???';

          list.push({
            id: `shortage-${task.id}`,
            type: 'shortage',
            title: `⚠️ Потрібен довипуск: Наряд №${orderNum}`,
            description: `Нестача по: ${shortageDetails}. Замовник: ${customer}`,
            createdAt: task.created_at || new Date().toISOString(),
            path: '/foreman',
            state: { taskId: task.id },
            color: '#ef4444',
            icon: <AlertTriangle size={14} />
          });
        }
      });
    }

    // 8. Notifications for Shop 1 Manager / Director of Production about tasks ready to close
    const isShop1ManagerOrDirector = currentUser && (
      currentUser.access_rights?.director ||
      currentUser.access_rights?.master ||
      currentUser.access_rights?.foreman ||
      (currentUser.position && (
        currentUser.position.toLowerCase().includes('директор') ||
        (currentUser.position.toLowerCase().includes('начальник') && currentUser.position.toLowerCase().includes('цех')) ||
        currentUser.position.toLowerCase().includes('майстер') ||
        currentUser.position.toLowerCase().includes('бригадир')
      ))
    );

    if (isShop1ManagerOrDirector && tasks && orders) {
      const shop1Tasks = tasks.filter(t =>
        t.status !== 'completed' &&
        !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
      );

      shop1Tasks.forEach(task => {
        const orderObj = orders.find(o => o.id === task.order_id);
        if (!orderObj) return;

        const snapshot = task.plan_snapshot || {};
        const snapshotValues = Object.values(snapshot).filter(v => v && typeof v === 'object' && v.id && v.is_rework);

        let itemsToCheck = [];
        if (snapshotValues.length > 0) {
          itemsToCheck = snapshotValues.map(s => ({
            nom: (nomenclatures || []).find(n => String(n.id) === String(s.id)) || { id: s.id, name: s.name, type: 'part' }
          }));
        } else {
          itemsToCheck = (orderObj.order_items || []).flatMap(item => {
            const parentId = item?.nomenclature_id;
            const parts = (bomItems || []).filter(b => b.parent_id === parentId).map(b => ({
              ...b,
              nom: nomenclatures?.find(n => n.id === b.child_id)
            }));
            if (parts.length > 0) {
              return parts.map(p => ({ nom: p.nom }));
            }
            return [{ nom: (nomenclatures || []).find(n => String(n?.id) === String(item?.nomenclature_id)) }];
          });
        }

        const filteredParts = itemsToCheck.filter(item => item.nom?.type === 'part');
        if (filteredParts.length === 0) return;

        const taskCards = (workCards || []).filter(c => String(c.task_id) === String(task.id));
        const allCards = [
          ...taskCards,
          ...(completedCards || []).filter(sc => String(sc.task_id) === String(task.id))
        ];

        const hasCards = allCards.length > 0;
        const allCompleted = hasCards && allCards.every(c => c.status === 'completed' || c.status === 'at-shop2-buffer');

        if (allCompleted) {
          const orderNum = orderObj.order_num || '???';
          list.push({
            id: `ready-close-s1-${task.id}`,
            type: 'ready_close_s1',
            title: `✅ Наряд №${orderNum} виконано в Цеху 1!`,
            description: `Всі карти розкрою завершені. Потрібно закрити наряд у Цеху №1 для передачі в Цех №2.`,
            createdAt: task.updated_at || task.created_at || new Date().toISOString(),
            path: '/foreman',
            state: { highlightTaskId: task.id },
            color: '#10b981',
            icon: <ClipboardList size={14} />
          });
        }
      });
    }

    // 9. Notifications for Shop 2 Manager / Director of Production about tasks ready to close
    const isShop2ManagerOrDirector = currentUser && (
      currentUser.access_rights?.director ||
      (currentUser.position && (
        currentUser.position.toLowerCase().includes('директор') ||
        (currentUser.position.toLowerCase().includes('начальник') && currentUser.position.toLowerCase().includes('цех'))
      )) ||
      hasModule('shop2')
    );

    if (isShop2ManagerOrDirector && tasks && orders) {
      const shop2Tasks = tasks.filter(t =>
        t.status !== 'completed' &&
        (t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
      );

      shop2Tasks.forEach(task => {
        const orderObj = orders.find(o => o.id === task.order_id);
        if (!orderObj) return;

        const snapshot = task.plan_snapshot || {};
        const arrivals = snapshot.arrivals || [];

        let itemsToCheck = [];
        const snapshotValues = Object.values(snapshot).filter(v => v && typeof v === 'object' && v.id && v.is_rework);
        if (snapshotValues.length > 0) {
          itemsToCheck = snapshotValues.map(s => ({
            nom: (nomenclatures || []).find(n => String(n.id) === String(s.id)) || { id: s.id, name: s.name, type: 'part' },
            need: Number(s.need) || 0
          }));
        } else if (arrivals.length > 0) {
          itemsToCheck = arrivals.map(a => ({
            nom: (nomenclatures || []).find(n => String(n?.id) === String(a?.id)),
            need: Number(snapshot[String(a?.id)]?.plan ?? snapshot[String(a?.id)]?.need ?? a?.semi ?? 0)
          }));
        } else {
          itemsToCheck = (orderObj.order_items || []).flatMap(item => {
            const parentId = item?.nomenclature_id;
            const parts = (bomItems || []).filter(b => b.parent_id === parentId).map(b => ({
              ...b,
              nom: nomenclatures?.find(n => n.id === b.child_id)
            }));
            if (parts.length > 0) {
              return parts.map(p => ({
                nom: p.nom,
                need: Number(snapshot[String(p.nom?.id)]?.plan ?? snapshot[String(p.nom?.id)]?.need ?? (Number(item?.quantity) || 0) * (Number(p.quantity_per_parent) || 1))
              }));
            }
            return [{
              nom: (nomenclatures || []).find(n => String(n?.id) === String(item?.nomenclature_id)),
              need: Number(snapshot[String(item?.nomenclature_id)]?.plan ?? snapshot[String(item?.nomenclature_id)]?.need ?? item?.quantity ?? 0)
            }];
          });
        }

        const filteredParts = itemsToCheck.filter(item => item.nom?.type === 'part');
        if (filteredParts.length === 0) return;

        const s1Task = tasks.find(t =>
          String(t.order_id) === String(task.order_id) &&
          t.batch_index === task.batch_index &&
          !(t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання'))
        );

        const isReworkOrDirectTask = !s1Task || 
          task.step?.includes('Доопрацювання') || 
          orderObj?.order_num?.startsWith('ВБ') || 
          Boolean(task.plan_snapshot && Object.values(task.plan_snapshot).some(v => v && typeof v === 'object' && v.is_rework));

        let isAllDone = false;
        if (isReworkOrDirectTask || (s1Task && s1Task.status === 'completed')) {
          const taskCards = (workCards || []).filter(wc => String(wc.task_id) === String(task.id));
          const hasUncompleted = taskCards.some(wc => wc.status !== 'completed');

          if (!hasUncompleted) {
            isAllDone = filteredParts.every(item => {
              const nomId = item.nom?.id;
              if (!nomId) return true;

              const bufSrcCards = (workCards || []).filter(c =>
                (s1Task ? String(c.task_id) === String(s1Task.id) : String(c.order_id) === String(task.order_id)) &&
                String(c.nomenclature_id) === String(nomId) &&
                c.status === 'at-shop2-buffer'
              );
              const bufTotal = bufSrcCards.reduce((s, c) => s + (Number(c.quantity) || 0), 0);
              const bufUsed = bufSrcCards.reduce((s, c) => s + (Number(c.used_in_shop2_qty) || 0), 0);
              const total2 = bufTotal - bufUsed;

              if (total2 > 0) {
                return false;
              }
              return true;
            });
          }
        }

        if (isAllDone) {
          const orderNum = orderObj.order_num || '???';
          list.push({
            id: `ready-close-${task.id}`,
            type: 'ready_close',
            title: `✅ Наряд №${orderNum} виконано!`,
            description: `Всі деталі виготовлено. Потрібно закрити наряд у Цеху №2 для передачі на Пакування.`,
            createdAt: task.updated_at || task.created_at || new Date().toISOString(),
            path: '/shop2',
            state: { highlightTaskId: task.id },
            color: '#10b981',
            icon: <ClipboardList size={14} />
          });
        }
      });
    }

    // 10. Notifications for Packers and Director of Production when a Shop 2 task is closed (completed)
    const isPackerOrDirector = currentUser && (
      currentUser.access_rights?.director ||
      currentUser.access_rights?.packaging ||
      (currentUser.position && (
        currentUser.position.toLowerCase().includes('пакув') ||
        currentUser.position.toLowerCase().includes('директор')
      ))
    );

    if (isPackerOrDirector && tasks && orders) {
      const completedShop2Tasks = tasks.filter(t =>
        t.status === 'completed' &&
        (t.step?.includes('Пресування') || t.step?.includes('ЦЕХ №2') || t.step?.includes('Доопрацювання')) &&
        t.plan_snapshot?._metadata?.is_packaged !== true
      );

      completedShop2Tasks.forEach(task => {
        const orderObj = orders.find(o => o.id === task.order_id);
        if (!orderObj) return;

        const orderNum = orderObj.order_num || '???';
        const bIdx = task.batch_index || '1';

        list.push({
          id: `ready-package-${task.id}`,
          type: 'ready_package',
          title: `📦 Наряд №${orderNum}/${bIdx} готовий до Пакування!`,
          description: `Наряд закрито в Цеху №2. Можна починати комплектування та пакування замовлення.`,
          createdAt: task.updated_at || task.created_at || new Date().toISOString(),
          path: '/packaging',
          state: { highlightTaskId: task.id },
          color: '#f43f5e',
          icon: <Package size={14} />
        });
      });
    }

    const filteredList = list.filter(n => {
      if (n.type === 'order_new') return notifSettings?.new_order !== false;
      if (n.type === 'task') return notifSettings?.kanban !== false;
      if (n.type === 'request') {
        const isPackaging = n.title?.toLowerCase().includes('комплектування') || n.description?.toLowerCase().includes('комплектування');
        return isPackaging ? notifSettings?.packaging_request !== false : notifSettings?.material_request !== false;
      }
      if (n.type === 'purchase_request') return notifSettings?.supply_request !== false;
      if (n.type === 'machine_call') return notifSettings?.machine_call !== false;
      if (n.type === 'shortage') return notifSettings?.shortage !== false;
      if (n.type === 'ready_close_s1' || n.type === 'ready_close') return notifSettings?.task_completed !== false;
      if (n.type === 'ready_package') return notifSettings?.packaging_request !== false;
      return true;
    });

    const uniqueFilteredList = [];
    const seenIds = new Set();
    filteredList.forEach(n => {
      if (!seenIds.has(n.id)) {
        seenIds.add(n.id);
        uniqueFilteredList.push(n);
      }
    });

    return uniqueFilteredList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [
    currentUser,
    managementTasks,
    requests,
    workCards,
    purchaseRequests,
    receptionDocs,
    machineCalls,
    machines,
    isManager,
    activeTasks,
    completedCards,
    completedHistory,
    tasks,
    orders,
    bomItems,
    workCardHistory,
    notifSettings
  ]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  // Push subscription
  useEffect(() => {
    if (!currentUser?.id) return;
    const timer = setTimeout(() => {
      subscribeToPush(currentUser.id).then(ok => {
        if (ok) console.log('[Push] ✅ Пристрій підписано для юзера', currentUser.id);
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);

  const handleNotificationClick = useCallback((n) => {
    if (!readIds.includes(n.id)) {
      setReadIds(prev => [...prev, n.id]);
    }
    if (typeof onCloseMenu === 'function') onCloseMenu();
    navigate(n.path, n.state ? { state: n.state } : undefined);
  }, [readIds, onCloseMenu, navigate]);

  const handleMarkAllAsRead = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => {
      const unique = new Set([...prev, ...allIds]);
      return Array.from(unique);
    });
  }, [notifications]);

  // SW navigation messages
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        navigate(event.data.path, event.data.state ? { state: event.data.state } : undefined);
      }
      if (event.data && event.data.type === 'SUBSCRIPTION_CHANGED' && currentUser?.id) {
        subscribeToPush(currentUser.id);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [navigate, currentUser?.id]);

  // Monitor notifications and trigger HTML5 Push when a new unread arrives
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const prevIds = new Set((prevNotificationsRef.current || []).map(n => n.id));
    const cutoffTime = pageLoadTimeRef.current - 5000;
    const newUnread = notifications.filter(n => {
      const created = new Date(n.createdAt).getTime();

      const webPushTypes = ['order_new', 'request', 'reception_doc', 'purchase_request', 'machine_call'];
      if (webPushTypes.includes(n.type)) return false;

      const storageKey = `centrum_shown_notif_${n.id}`;
      const lastShown = localStorage.getItem(storageKey);
      if (lastShown && Date.now() - Number(lastShown) < 30000) {
        return false;
      }

      return created > cutoffTime &&
        !prevIds.has(n.id) &&
        !readIds.includes(n.id) &&
        !shownNotifsRef.current.has(n.id);
    });

    newUnread.forEach(n => {
      try {
        shownNotifsRef.current.add(n.id);
        localStorage.setItem(`centrum_shown_notif_${n.id}`, String(Date.now()));
        const options = {
          body: n.description,
          icon: '/kulytsya.png',
          tag: n.id,
          data: {
            id: n.id,
            title: n.title,
            description: n.description,
            path: n.path,
            state: n.state,
            link: n.link
          }
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(n.title, options);
          }).catch(() => {
            const notif = new Notification(n.title, options);
            notif.onclick = () => {
              window.focus();
              handleNotificationClick(n);
              notif.close();
            };
          });
        } else {
          const notif = new Notification(n.title, options);
          notif.onclick = () => {
            window.focus();
            handleNotificationClick(n);
            notif.close();
          };
        }
      } catch (err) {
        console.warn('Failed to trigger native notification:', err);
      }
    });

    prevNotificationsRef.current = notifications;
  }, [notifications, readIds, handleNotificationClick]);

  return {
    notifications,
    unreadCount,
    readIds,
    handleNotificationClick,
    handleMarkAllAsRead,
    formatRelativeTime
  };
}
