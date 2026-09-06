import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useScrapReasons } from '../../../hooks/useScrapReasons';
import { useMES } from '../../../MESContext';
import { supabase } from '../../../supabase';
import { CHAIN, formatSec } from '../utils/shop1Helpers';

import { useShop1ShiftTimers } from './subhooks/useShop1ShiftTimers';
import { useShop1Modals } from './subhooks/useShop1Modals';
import { useShop1Scanner } from './subhooks/useShop1Scanner';
import { useShop1CutterResolver } from './subhooks/useShop1CutterResolver';
import { useShop1Queue } from './subhooks/useShop1Queue';
import { useShop1CardWorkflow } from './subhooks/useShop1CardWorkflow';

export function useShop1TerminalState() {
  const { names: scrapReasons } = useScrapReasons();
  const {
    workCards,
    setWorkCards,
    nomenclatures,
    operators,
    getFilteredOperators,
    getFilteredManagers,
    managers,
    workCardHistory,
    inventory,
    fetchData,
    createWorkCard,
    orders,
    tasks,
    currentUser,
    machines,
    systemUsers,
    machineOperations,
    formatUserName,
    requests,
    theme,
    toggleTheme,
    maintenanceCheckEnabled
  } = useMES();

  // Initial load
  useEffect(() => {
    fetchData(['work_cards', 'tasks']).catch(error => {
      console.error('Failed to load Shop 1 cards:', error);
    });
  }, [fetchData]);

  // Selected Card & Isolated Full History (Single Source of Truth)
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedCardHistory, setSelectedCardHistory] = useState([]);
  const prevCardIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    if (!selectedCardId) {
      setSelectedCardHistory([]);
      return () => { cancelled = true; };
    }

    const loadSelectedCardHistory = async () => {
      const pageSize = 500;
      const rows = [];

      try {
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from('work_card_history')
            .select('*')
            .eq('card_id', selectedCardId)
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1);

          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < pageSize) break;
        }

        if (!cancelled) setSelectedCardHistory(rows);
      } catch (error) {
        console.error('Failed to load complete card history:', error);
        if (!cancelled) setSelectedCardHistory([]);
      }
    };

    loadSelectedCardHistory();
    return () => { cancelled = true; };
  }, [selectedCardId]);

  useEffect(() => {
    if (!selectedCardId) return;
    const matchingRows = (workCardHistory || [])
      .filter(row => String(row.card_id) === String(selectedCardId));
    if (matchingRows.length === 0) return;

    setSelectedCardHistory(prev => {
      const byId = new Map(prev.map(row => [String(row.id), row]));
      matchingRows.forEach(row => {
        const key = String(row.id);
        byId.set(key, { ...byId.get(key), ...row });
      });
      return Array.from(byId.values())
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    });
  }, [selectedCardId, workCardHistory]);

  // Active Station Context (Single Source of Truth)
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [machineNumber, setMachineNumber] = useState('');
  const [finalOperator, setFinalOperator] = useState('');
  const [scrapOperator, setScrapOperator] = useState('');

  // Processing & UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [movingScrapIds, setMovingScrapIds] = useState(new Set());
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [detailStage, setDetailStage] = useState(null);
  const [detailTab, setDetailTab] = useState('work');
  const [showStorageExplorer, setShowStorageExplorer] = useState(false);
  const [activeExplorerTab, setActiveExplorerTab] = useState('reception');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Local storage scanned queue
  const [scannedIds, setScannedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shop1_scanned') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('shop1_scanned', JSON.stringify(scannedIds));
  }, [scannedIds]);

  const currentCard = useMemo(() => (workCards || []).find(c => c.id === selectedCardId), [workCards, selectedCardId]);
  const getNom = useCallback((card) => (nomenclatures || []).find(n => n.id === card?.nomenclature_id), [nomenclatures]);

  const nextStageFor = useCallback((card) => {
    const op = card?.operation || '';
    if (op === 'Галтовка') return 'Прийомка';
    const i = CHAIN.indexOf(op);
    return i >= 0 && i < CHAIN.length - 1 ? CHAIN[i + 1] : null;
  }, []);

  // 1. Shift & Runtime Timers
  const timers = useShop1ShiftTimers({
    selectedCardId,
    selectedCardHistory,
    workCardHistory
  });

  // 2. Modals & Alerts
  const modals = useShop1Modals({
    currentUser,
    systemUsers,
    selectedOperator,
    supabase
  });

  // 3. Barcode & QR Scanner
  const scanner = useShop1Scanner({
    workCards,
    setWorkCards,
    requests,
    supabase,
    scannedIds,
    setScannedIds,
    setSelectedCardId,
    onMachineCallTrigger: modals.setMachineCallModal,
    showAlert: modals.showAlert
  });

  // 4. Cutter Resolver Domain Subhook
  const { getCuttersForCard } = useShop1CutterResolver({
    nomenclatures,
    tasks,
    inventory,
    machineOperations,
    requests
  });

  // 5. Queue & Stage Stats Domain Subhook
  const queue = useShop1Queue({
    workCards,
    nomenclatures,
    tasks,
    orders,
    requests,
    workCardHistory,
    scannedIds,
    manualId: scanner.manualId,
    selectedOperator,
    currentUser,
    getNom
  });

  // 6. Card Workflow Business Actions
  const workflow = useShop1CardWorkflow({
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
  });

  // Card selection synchronization - pure DI delegation to modals.resetForCard
  useEffect(() => {
    if (!selectedCardId) {
      prevCardIdRef.current = null;
      return;
    }
    
    const cardChanged = selectedCardId !== prevCardIdRef.current;
    if (cardChanged) {
      prevCardIdRef.current = selectedCardId;
      setSelectedOperator('');
      
      const combined = currentCard?.machine || '';
      const match = combined.match(/^(.*?) ?№ ?(\S+)$/);
      if (match) {
        setSelectedMachine(match[1].trim());
        setMachineNumber(match[2].trim());
      } else {
        setSelectedMachine(combined);
        setMachineNumber('');
      }
      
      setFinalOperator('');
      setScrapOperator('');

      const initCutters = currentCard?.operation === 'Розкрій' ? getCuttersForCard(currentCard) : [];
      modals.resetForCard(currentCard, initCutters);
    }

    const autoManagerName = currentUser ? formatUserName(currentUser) : '';
    if (autoManagerName && !selectedManager) {
      setSelectedManager(autoManagerName);
    }
    if (cardChanged) {
      setSelectedShift(currentCard?.shift_name || currentUser?.shift || '');
    } else if (!selectedShift && (currentCard?.shift_name || currentUser?.shift)) {
      setSelectedShift(currentCard?.shift_name || currentUser?.shift || '');
    }
  }, [selectedCardId, currentCard, currentUser, selectedManager, selectedShift, formatUserName, getCuttersForCard, modals.resetForCard]);

  useEffect(() => {
    if (modals.scrapCount > 0 && !scrapOperator && currentCard) {
      setScrapOperator(currentCard.operator_name || '');
    }
  }, [modals.scrapCount, currentCard, scrapOperator]);

  // Computed Card Metrics
  const qcScrapEntries = useMemo(() => (selectedCardHistory || [])
    .filter(row => row.stage_name === 'Контроль ВКЯ' && Number(row.scrap_qty) > 0)
    .sort((a, b) => new Date(b.completed_at || b.created_at || 0) - new Date(a.completed_at || a.created_at || 0)), [selectedCardHistory]);
  const qcScrapTotal = useMemo(() => qcScrapEntries.reduce((sum, row) => sum + (Number(row.scrap_qty) || 0), 0), [qcScrapEntries]);

  const cardOperators = useMemo(() => {
    if (!currentCard) return [];
    const ops = new Set();
    if (currentCard.operator_name) {
      ops.add(currentCard.operator_name);
    }
    if (workCardHistory && workCardHistory.length > 0) {
      const history = workCardHistory.filter(h => String(h.card_id) === String(currentCard.id));
      history.forEach(h => {
        if (h.operator_name) {
          ops.add(h.operator_name);
        }
      });
    }
    return Array.from(ops);
  }, [currentCard, workCardHistory]);

  return {
    scrapReasons,
    workCards,
    setWorkCards,
    nomenclatures,
    operators,
    getFilteredOperators,
    getFilteredManagers,
    managers,
    workCardHistory,
    inventory,
    fetchData,
    createWorkCard,
    orders,
    tasks,
    currentUser,
    machines,
    systemUsers,
    machineOperations,
    formatUserName,
    requests,
    theme,
    toggleTheme,
    currentTime: timers.currentTime,
    selectedCardId,
    setSelectedCardId,
    selectedCardHistory,
    isScanning: scanner.isScanning,
    setIsScanning: scanner.setIsScanning,
    manualId: scanner.manualId,
    setManualId: scanner.setManualId,
    showManualInput: scanner.showManualInput,
    setShowManualInput: scanner.setShowManualInput,
    scanError: scanner.scanError,
    setScanError: scanner.setScanError,
    isSyncing: scanner.isSyncing,
    isProcessing,
    setIsProcessing,
    movingScrapIds,
    setMovingScrapIds,
    isBulkMoving,
    setIsBulkMoving,
    isDrawerOpen,
    setIsDrawerOpen,
    selectedOperator,
    setSelectedOperator,
    selectedManager,
    setSelectedManager,
    selectedShift,
    setSelectedShift,
    selectedMachine,
    setSelectedMachine,
    machineNumber,
    setMachineNumber,
    showCompleteModal: modals.showCompleteModal,
    setShowCompleteModal: modals.setShowCompleteModal,
    showSortingModal: modals.showSortingModal,
    setShowSortingModal: modals.setShowSortingModal,
    queueSectionFilter: queue.queueSectionFilter,
    setQueueSectionFilter: queue.setQueueSectionFilter,
    finalOperator,
    setFinalOperator,
    scrapCount: modals.scrapCount,
    setScrapCount: modals.setScrapCount,
    reworkCount: modals.reworkCount,
    setReworkCount: modals.setReworkCount,
    cuttersUsed: modals.cuttersUsed,
    setCuttersUsed: modals.setCuttersUsed,
    cuttersBreakdown: modals.cuttersBreakdown,
    setCuttersBreakdown: modals.setCuttersBreakdown,
    cuttersTouched: modals.cuttersTouched,
    setCuttersTouched: modals.setCuttersTouched,
    galtPriority: modals.galtPriority,
    setGaltPriority: modals.setGaltPriority,
    showShiftChangeModal: modals.showShiftChangeModal,
    setShowShiftChangeModal: modals.setShowShiftChangeModal,
    shiftChangeOperator: modals.shiftChangeOperator,
    setShiftChangeOperator: modals.setShiftChangeOperator,
    shiftChangeShift: modals.shiftChangeShift,
    setShiftChangeShift: modals.setShiftChangeShift,
    scrapOperator,
    setScrapOperator,
    showPauseModal: modals.showPauseModal,
    setShowPauseModal: modals.setShowPauseModal,
    pauseReason: modals.pauseReason,
    setPauseReason: modals.setPauseReason,
    customPauseReason: modals.customPauseReason,
    setCustomPauseReason: modals.setCustomPauseReason,
    activeTableFilter: queue.activeTableFilter,
    setActiveTableFilter: queue.setActiveTableFilter,
    queueFilter: queue.queueFilter,
    setQueueFilter: queue.setQueueFilter,
    selectedTaskFilter: queue.selectedTaskFilter,
    setSelectedTaskFilter: queue.setSelectedTaskFilter,
    selectedNomFilter: queue.selectedNomFilter,
    setSelectedNomFilter: queue.setSelectedNomFilter,
    machineCallModal: modals.machineCallModal,
    setMachineCallModal: modals.setMachineCallModal,
    machineCallSuccess: modals.machineCallSuccess,
    selectedCallMasterId: modals.selectedCallMasterId,
    setSelectedCallMasterId: modals.setSelectedCallMasterId,
    selectedCallEngineerId: modals.selectedCallEngineerId,
    setSelectedCallEngineerId: modals.setSelectedCallEngineerId,
    selectedCallQCId: modals.selectedCallQCId,
    setSelectedCallQCId: modals.setSelectedCallQCId,
    callMasters: modals.callMasters,
    callEngineers: modals.callEngineers,
    callQCs: modals.callQCs,
    handleCreateCall: modals.handleCreateCall,
    showQCModal: modals.showQCModal,
    setShowQCModal: modals.setShowQCModal,
    qcScrapCount: modals.qcScrapCount,
    setQcScrapCount: modals.setQcScrapCount,
    qcInspector: modals.qcInspector,
    setQcInspector: modals.setQcInspector,
    qcReason: modals.qcReason,
    setQcReason: modals.setQcReason,
    qcCustomReason: modals.qcCustomReason,
    setCustomAlert: modals.setCustomAlert,
    customAlert: modals.customAlert,
    showAlert: modals.showAlert,
    detailStage,
    setDetailStage,
    detailTab,
    setDetailTab,
    showStorageExplorer,
    setShowStorageExplorer,
    activeExplorerTab,
    setActiveExplorerTab,
    scannedIds,
    collapsedGroups,
    setCollapsedGroups,
    currentCard,
    qcScrapEntries,
    qcScrapTotal,
    cardOperators,
    getNom,
    getCardTimeMetrics: timers.getCardTimeMetrics,
    getCardStartDate: timers.getCardStartDate,
    getCuttersForCard,
    formatSec,
    formatTime: timers.formatTime,
    nextStageFor,
    queueTasksOptions: queue.queueTasksOptions,
    queueNomOptions: queue.queueNomOptions,
    queueCards: queue.queueCards,
    handleStart: workflow.handleStart,
    handleShiftChange: workflow.handleShiftChange,
    handlePauseCard: workflow.handlePauseCard,
    handleResumeCard: workflow.handleResumeCard,
    handleCompleteToBuffer: workflow.handleCompleteToBuffer,
    handleStartNext: workflow.handleStartNext,
    handleRequestRework: workflow.handleRequestRework,
    handleFinishSortingActive: workflow.handleFinishSortingActive,
    handleSortToShop2: workflow.handleSortToShop2,
    handleAcceptToStock: workflow.handleAcceptToStock,
    handleQCScrapOverride: workflow.handleQCScrapOverride,
    stageStats: queue.stageStats,
    handleArchiveStageScrap: workflow.handleArchiveStageScrap,
    processCardScan: scanner.processCardScan,
    handleManualEntry: scanner.handleManualEntry,
    CHAIN
  };
}
