import { useState, useEffect, useMemo } from 'react';
import { CHAIN, translateCyrillic } from '../../utils/shop1Helpers';

export function useShop1Queue({
  workCards,
  nomenclatures,
  tasks,
  orders,
  requests,
  workCardHistory,
  scannedIds,
  manualId,
  selectedOperator,
  currentUser,
  getNom
}) {
  // Queue Filters
  const [queueSectionFilter, setQueueSectionFilter] = useState('all');
  const [activeTableFilter, setActiveTableFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');
  const [selectedTaskFilter, setSelectedTaskFilter] = useState('all');
  const [selectedNomFilter, setSelectedNomFilter] = useState('all');

  useEffect(() => {
    setSelectedNomFilter('all');
  }, [selectedTaskFilter]);

  // Auto-detect role filters from operator or currentUser
  useEffect(() => {
    if (!selectedOperator) return;
    const lower = selectedOperator.toLowerCase();
    if (lower.includes('розкрій') || lower.includes('різальн')) {
      setQueueSectionFilter('Розкрій');
    } else if (lower.includes('галтовка') || lower.includes('галтовщ')) {
      setQueueSectionFilter('Галтовка');
    } else if (lower.includes('прийомка') || lower.includes('приймальн')) {
      setQueueSectionFilter('Прийомка');
    } else if (lower.includes('сортування') || lower.includes('сортувал')) {
      setQueueSectionFilter('Сортування');
    }
  }, [selectedOperator]);

  useEffect(() => {
    if (!currentUser) return;
    const pos = String(currentUser.position || '').toLowerCase();
    const name = (String(currentUser.first_name || '') + ' ' + String(currentUser.last_name || '')).toLowerCase();
    const login = String(currentUser.login || '').toLowerCase();

    if (pos.includes('сортув') || name.includes('сортув') || login.includes('sort')) {
      setQueueSectionFilter('Сортування');
    } else if (pos.includes('прийом') || name.includes('прийом') || login.includes('recept')) {
      setQueueSectionFilter('Прийомка');
    } else if (pos.includes('галтов') || name.includes('галтов') || login.includes('tumb')) {
      setQueueSectionFilter('Галтовка');
    } else if (pos.includes('розкрій') || pos.includes('різальн') || name.includes('розкрій') || login.includes('cut')) {
      setQueueSectionFilter('Розкрій');
    }
  }, [currentUser]);

  const queueTasksOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    (workCards || []).forEach(c => {
      if (c.status === 'completed' || c.status === 'in-progress' || c.status === 'paused' || c.status === 'at-shop2-buffer') return;
      const info = String(c.card_info || '');
      if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return;
      
      const nom = nomenclatures?.find(n => n.id === c.nomenclature_id);
      if (nom && nom.type && nom.type !== 'part') return;

      const parentTask = (tasks || []).find(t => String(t.id) === String(c.task_id));
      if (parentTask) {
        if (parentTask.status === 'completed') return;
        if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return;
      }

      const isNewForShop1 = c.status === 'new' && (CHAIN.includes(c.operation) || !c.operation || c.operation === 'Нова' || c.operation === 'Розкрій');
      const isInBufferForShop1 = c.status === 'at-buffer' && CHAIN.includes(c.operation);
      const isScanned = (scannedIds || []).includes(c.id);

      if (isNewForShop1 || isInBufferForShop1 || isScanned) {
        const order = orders?.find(o => o.id === c.order_id);
        const orderNum = order?.order_num || '';
        const batchSuffix = parentTask?.batch_index ? `/${parentTask.batch_index}` : '';
        const displayLabel = `Наряд №${orderNum}${batchSuffix}`;
        const valueKey = c.task_id ? String(c.task_id) : `order-${c.order_id}`;
        
        if (valueKey && !seen.has(valueKey)) {
          seen.add(valueKey);
          list.push({ value: valueKey, label: displayLabel, orderNum });
        }
      }
    });
    return list.sort((a, b) => String(a.orderNum).localeCompare(String(b.orderNum)));
  }, [workCards, nomenclatures, tasks, orders, scannedIds]);

  const queueNomOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    (workCards || []).forEach(c => {
      if (c.status === 'completed' || c.status === 'in-progress' || c.status === 'paused' || c.status === 'at-shop2-buffer') return;
      const info = String(c.card_info || '');
      if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return;
      
      const nom = nomenclatures?.find(n => n.id === c.nomenclature_id);
      if (nom && nom.type && ['raw', 'material', 'hardware', 'fastener', 'consumable'].includes(nom.type)) return;

      const parentTask = (tasks || []).find(t => String(t.id) === String(c.task_id));
      if (parentTask) {
        if (parentTask.status === 'completed') return;
        if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return;
      }

      if (selectedTaskFilter !== 'all') {
        if (selectedTaskFilter.startsWith('order-')) {
          const orderId = selectedTaskFilter.replace('order-', '');
          if (String(c.order_id) !== orderId) return;
        } else {
          if (String(c.task_id) !== selectedTaskFilter) return;
        }
      }

      const isNewForShop1 = c.status === 'new' && (CHAIN.includes(c.operation) || !c.operation || c.operation === 'Нова' || c.operation === 'Розкрій');
      const isInBufferForShop1 = c.status === 'at-buffer' && CHAIN.includes(c.operation);
      const isScanned = (scannedIds || []).includes(c.id);

      if (isNewForShop1 || isInBufferForShop1 || isScanned) {
        if (nom && !seen.has(nom.id)) {
          seen.add(nom.id);
          list.push(nom);
        }
      }
    });
    return list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [workCards, nomenclatures, tasks, selectedTaskFilter, scannedIds]);

  const queueCards = useMemo(() => (workCards || []).filter(c => {
    if (c.status === 'completed' || c.status === 'in-progress' || c.status === 'paused' || c.status === 'at-shop2-buffer') return false;
    
    const info = String(c.card_info || '');
    if (info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return false;

    const nom = getNom(c);
    if (nom && nom.type && ['raw', 'material', 'hardware', 'fastener', 'consumable'].includes(nom.type)) return false;

    const taskReqs = (requests || []).filter(r => 
      String(r.task_id) === String(c.task_id) || 
      (r.card_id && String(r.card_id) === String(c.id))
    );
    const hasPendingKitting = taskReqs.some(r => r.status === 'pending');
    if (hasPendingKitting && c.status === 'new') return false;

    const parentTask = (tasks || []).find(t => String(t.id) === String(c.task_id));
    if (parentTask) {
      if (parentTask.status === 'completed') return false;
      if (String(parentTask.step || '').includes('[ЦЕХ №2]')) return false;
    }

    const isNewForShop1 = c.status === 'new' && (CHAIN.includes(c.operation) || !c.operation || c.operation === 'Нова' || c.operation === 'Розкрій');
    const isInBufferForShop1 = c.status === 'at-buffer' && CHAIN.includes(c.operation);
    const isScanned = (scannedIds || []).includes(c.id);

    let matchesSection = true;
    if (queueSectionFilter === 'Розкрій') {
      matchesSection = c.status === 'new' && (c.operation === 'Розкрій' || !c.operation || c.operation === 'Нова');
    } else if (queueSectionFilter === 'Галтовка') {
      matchesSection = c.status === 'at-buffer' && (c.operation === 'Розкрій' || c.operation?.startsWith('Галтовка'));
    } else if (queueSectionFilter === 'Прийомка') {
      matchesSection = c.status === 'at-buffer' && c.operation === 'Прийомка';
    } else if (queueSectionFilter === 'Сортування') {
      matchesSection = c.status === 'at-buffer' && (c.operation === 'Сортування' || c.operation === 'Прийомка');
    }

    let matchesSearch = true;
    if (manualId && manualId.trim()) {
      const q = translateCyrillic(manualId.trim()).toLowerCase();
      
      const seqMatch = (c.card_info || '').match(/(\d+)\/(\d+)/);
      const seqStr = seqMatch ? seqMatch[1] : '';
      const seqFull = seqMatch ? `${seqMatch[1]}/${seqMatch[2]}` : '';
      
      if (/^\d{1,4}$/.test(q)) {
        matchesSearch = seqStr === q;
      } else if (/^\d+\/\d*$/.test(q)) {
        matchesSearch = seqFull.startsWith(q);
      } else {
        const cardInfoLower = String(c.card_info || '').toLowerCase();
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesInfo = cardInfoLower.includes(q);
        const matchesNom = getNom(c)?.name.toLowerCase().includes(q);
        const matchesOrder = orders?.find(o => o.id === c.order_id)?.order_num?.toString().toLowerCase().includes(q);
        matchesSearch = matchesId || matchesInfo || matchesNom || matchesOrder;
      }
    }

    let matchesTask = true;
    if (selectedTaskFilter !== 'all') {
      if (selectedTaskFilter.startsWith('order-')) {
        const orderId = selectedTaskFilter.replace('order-', '');
        matchesTask = String(c.order_id) === orderId;
      } else {
        matchesTask = String(c.task_id) === selectedTaskFilter;
      }
    }

    let matchesNom = true;
    if (selectedNomFilter !== 'all') {
      matchesNom = String(c.nomenclature_id) === selectedNomFilter;
    }

    return (isNewForShop1 || isInBufferForShop1 || isScanned) && matchesSection && matchesSearch && matchesTask && matchesNom;
  }).sort((a, b) => {
    const aIsGaltBuf = a.status === 'at-buffer' && a.operation === 'Розкрій';
    const bIsGaltBuf = b.status === 'at-buffer' && b.operation === 'Розкрій';

    if (aIsGaltBuf && bIsGaltBuf) {
      const aPri = a.galt_priority || 2;
      const bPri = b.galt_priority || 2;
      if (aPri !== bPri) return aPri - bPri;
    } else if (aIsGaltBuf) {
      return -1;
    } else if (bIsGaltBuf) {
      return 1;
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  }), [workCards, requests, tasks, queueSectionFilter, manualId, selectedTaskFilter, selectedNomFilter, scannedIds, nomenclatures, orders, getNom]);

  const stageStats = (stage) => {
    const cards = (workCards || []).filter(c => {
      const matchStage = stage === 'Галтовка'
        ? (c.operation?.startsWith('Галтовка') || c.operation === 'Галтовка')
        : c.operation === stage;
      if (!matchStage) return false;
      const nom = getNom(c);
      return !nom || !['raw', 'material', 'hardware', 'fastener', 'consumable'].includes(nom.type);
    });
    return {
      inWork: cards.filter(c => c.status === 'in-progress').reduce((a, c) => a + (c.quantity || 0), 0),
      inBuffer: cards.filter(c => c.status === 'at-buffer').reduce((a, c) => a + (c.quantity || 0), 0),
      scrap: (workCardHistory || []).filter(h => {
        const matchStage = stage === 'Галтовка' ? h.stage_name?.startsWith('Галтовка') : h.stage_name === stage;
        if (!matchStage || h.is_archived_scrap) return false;
        const nom = nomenclatures?.find(n => n.id === h.nomenclature_id);
        return !nom || !['raw', 'material', 'hardware', 'fastener', 'consumable'].includes(nom.type);
      }).reduce((a, h) => a + (Number(h.scrap_qty) || 0), 0),
      total: cards.length
    };
  };

  return {
    queueSectionFilter,
    setQueueSectionFilter,
    activeTableFilter,
    setActiveTableFilter,
    queueFilter,
    setQueueFilter,
    selectedTaskFilter,
    setSelectedTaskFilter,
    selectedNomFilter,
    setSelectedNomFilter,
    queueTasksOptions,
    queueNomOptions,
    queueCards,
    stageStats
  };
}
