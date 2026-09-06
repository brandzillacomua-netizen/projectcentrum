import { useRef } from 'react';
import {
  stripCuttersBreakdown,
  CHAIN,
  getMachineSequenceConfig,
  formatMachineSequence
} from '../../utils/shop1Helpers';
import { recordSortingHistoryGuaranteed } from '../../../../services/sortingHistoryService';
import { executeAtomicQcScrap } from '../../../../services/atomicQcScrapService';
import { incrementInventoryStock } from '../../../../services/inventoryStockService';
import { executeAtomicCardTransition } from '../../../../services/atomicCardTransitionService';

export function useShop1CardWorkflow({
  currentCard,
  selectedOperator,
  selectedShift,
  selectedMachine,
  machineNumber,
  selectedManager,
  finalOperator,
  scrapOperator,
  modals,
  selectedCardId,
  setSelectedCardId,
  selectedCardHistory,
  setSelectedCardHistory,
  workCards,
  setWorkCards,
  nomenclatures,
  tasks,
  orders,
  machines,
  systemUsers,
  requests,
  inventory,
  workCardHistory,
  createWorkCard,
  fetchData,
  supabase,
  scannedIds,
  setScannedIds,
  setIsProcessing,
  maintenanceCheckEnabled,
  formatUserName,
  getCuttersForCard,
  nextStageFor,
  currentUser
}) {
  const inFlightRef = useRef(false);
  const {
    scrapCount,
    setScrapCount,
    reworkCount,
    setReworkCount,
    cuttersBreakdown,
    cuttersTouched,
    setShowCompleteModal,
    shiftChangeOperator,
    setShiftChangeOperator,
    shiftChangeShift,
    setShiftChangeShift,
    setShowShiftChangeModal,
    pauseReason,
    customPauseReason,
    setCustomPauseReason,
    setShowPauseModal,
    qcScrapCount,
    setQcScrapCount,
    qcInspector,
    setQcInspector,
    qcReason,
    setQcReason,
    qcCustomReason,
    setQcCustomReason,
    setShowQCModal,
    showAlert
  } = modals;

  const updateInventoryStock = async (nomId, qty, type = 'semi') => {
    if (!nomId || qty <= 0) return { error: null };
    try {
      await incrementInventoryStock({
        nomenclatureId: nomId,
        qty,
        type,
        nomenclatures
      });
      return { error: null };
    } catch (e) {
      console.warn(`Stock update failed for type ${type}:`, e);
      throw e;
    }
  };

  const handleCuttersInventoryDeduction = async (card, breakdown) => {
    if (card.operation !== 'Розкрій' || !breakdown || Object.keys(breakdown).length === 0) return;

    const items = [];
    for (const [cutterName, actualQtyVal] of Object.entries(breakdown)) {
      const actualQty = Number(actualQtyVal) || 0;
      if (actualQty <= 0) continue;

      const nom = nomenclatures?.find(n => n.name?.trim().toLowerCase() === cutterName.trim().toLowerCase() && n.type === 'consumable');
      if (!nom) throw new Error(`Не знайдено номенклатуру фрези «${cutterName}»`);
      items.push({ nomenclature_id: nom.id, quantity: actualQty });
    }

    if (items.length === 0) return;
    const actorName = formatUserName(currentUser) || currentUser?.login || selectedOperator || 'Оператор терміналу';
    const { error } = await supabase.rpc('register_cutter_usage', {
      p_source_card_id: card.id,
      p_items: items,
      p_actor_id: currentUser?.id || null,
      p_actor_name: actorName,
      p_source_metadata: {
        operator_name: selectedOperator || card.operator_name || null,
        manager_name: card.manager_name || null,
        machine_name: card.machine || null
      }
    });
    if (error) throw error;
  };

  const validateCuttersUsageLimit = async () => {
    return true;
  };

  const verifyCardBeforeMasterScrap = async () => {
    if (!currentCard) return true;
    if ((scrapCount || 0) <= 0) return true;

    try {
      const [cardResult, qcResult] = await Promise.all([
        supabase.from('work_cards').select('id,quantity,status').eq('id', currentCard.id).maybeSingle(),
        supabase.from('work_card_history').select('*')
          .eq('card_id', currentCard.id)
          .eq('stage_name', 'Контроль ВКЯ')
          .gt('scrap_qty', 0)
          .order('created_at', { ascending: true })
      ]);

      if (cardResult?.data) {
        const quantityChanged = Number(cardResult.data.quantity) !== Number(currentCard.quantity);
        if (quantityChanged && typeof setWorkCards === 'function') {
          setWorkCards(previous => previous.map(card => String(card.id) === String(currentCard.id)
            ? { ...card, quantity: cardResult.data.quantity, status: cardResult.data.status }
            : card));
        }
      }

      if (qcResult?.data && qcResult.data.length > 0) {
        const knownHistoryIds = new Set((selectedCardHistory || workCardHistory || []).map(row => String(row.id)));
        const freshQcRows = qcResult.data || [];
        const newQcRows = freshQcRows.filter(row => !knownHistoryIds.has(String(row.id)));

        if (newQcRows.length > 0) {
          if (typeof setSelectedCardHistory === 'function') {
            setSelectedCardHistory(previous => {
              const byId = new Map(previous.map(row => [String(row.id), row]));
              freshQcRows.forEach(row => byId.set(String(row.id), { ...byId.get(String(row.id)), ...row }));
              return Array.from(byId.values()).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            });
          }

          setScrapCount(0);
          const addedByQc = newQcRows.reduce((sum, row) => sum + (Number(row.scrap_qty) || 0), 0);
          alert(`ВКЯ вже вніс ${addedByQc > 0 ? `${addedByQc} шт ` : ''}браку по цій картці. Дані оновлено.`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn('Non-fatal error verifying QC scrap before master action:', error);
      return true;
    }
  };

  const handleStart = async () => {
    if (!currentCard || !selectedOperator || !selectedShift) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      const startOp = CHAIN.includes(currentCard.operation) ? currentCard.operation : CHAIN[0];
      const machineSequenceConfig = getMachineSequenceConfig(selectedMachine);
      const sequenceNumber = Number(machineNumber);
      if (startOp === 'Розкрій' && machineNumber && (
        !Number.isInteger(sequenceNumber) || sequenceNumber < machineSequenceConfig.min ||
        (machineSequenceConfig.max !== null && sequenceNumber > machineSequenceConfig.max)
      )) {
        setIsProcessing(false);
        const range = machineSequenceConfig.max === null ? `від ${machineSequenceConfig.min}` : `${machineSequenceConfig.min}–${machineSequenceConfig.max}`;
        showAlert(`Введіть порядковий номер верстата в діапазоні ${range}.`, '❌ Некоректний номер верстата');
        return;
      }
      const fullMachineNumber = formatMachineSequence(selectedMachine, machineNumber);
      const targetMachine = fullMachineNumber ? `${selectedMachine} №${fullMachineNumber}`.trim() : (selectedMachine?.trim() || 'Не вказано');

      if (startOp === 'Розкрій' && targetMachine && targetMachine !== 'Не вказано') {
        const cleanName = (selectedMachine || '').trim().toLowerCase();
        const cleanNum = fullMachineNumber.toLowerCase();

        const machineExists = (machines || []).some(m => {
          const mName = String(m.name || '').trim().toLowerCase();
          const mInv = String(m.inventory_no || '').trim().toLowerCase();
          const mSeq = String(m.sequence_number || '').trim().toLowerCase();
          const mType = String(m.type || '').trim().toLowerCase();

          if (cleanName && cleanNum) {
            return (mName === cleanName || mType === cleanName || mName.includes(cleanName) || mType.includes(cleanName)) && (mInv === cleanNum || mSeq === cleanNum);
          }
          if (cleanName) {
            return mName === cleanName || mType === cleanName || mInv === cleanName || mSeq === cleanName || mName.includes(cleanName) || mType.includes(cleanName);
          }
          if (cleanNum) {
            return mInv === cleanNum || mSeq === cleanNum;
          }
          return false;
        });

        if (!machineExists) {
          setIsProcessing(false);
          showAlert(
            `Вказаного верстата "${targetMachine}" немає в списку обладнання.\n\nБудь ласка, введіть коректну назву або інвентарний номер верстата з наявних у системі.`,
            `❌ Помилка: верстат не знайдено`
          );
          return;
        }

        const matchedMachineObj = (machines || []).find(m => {
          const mName = String(m.name || '').trim().toLowerCase();
          const mInv = String(m.inventory_no || '').trim().toLowerCase();
          const mSeq = String(m.sequence_number || '').trim().toLowerCase();
          const mType = String(m.type || '').trim().toLowerCase();

          if (cleanName && cleanNum) {
            return (mName === cleanName || mType === cleanName || mName.includes(cleanName) || mType.includes(cleanName)) && (mInv === cleanNum || mSeq === cleanNum);
          }
          if (cleanName) {
            return mName === cleanName || mType === cleanName || mInv === cleanName || mSeq === cleanName || mName.includes(cleanName) || mType.includes(cleanName);
          }
          if (cleanNum) {
            return mInv === cleanNum || mSeq === cleanNum;
          }
          return false;
        });

        if (maintenanceCheckEnabled && matchedMachineObj && (matchedMachineObj.status === 'maintenance_required' || matchedMachineObj.status === 'under_maintenance')) {
          setIsProcessing(false);
          showAlert(
            `Верстат "${targetMachine}" заблоковано! Очікується проведення технологічного ремонту (очистка стола).\n\nБудь ласка, проведіть чистку стола в розділі Станки або оберіть інший верстат.`,
            `⚠️ Помилка: Верстат заблоковано!`
          );
          return;
        }

        const targetNorm = targetMachine.trim().toLowerCase();
        const targetNumMatch = targetNorm.match(/№\s*(\S+)/);

        const runningCard = (workCards || []).find(c => {
          if (c.status !== 'in-progress') return false;
          if (c.id === currentCard.id) return false;
          if (String(c.operation || '').trim().toLowerCase() !== 'розкрій') return false;

          const cMachine = String(c.machine || '').trim().toLowerCase();
          if (!cMachine || cMachine === 'не вказано') return false;

          if (cMachine === targetNorm) return true;

          const cNumMatch = cMachine.match(/№\s*(\S+)/);
          if (cNumMatch && targetNumMatch && cNumMatch[1] === targetNumMatch[1]) return true;

          return false;
        });

        if (runningCard) {
          const nom = (nomenclatures || []).find(n => n.id === runningCard.nomenclature_id);
          setIsProcessing(false);
          showAlert(
            `На ньому зараз виконується робота:\n\n` +
            `• Картка: #${runningCard.id.slice(-8).toUpperCase()} (${nom?.name || 'Деталь'})\n` +
            `• Оператор: ${runningCard.operator_name || 'Не вказано'}\n\n` +
            `Будь ласка, оберіть інший вільний верстат або завершіть поточну картку на цьому верстаті.`,
            `⚠️ Помилка: Верстат "${targetMachine}" вже зайнятий!`
          );
          return;
        }
      }

      const cardUpdate = {
        status: 'in-progress',
        operation: startOp,
        started_at: new Date().toISOString(),
        operator_name: selectedOperator,
        manager_name: selectedManager || 'Не вказано',
        shift_name: selectedShift,
        machine: targetMachine,
        card_info: ((currentCard.card_info || '').replace('[SHOP:1]', '').trim() + ' [SHOP:1]').trim()
      };

      const idempotencyKey = `start_shop1_${currentCard.id}_${Date.now()}`;

      const res = await executeAtomicCardTransition({
        cardId: currentCard.id,
        cardUpdate,
        idempotencyKey,
        fallbackFn: async () => {
          const { error } = await supabase.from('work_cards').update(cardUpdate).eq('id', currentCard.id);
          if (error) throw error;
        }
      });

      if (!res.success) {
        showAlert(`⚠️ ${res.message || 'Дію відхилено сервером'}`, 'Помилка старту');
        return;
      }

      fetchData(['work_cards', 'tasks']).catch(() => {});
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id]);
    } catch (e) {
      alert('Помилка: ' + e.message);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleShiftChange = async () => {
    if (!currentCard || !shiftChangeOperator || !shiftChangeShift) return;
    setIsProcessing(true);
    try {
      const now = new Date().toISOString();
      const shiftChangeInfo = `[REPLACED_BY:${shiftChangeOperator} (${shiftChangeShift})]`;
      const historyCardInfo = ((currentCard.card_info || '') + ' ' + shiftChangeInfo).trim();

      const historyData = {
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій (перезмінка)',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity,
        qty_completed: 0,
        scrap_qty: 0,
        started_at: currentCard.started_at || now,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name,
        machine_name: currentCard.machine,
        card_info: historyCardInfo
      };

      const originalStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || currentCard.started_at || now;
      const updatedCardInfo = ((currentCard.card_info || '').replace(/\[ORIGINAL_START:[^\]]+\]/g, '').trim() + ` [ORIGINAL_START:${originalStart}]`).trim();

      const cardUpdate = {
        operator_name: shiftChangeOperator,
        shift_name: shiftChangeShift,
        started_at: now,
        card_info: updatedCardInfo
      };

      const idempotencyKey = `shift_shop1_${currentCard.id}_${Date.now()}`;

      const res = await executeAtomicCardTransition({
        cardId: currentCard.id,
        cardUpdate,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const { error: historyError } = await supabase.from('work_card_history').insert([historyData]);
          if (historyError) throw historyError;
          const { error: cardError } = await supabase.from('work_cards').update(cardUpdate).eq('id', currentCard.id);
          if (cardError) throw cardError;
        }
      });

      if (!res.success) {
        alert('Помилка перезмінки: ' + (res.message || 'Відхилено'));
        return;
      }

      setShowShiftChangeModal(false);
      setShiftChangeOperator('');
      setShiftChangeShift('');
      fetchData(['work_cards', 'work_card_history']).catch(() => {});
    } catch (e) {
      setIsProcessing(false);
      alert('Помилка перезмінки: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePauseCard = async () => {
    if (!currentCard) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const reasonText = (pauseReason === 'Інша причина (введіть нижче)' ? customPauseReason : pauseReason) || 'Без причини';
    setIsProcessing(true);
    try {
      const now = new Date().toISOString();

      const historyData = {
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity || 0,
        qty_completed: 0,
        scrap_qty: 0,
        started_at: currentCard.started_at || now,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name || 'Не вказано',
        machine_name: currentCard.machine || 'Не вказано',
        card_info: `[PAUSED_WORK_LOG][REASON:${reasonText}]`
      };

      const originalStart = currentCard.card_info?.match(/\[ORIGINAL_START:([^\]]+)\]/)?.[1] || currentCard.started_at || now;
      let cleanCardInfo = (currentCard.card_info || '').replace(/\[ORIGINAL_START:[^\]]+\]/g, '').trim();
      cleanCardInfo = cleanCardInfo.replace(/\[PAUSED:[^\]]+\]/g, '').replace(/\[PAUSED_AT:[^\]]+\]/g, '').trim();

      const updatedCardInfo = `[PAUSED:${reasonText}][PAUSED_AT:${now}][ORIGINAL_START:${originalStart}] ${cleanCardInfo}`.trim();

      const cardUpdate = {
        status: 'paused',
        operator_name: currentCard.operator_name,
        card_info: updatedCardInfo
      };

      const idempotencyKey = `pause_shop1_${currentCard.id}_${Date.now()}`;

      const res = await executeAtomicCardTransition({
        cardId: currentCard.id,
        cardUpdate,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const { error: historyError } = await supabase.from('work_card_history').insert([historyData]);
          if (historyError) throw historyError;
          const { error: cardError } = await supabase.from('work_cards').update(cardUpdate).eq('id', currentCard.id);
          if (cardError) throw cardError;
        }
      });

      if (!res.success) {
        alert('Помилка призупинення: ' + (res.message || 'Відхилено'));
        return;
      }

      setShowPauseModal(false);
      setCustomPauseReason('');
      fetchData(['work_cards', 'work_card_history']).catch(() => {});
    } catch (e) {
      alert('Помилка призупинення: ' + e.message);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleResumeCard = async () => {
    if (!currentCard) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      const now = new Date().toISOString();
      const pausedAtStr = currentCard.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1];
      const reasonText = currentCard.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'Без причини';
      const pausedAt = pausedAtStr ? new Date(pausedAtStr).toISOString() : now;

      const historyData = {
        card_id: currentCard.id,
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Розкрій (зупинка)',
        operator_name: currentCard.operator_name || 'Не вказано',
        qty_at_start: currentCard.quantity || 0,
        qty_completed: 0,
        scrap_qty: 0,
        started_at: pausedAt,
        completed_at: now,
        shift_name: currentCard.shift_name || 'Без зміни',
        manager_name: currentCard.manager_name || 'Не вказано',
        machine_name: currentCard.machine || 'Не вказано',
        card_info: `Причина зупинки: ${reasonText}`
      };

      let cleanCardInfo = (currentCard.card_info || '')
        .replace(/\[PAUSED:[^\]]+\]/g, '')
        .replace(/\[PAUSED_AT:[^\]]+\]/g, '')
        .trim();

      const cardUpdate = {
        status: 'in-progress',
        operator_name: currentCard.operator_name,
        started_at: now,
        card_info: cleanCardInfo
      };

      const idempotencyKey = `resume_shop1_${currentCard.id}_${Date.now()}`;

      const res = await executeAtomicCardTransition({
        cardId: currentCard.id,
        cardUpdate,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const { error: historyError } = await supabase.from('work_card_history').insert([historyData]);
          if (historyError) throw historyError;
          const { error: cardError } = await supabase.from('work_cards').update(cardUpdate).eq('id', currentCard.id);
          if (cardError) throw cardError;
        }
      });

      if (!res.success) {
        alert('Помилка відновлення роботи: ' + (res.message || 'Відхилено'));
        return;
      }

      fetchData(['work_cards', 'work_card_history']).catch(() => {});
    } catch (e) {
      alert('Помилка відновлення роботи: ' + e.message);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleCompleteToBuffer = async () => {
    if (!currentCard) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      if (!await verifyCardBeforeMasterScrap()) return;
      const qtyDone = Math.max(0, (currentCard.quantity || 0) - scrapCount);
      const op = finalOperator || currentCard.operator_name || 'Не вказано';
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни';
      const isCuttingOperation = currentCard.operation === 'Розкрій';
      const cuttersQty = isCuttingOperation ? Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0) : null;

      const finalCuttersBreakdown = { ...cuttersBreakdown };
      if (isCuttingOperation) {
        const requiredCutters = getCuttersForCard(currentCard);
        const missingCutters = requiredCutters.filter(name => !cuttersTouched[name]);
        const hasAnyCutters = requiredCutters.some(name => Number(cuttersBreakdown[name]) > 0);
        if (missingCutters.length > 0 && !hasAnyCutters) {
          alert('Заповніть фактичну кількість фрез перед передачею в буфер розкрою.');
          setIsProcessing(false);
          return;
        }

        requiredCutters.forEach(name => {
          if (finalCuttersBreakdown[name] === undefined || finalCuttersBreakdown[name] === '') {
            finalCuttersBreakdown[name] = 0;
          }
        });
      }

      if (isCuttingOperation && cuttersQty > 0) {
        const canSaveCutters = await validateCuttersUsageLimit(cuttersQty);
        if (!canSaveCutters) {
          setIsProcessing(false);
          return;
        }
      }

      let breakdownStr = '';
      if (isCuttingOperation && Object.keys(finalCuttersBreakdown).length > 0) {
        breakdownStr = ` [CUTTERS_BREAKDOWN:${JSON.stringify(finalCuttersBreakdown)}]`;
      }
      const baseCardInfo = isCuttingOperation ? (currentCard.card_info || '') : stripCuttersBreakdown(currentCard.card_info);
      const historyCardInfo = (baseCardInfo + breakdownStr).trim();
      const completedAt = new Date().toISOString();

      const { data: claimedCard, error: claimError } = await supabase
        .from('work_cards')
        .update({
          status: 'at-buffer',
          quantity: qtyDone,
          operator_name: op,
          shift_name: activeShift,
          cutters_used: cuttersQty,
          card_info: historyCardInfo,
          completed_at: completedAt
        })
        .eq('id', currentCard.id)
        .eq('status', 'in-progress')
        .select('id')
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimedCard) {
        setShowCompleteModal(false);
        setScrapCount(0);
        setSelectedCardId(null);
        fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {});
        alert('Цю картку вже завершено. Повторне проведення не виконувалось.');
        return;
      }

      const promises = [];

      if (scrapCount > 0 && scrapOperator && scrapOperator !== op) {
        if (qtyDone > 0) {
          promises.push(
            supabase.from('work_card_history').insert([{
              card_id: currentCard.id,
              nomenclature_id: currentCard.nomenclature_id,
              stage_name: currentCard.operation,
              operator_name: op,
              qty_at_start: currentCard.quantity - scrapCount,
              qty_completed: qtyDone,
              scrap_qty: 0,
              started_at: currentCard.started_at,
              completed_at: completedAt,
              is_archived_scrap: false,
              shift_name: activeShift,
              manager_name: currentCard.manager_name,
              machine_name: currentCard.machine,
              cutters_used: cuttersQty,
              card_info: historyCardInfo
            }])
          );
        }
        let scrapShift = activeShift;
        const scrapOpUser = systemUsers?.find(u => formatUserName(u) === scrapOperator);
        if (scrapOpUser?.shift) {
          scrapShift = scrapOpUser.shift;
        }
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: currentCard.operation,
            operator_name: scrapOperator,
            qty_at_start: scrapCount,
            qty_completed: 0,
            scrap_qty: scrapCount,
            started_at: currentCard.started_at,
            completed_at: completedAt,
            is_archived_scrap: true,
            shift_name: scrapShift,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine,
            cutters_used: cuttersQty,
            card_info: (historyCardInfo + ' [SCRAP_ASSIGNED]').trim()
          }])
        );
      } else {
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: currentCard.operation,
            operator_name: op,
            qty_at_start: currentCard.quantity,
            qty_completed: qtyDone,
            scrap_qty: scrapCount,
            started_at: currentCard.started_at,
            completed_at: completedAt,
            is_archived_scrap: scrapCount > 0,
            shift_name: activeShift,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine,
            cutters_used: cuttersQty,
            card_info: historyCardInfo
          }])
        );
      }

      if (scrapCount > 0) {
        promises.push(updateInventoryStock(currentCard.nomenclature_id, scrapCount, 'scrap_ready'));
      }

      if (isCuttingOperation) {
        promises.push(handleCuttersInventoryDeduction(currentCard, finalCuttersBreakdown));
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res && res.error) throw res.error;
      }

      setShowCompleteModal(false);
      setScrapCount(0);
      setSelectedCardId(null);
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {});
    } catch (e) {
      console.error('Buffer error:', e);
      alert('Помилка буфера: ' + e.message);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleStartNext = async () => {
    if (!currentCard) return;
    const next = nextStageFor(currentCard);
    if (!next) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {

    if (next === 'Прийомка') {
      let bufferAlreadyRecorded = false;
      if (currentCard.status === 'at-buffer') {
        try {
          const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString();
          const op = selectedOperator || currentCard.operator_name || 'Прийомка';
          const { error } = await supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: `Буфер ${currentCard.operation}`,
            operator_name: op,
            qty_at_start: currentCard.quantity || 0,
            qty_completed: currentCard.quantity || 0,
            scrap_qty: 0,
            started_at: bufferStart,
            completed_at: new Date().toISOString(),
            shift_name: selectedShift || currentCard.shift_name || 'Без зміни',
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine
          }]);
          if (error) throw error;
          bufferAlreadyRecorded = true;
        } catch (err) {
          console.error('Error writing Tumbling Buffer history:', err);
        }
      }
      await handleAcceptToStock({ bufferAlreadyRecorded });
      return;
    }

    if (!next?.startsWith('Галтовка') && !selectedOperator) return;

    const op = next?.startsWith('Галтовка') ? 'Команда' : selectedOperator;

      let historyData = null;
      if (currentCard.status === 'at-buffer') {
        const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString();
        historyData = {
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: `Буфер ${currentCard.operation}`,
          operator_name: op || currentCard.operator_name || 'Не вказано',
          qty_at_start: currentCard.quantity || 0,
          qty_completed: currentCard.quantity || 0,
          scrap_qty: 0,
          started_at: bufferStart,
          completed_at: new Date().toISOString(),
          shift_name: selectedShift || currentCard.shift_name || 'Без зміни',
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine
        };
      }

      const cardUpdate = {
        status: 'in-progress',
        operation: next,
        started_at: new Date().toISOString(),
        operator_name: op,
        shift_name: selectedShift,
        machine: currentCard.machine || 'Не вказано'
      };

      const idempotencyKey = `start_next_${currentCard.id}_${Date.now()}`;

      const res = await executeAtomicCardTransition({
        cardId: currentCard.id,
        cardUpdate,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          if (historyData) {
            const { error: histErr } = await supabase.from('work_card_history').insert([historyData]);
            if (histErr) throw histErr;
          }
          const { error: cardErr } = await supabase.from('work_cards').update(cardUpdate).eq('id', currentCard.id);
          if (cardErr) throw cardErr;
        }
      });

      if (!res.success) {
        alert('Помилка старту наступної операції: ' + (res.message || 'Відхилено'));
        return;
      }

      fetchData(['work_cards', 'work_card_history']).catch(() => {});
      if (!scannedIds.includes(currentCard.id)) setScannedIds(prev => [...prev, currentCard.id]);
    } catch (e) {
      alert('Помилка: ' + e.message);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleRequestRework = async () => {
    if (!currentCard || !createWorkCard) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      const op = finalOperator || currentCard.operator_name || 'Брак';
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни';
      const isCuttingOperation = currentCard.operation === 'Розкрій';
      const cuttersQty = isCuttingOperation ? Object.values(cuttersBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0) : null;

      if (isCuttingOperation && cuttersQty > 0) {
        const canSaveCutters = await validateCuttersUsageLimit(cuttersQty);
        if (!canSaveCutters) {
          setIsProcessing(false);
          return;
        }
      }

      let breakdownStr = '';
      if (isCuttingOperation && Object.keys(cuttersBreakdown).length > 0) {
        breakdownStr = ` [CUTTERS_BREAKDOWN:${JSON.stringify(cuttersBreakdown)}]`;
      }
      const baseCardInfo = isCuttingOperation ? (currentCard.card_info || '') : stripCuttersBreakdown(currentCard.card_info);
      const historyCardInfo = (baseCardInfo + breakdownStr).trim();

      const promises = [];

      let scrapOpToUse = op;
      let scrapShiftToUse = activeShift;
      if (scrapOperator) {
        scrapOpToUse = scrapOperator;
        const scrapOpUser = systemUsers?.find(u => formatUserName(u) === scrapOperator);
        if (scrapOpUser?.shift) {
          scrapShiftToUse = scrapOpUser.shift;
        }
      }

      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: currentCard.operation,
          operator_name: scrapOpToUse,
          qty_at_start: currentCard.quantity,
          qty_completed: 0,
          scrap_qty: currentCard.quantity,
          started_at: currentCard.started_at,
          completed_at: new Date().toISOString(),
          is_archived_scrap: true,
          shift_name: scrapShiftToUse,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine,
          card_info: scrapOperator && scrapOperator !== op ? (historyCardInfo + ' [SCRAP_ASSIGNED]').trim() : historyCardInfo,
          cutters_used: cuttersQty
        }])
      );

      promises.push(
        supabase.from('work_cards').update({
          status: 'completed',
          quantity: 0,
          operator_name: op,
          shift_name: activeShift,
          card_info: historyCardInfo,
          cutters_used: cuttersQty
        }).eq('id', currentCard.id)
      );

      promises.push(updateInventoryStock(currentCard.nomenclature_id, currentCard.quantity, 'scrap_ready'));

      if (isCuttingOperation) {
        promises.push(handleCuttersInventoryDeduction(currentCard, cuttersBreakdown));
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res && res.error) throw res.error;
      }

      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']).catch(() => {});
      setShowCompleteModal(false);
      setSelectedCardId(null);
      setIsProcessing(false);
      alert('100% брак списано! Нестачу передано Майстру в FOREMAN MODULE.');
    } catch (e) {
      console.error('Rework error:', e);
      setIsProcessing(false);
      alert('Помилка перевипуску: ' + e.message);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleFinishSortingActive = async () => {
    if (!currentCard) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('work_cards').update({
        status: 'at-buffer',
        completed_at: new Date().toISOString()
      }).eq('id', currentCard.id);
      if (error) throw error;

      fetchData(['work_cards', 'tasks']).catch(() => {});
    } catch (e) {
      console.error('Error completing sorting to buffer:', e);
      alert('Помилка завершення сортування: ' + e.message);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleSortToShop2 = async () => {
    if (!currentCard) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      if (!await verifyCardBeforeMasterScrap()) return;
      const goodQty = Math.max(0, (currentCard.quantity || 0) - scrapCount - reworkCount);
      const op = selectedOperator || currentCard.operator_name || 'Сортування';
      const activeShift = selectedShift || currentCard.shift_name || 'Без зміни';

      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const [existingInvResult, shop2TasksResult, s1TaskResult] = await Promise.all([
        supabase.from('inventory')
          .select('*')
          .eq('nomenclature_id', currentCard.nomenclature_id)
          .in('type', ['semi', 'wip_bz', 'bz', 'semi_shop2', 'bz_shop2', 'scrap_ready']),
        supabase.from('tasks')
          .select('*')
          .eq('order_id', currentCard.order_id)
          .ilike('step', '%ЦЕХ №2%')
          .neq('status', 'completed'),
        supabase.from('tasks')
          .select('*')
          .eq('id', currentCard.task_id)
          .maybeSingle()
      ]);

      const existingItems = existingInvResult.data || [];
      const shop2Tasks = shop2TasksResult.data || [];
      const s1TaskData = s1TaskResult.data;

      const cardBz = Number(currentCard.buffer_qty) || Number(currentCard.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0;
      const cardNeed = Number(currentCard.card_info?.match(/\[REQ:(\d+)\]/)?.[1]) || Number(currentCard.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Math.max(0, Number(currentCard.quantity) - cardBz));
      const actualNeed = Math.min(goodQty, cardNeed);
      const actualBz = Math.max(0, goodQty - actualNeed);

      const invUpdates = [];
      const findItem = (type) => existingItems.find(i => i.type === type);

      if (actualNeed > 0) {
        const s1Semi = findItem('semi');
        if (s1Semi) {
          invUpdates.push({ ...s1Semi, total_qty: Math.max(0, (Number(s1Semi.total_qty) || 0) - actualNeed) });
        }
      }

      if (actualBz > 0) {
        let remainingBz = actualBz;
        const s1Wip = findItem('wip_bz');
        if (s1Wip) {
          const take = Math.min(Number(s1Wip.total_qty) || 0, remainingBz);
          invUpdates.push({ ...s1Wip, total_qty: Math.max(0, (Number(s1Wip.total_qty) || 0) - take) });
          remainingBz -= take;
        }
        if (remainingBz > 0) {
          const s1Bz = findItem('bz');
          if (s1Bz) {
            const take = Math.min(Number(s1Bz.total_qty) || 0, remainingBz);
            invUpdates.push({ ...s1Bz, total_qty: Math.max(0, (Number(s1Bz.total_qty) || 0) - take) });
          }
        }
      }

      // Atomic stock increments for Shop 2 buffer and scrap
      const stockIncrements = [];
      if (actualNeed > 0) {
        stockIncrements.push(
          incrementInventoryStock({
            nomenclatureId: currentCard.nomenclature_id,
            qty: actualNeed,
            type: 'semi_shop2',
            nomenclatures
          })
        );
      }

      if (actualBz > 0) {
        stockIncrements.push(
          incrementInventoryStock({
            nomenclatureId: currentCard.nomenclature_id,
            qty: actualBz,
            type: 'bz_shop2',
            nomenclatures
          })
        );
      }

      if (scrapCount > 0) {
        stockIncrements.push(
          incrementInventoryStock({
            nomenclatureId: currentCard.nomenclature_id,
            qty: scrapCount,
            type: 'scrap_ready',
            nomenclatures
          })
        );
      }

      let resolvedScrapOp = op;
      if (scrapCount > 0) {
        try {
          const { data: cuttingHistory } = await supabase
            .from('work_card_history')
            .select('operator_name')
            .eq('card_id', currentCard.id)
            .eq('stage_name', 'Розкрій');

          if (cuttingHistory && cuttingHistory.length > 0) {
            const cuttingOperators = [...new Set(cuttingHistory.map(h => h.operator_name).filter(Boolean))];
            if (cuttingOperators.length === 1) {
              resolvedScrapOp = cuttingOperators[0];
            }
          }
        } catch (err) {
          console.error('Failed to resolve cutting operator:', err);
        }
      }

      const historyDelivery = await recordSortingHistoryGuaranteed(supabase, {
        card: currentCard,
        operatorName: resolvedScrapOp,
        bufferOperatorName: op,
        shiftName: activeShift,
        qtyCompleted: goodQty,
        scrapQty: scrapCount,
        recordedAt: new Date().toISOString()
      });
      if (historyDelivery.error) throw historyDelivery.error;

      let shop2TaskId = null;
      const writePromises = [];

      writePromises.push(
        supabase.from('work_cards').update({
          status: 'at-shop2-buffer',
          operation: 'Сортування',
          quantity: goodQty + reworkCount,
          used_in_shop2_qty: reworkCount,
          completed_at: new Date().toISOString()
        }).eq('id', currentCard.id)
      );

      let updatedArrivals = [];
      const nom = (nomenclatures || []).find(n => n.id === currentCard.nomenclature_id);

      if (!shop2Tasks || shop2Tasks.length === 0) {
        if (s1TaskData) {
          shop2TaskId = generateUUID();
          updatedArrivals = [{
            id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            semi: actualNeed,
            bz: actualBz
          }];

          writePromises.push(
            supabase.from('tasks').insert([{
              id: shop2TaskId,
              order_id: currentCard.order_id,
              step: 'Пресування [ЦЕХ №2]',
              status: 'in-progress',
              planned_sets: s1TaskData.planned_sets || 0,
              estimated_time: s1TaskData.estimated_time || 0,
              engineer_conf: true,
              warehouse_conf: 'true',
              director_conf: true,
              batch_index: s1TaskData.batch_index || null,
              plan_snapshot: { ...(s1TaskData.plan_snapshot || {}), arrivals: updatedArrivals }
            }])
          );
        }
      } else {
        shop2TaskId = shop2Tasks[0].id;
        const existingArrivals = shop2Tasks[0]?.plan_snapshot?.arrivals || [];
        updatedArrivals = [...existingArrivals];
        const matchIdx = updatedArrivals.findIndex(a => String(a.id) === String(currentCard.nomenclature_id));
        if (matchIdx >= 0) {
          updatedArrivals[matchIdx] = {
            ...updatedArrivals[matchIdx],
            semi: (Number(updatedArrivals[matchIdx].semi) || 0) + actualNeed,
            bz: (Number(updatedArrivals[matchIdx].bz) || 0) + actualBz
          };
        } else {
          updatedArrivals.push({
            id: currentCard.nomenclature_id,
            name: nom?.name || 'Деталь',
            semi: actualNeed,
            bz: actualBz
          });
        }

        writePromises.push(
          supabase.from('tasks').update({
            status: 'in-progress',
            plan_snapshot: {
              ...(shop2Tasks[0].plan_snapshot || {}),
              arrivals: updatedArrivals
            }
          }).eq('id', shop2Tasks[0].id)
        );
      }

      if (reworkCount > 0) {
        writePromises.push(
          supabase.from('work_cards').insert([{
            task_id: shop2TaskId || currentCard.task_id,
            order_id: currentCard.order_id,
            nomenclature_id: currentCard.nomenclature_id,
            operation: 'Доопрацювання',
            quantity: reworkCount,
            status: 'new',
            card_info: `[ЦЕХ №2] Автоматично з Сортування`
          }])
        );
      }

      if (invUpdates.length > 0) writePromises.push(supabase.from('inventory').upsert(invUpdates));
      const results = await Promise.all([...writePromises, ...stockIncrements]);
      for (const res of results) {
        if (res?.error) throw res.error;
      }

      setScrapCount(0);
      setReworkCount(0);
      setSelectedCardId(null);
      setScannedIds(prev => prev.filter(id => id !== currentCard.id));
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {});
      setIsProcessing(false);
      alert(`✅ ${goodQty} шт відправлено в буфер Цеху №2!`);
    } catch (e) {
      console.error('Sort to shop2 error:', e);
      setIsProcessing(false);
      alert('Помилка сортування: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptToStock = async ({ bufferAlreadyRecorded = false } = {}) => {
    if (!currentCard) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      const qtyDone = currentCard.quantity || 0;
      const op = selectedOperator || currentCard.operator_name || 'Прийомка';

      const promises = [];

      if (currentCard.status === 'at-buffer' && !bufferAlreadyRecorded) {
        const bufferStart = currentCard.completed_at || currentCard.started_at || new Date().toISOString();
        promises.push(
          supabase.from('work_card_history').insert([{
            card_id: currentCard.id,
            nomenclature_id: currentCard.nomenclature_id,
            stage_name: 'Буфер Галтовки',
            operator_name: op,
            qty_at_start: qtyDone,
            qty_completed: qtyDone,
            scrap_qty: 0,
            started_at: bufferStart,
            completed_at: new Date().toISOString(),
            shift_name: currentCard.shift_name,
            manager_name: currentCard.manager_name,
            machine_name: currentCard.machine
          }])
        );
      }

      promises.push(
        supabase.from('work_card_history').insert([{
          card_id: currentCard.id,
          nomenclature_id: currentCard.nomenclature_id,
          stage_name: 'Прийомка',
          operator_name: op,
          qty_at_start: qtyDone,
          qty_completed: qtyDone,
          scrap_qty: 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_archived_scrap: true,
          shift_name: currentCard.shift_name,
          manager_name: currentCard.manager_name,
          machine_name: currentCard.machine
        }])
      );

      promises.push(
        supabase.from('work_cards').update({
          status: 'at-buffer',
          operation: 'Прийомка',
          operator_name: op,
          completed_at: new Date().toISOString()
        }).eq('id', currentCard.id)
      );

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.error) throw res.error;
      }

      setSelectedCardId(null);
      setScannedIds(prev => prev.filter(id => id !== currentCard.id));
      fetchData(['work_cards', 'work_card_history']).catch(() => {});
    } catch (e) {
      console.error('Acceptance error:', e);
      setIsProcessing(false);
      alert('Помилка прийомки: ' + (e.message || 'Невідома помилка'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQCScrapOverride = async () => {
    if (!currentCard || qcScrapCount <= 0) return;
    if (qcScrapCount > currentCard.quantity) {
      alert('Кількість браку не може перевищувати поточну кількість деталей у картці!');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsProcessing(true);
    try {
      const reasonText = qcReason === 'Інше (коментар)'
        ? `Інше (${qcCustomReason || 'без коментаря'})`
        : qcReason;
      const op = `ВКЯ (${qcInspector || 'відповідальний'}) — Причина: ${reasonText}`;
      const newQty = Math.max(0, currentCard.quantity - qcScrapCount);

      const historyData = {
        nomenclature_id: currentCard.nomenclature_id,
        stage_name: 'Контроль ВКЯ',
        operator_name: op,
        shift_name: currentCard.shift_name,
        manager_name: currentCard.manager_name,
        machine_name: currentCard.machine,
        qc_scrap_reason: qcReason,
        qc_scrap_comment: qcReason === 'Інше (коментар)' ? qcCustomReason : null,
        started_at: new Date().toISOString()
      };

      const updatePayload = { quantity: newQty };
      if (newQty === 0) {
        updatePayload.status = 'completed';
      }

      const idempotencyKey = `qc_scrap_${currentCard.id}_${Date.now()}`;

      const res = await executeAtomicQcScrap({
        cardId: currentCard.id,
        scrapQty: qcScrapCount,
        historyData,
        idempotencyKey,
        fallbackFn: async () => {
          const promises = [
            supabase.from('work_card_history').insert([{
              card_id: currentCard.id,
              ...historyData,
              qty_at_start: currentCard.quantity,
              qty_completed: newQty,
              scrap_qty: qcScrapCount,
              completed_at: new Date().toISOString(),
              is_archived_scrap: true
            }]),
            supabase.from('work_cards').update(updatePayload).eq('id', currentCard.id),
            updateInventoryStock(currentCard.nomenclature_id, qcScrapCount, 'scrap_ready')
          ];
          const results = await Promise.all(promises);
          for (const r of results) {
            if (r?.error) throw r.error;
          }
        }
      });

      if (!res.success) {
        throw new Error(res.error || res.message || 'Не вдалося списати брак через сервер');
      }

      setShowQCModal(false);
      setQcScrapCount(0);
      setQcInspector('');
      setQcReason('Биття цанги');
      setQcCustomReason('');
      fetchData(['work_cards', 'work_card_history', 'inventory', 'tasks']).catch(() => {});
      if (newQty === 0) {
        setSelectedCardId(null);
        setScannedIds(prev => prev.filter(id => id !== currentCard.id));
      }
      setIsProcessing(false);
      alert(`✅ Успішно списано ${qcScrapCount} шт у брак за рішенням ВКЯ!`);
    } catch (e) {
      console.error('QC error:', e);
      alert('Помилка фіксації браку ВКЯ: ' + e.message);
    } finally {
      inFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleArchiveStageScrap = async (stage, nomId) => {
    const unarchivedScrap = (workCardHistory || []).filter(h => (stage === 'Галтовка' ? h.stage_name?.startsWith('Галтовка') : h.stage_name === stage) && String(h.nomenclature_id) === String(nomId) && !h.is_archived_scrap && Number(h.scrap_qty) > 0);
    const totalQty = unarchivedScrap.reduce((acc, h) => acc + Number(h.scrap_qty), 0);

    if (totalQty === 0) return;
    setIsProcessing(true);

    try {
      await updateInventoryStock(nomId, totalQty, 'scrap_ready');

      const idsToMark = unarchivedScrap.map(h => h.id);
      const { error } = await supabase.from('work_card_history').update({ is_archived_scrap: true }).in('id', idsToMark);
      if (error) throw error;

      fetchData(['inventory', 'work_card_history']).catch(() => {});
    } catch (err) {
      console.error('Archive scrap error:', err);
      alert('Помилка архівації браку: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    handleStart,
    handleShiftChange,
    handlePauseCard,
    handleResumeCard,
    handleCompleteToBuffer,
    handleStartNext,
    handleRequestRework,
    handleFinishSortingActive,
    handleSortToShop2,
    handleAcceptToStock,
    handleQCScrapOverride,
    handleArchiveStageScrap,
    updateInventoryStock,
    handleCuttersInventoryDeduction,
    validateCuttersUsageLimit,
    verifyCardBeforeMasterScrap
  };
}
