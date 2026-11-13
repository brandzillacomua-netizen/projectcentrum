import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMES } from '../../../MESContext';
import { supabase } from '../../../supabase';
import { selectFilteredOperatorNames, formatUserName } from '../../../contexts/userDirectorySelectors';
import { getTodayCalendarKey } from '../../Shop2Foreman/utils/shop2ForemanUtils';
import { 
  fetchRawRubberStock, 
  fetchRubberPartsCatalog, 
  fetchCuttingBatches, 
  startRubberCuttingTask,
  completeCuttingTransaction 
} from '../services/rubberCuttingService';

const ACTIVE_JOB_STORAGE_KEY = 'centrum_active_rubber_job_v2';

export function useRubberCuttingTerminal() {
  const { currentUser, systemUsers } = useMES();

  // Active UI Tab: 'cutting' | 'queue' | 'stock' | 'analytics'
  const [activeTab, setActiveTab] = useState('cutting');

  // Time & Shift
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState(() => {
    return currentUser?.shift && currentUser.shift !== 'Без зміни' ? currentUser.shift : 'Зміна 1';
  });

  // Operators
  const [selectedOperators, setSelectedOperators] = useState(() => {
    if (currentUser?.first_name || currentUser?.last_name) {
      return [formatUserName(currentUser)];
    }
    return [];
  });

  // Data Catalogs & Stock
  const [rawStock, setRawStock] = useState({ 'V2-90030': 0, 'V2-90031': 0 });
  const [parts, setParts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Active Cutting Desk State
  const [selectedThickness, setSelectedThickness] = useState(2); // 2 or 4 mm
  const [selectedPart, setSelectedPart] = useState(null);
  const [sheetsCount, setSheetsCount] = useState(1);
  const [partSearch, setPartSearch] = useState('');
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [orderToStart, setOrderToStart] = useState(null);

  // Live Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  // Complete Cutting Modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [actualProduced, setActualProduced] = useState(0);
  const [scrapCount, setScrapCount] = useState(0);
  const [scrapReason, setScrapReason] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Operators on shift for Shop 2
  const onShiftOperators = useMemo(() => {
    return selectFilteredOperatorNames(systemUsers, 'Цех №2', selectedShift, 'порізка гуми', {
      onlyOnShiftDate: getTodayCalendarKey()
    });
  }, [systemUsers, selectedShift]);

  const allStageOperators = useMemo(() => {
    return selectFilteredOperatorNames(systemUsers, 'Цех №2', 'all', 'порізка гуми');
  }, [systemUsers]);

  // Load catalog and stock
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stockData, partsData, batchesData] = await Promise.all([
        fetchRawRubberStock(supabase),
        fetchRubberPartsCatalog(supabase),
        fetchCuttingBatches(supabase)
      ]);
      setRawStock(stockData);
      setParts(partsData);
      setBatches(batchesData);
    } catch (err) {
      console.error('[useRubberCuttingTerminal] Load data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Restore persisted job from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('centrum_active_rubber_job_v1');
      const saved = localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeBatchId && parsed.selectedPart) {
          if (parsed.selectedThickness) setSelectedThickness(parsed.selectedThickness);
          setSelectedPart(parsed.selectedPart);
          if (parsed.sheetsCount) setSheetsCount(parsed.sheetsCount);
          if (parsed.elapsedSeconds) setElapsedSeconds(parsed.elapsedSeconds);
          if (parsed.selectedOperators?.length) setSelectedOperators(parsed.selectedOperators);
          setActiveBatchId(parsed.activeBatchId);
        }
      }
    } catch (e) {}
  }, []);

  // Sync active job to localStorage
  useEffect(() => {
    if (selectedPart) {
      const toSave = {
        selectedThickness,
        selectedPart,
        sheetsCount,
        elapsedSeconds,
        selectedOperators,
        activeBatchId
      };
      localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, JSON.stringify(toSave));
    } else {
      localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    }
  }, [selectedThickness, selectedPart, sheetsCount, elapsedSeconds, selectedOperators, activeBatchId]);

  // Timer interval
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const startTimer = () => setIsTimerRunning(true);
  const pauseTimer = () => setIsTimerRunning(false);
  const resetTimer = () => {
    setIsTimerRunning(false);
    setElapsedSeconds(0);
  };

  // Filtered parts by selected thickness and search
  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchThick = p.thickness === selectedThickness;
      const matchSearch = !partSearch.trim() || 
        p.name.toLowerCase().includes(partSearch.toLowerCase()) || 
        p.part_size.toLowerCase().includes(partSearch.toLowerCase());
      return matchThick && matchSearch;
    });
  }, [parts, selectedThickness, partSearch]);

  // Calculations for active part
  const plannedDurationSec = useMemo(() => {
    if (!selectedPart) return 0;
    return (Number(sheetsCount) || 1) * (Number(selectedPart.sheet_cutting_time_sec) || 0);
  }, [selectedPart, sheetsCount]);

  const plannedTotalParts = useMemo(() => {
    if (!selectedPart) return 0;
    return (Number(sheetsCount) || 1) * (Number(selectedPart.sheet_yield) || 1);
  }, [selectedPart, sheetsCount]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Open completion modal
  const handleOpenCompleteModal = () => {
    if (!selectedPart) return;
    setIsTimerRunning(false);
    setActualProduced(plannedTotalParts);
    setScrapCount(0);
    setScrapReason('');
    setCompletionNotes('');
    setShowCompleteModal(true);
  };

  const pendingBatches = useMemo(() => {
    return batches.filter(b => b.status === 'pending');
  }, [batches]);

  const activeBatch = useMemo(() => {
    if (!activeBatchId) return null;
    return batches.find(b => b.id === activeBatchId) || null;
  }, [batches, activeBatchId]);

  const handleTakeOrderToWork = (order) => {
    setOrderToStart(order);
  };

  const handleConfirmStartTask = async ({ order, operators }) => {
    if (!order) return;
    setIsSubmitting(true);
    try {
      await startRubberCuttingTask(supabase, {
        batchId: order.id,
        operators,
        shift: selectedShift
      });

      const matchedPart = parts.find(
        p => p.id === order.part_id || p.code === order.part_code || p.name === order.part_name
      ) || {
        id: order.part_id || `local-${order.part_code}`,
        code: order.part_code,
        name: order.part_name,
        part_size: order.part_size,
        thickness: order.raw_material_code === 'V2-90030' ? 2 : 4,
        sheet_size: order.raw_material_code === 'V2-90030' ? '500*500*2' : '500*500*4',
        sheet_yield: order.sheet_yield || 1,
        sheet_cutting_time_sec: order.sheets_count > 0 ? Math.round((order.planned_duration_sec || 0) / order.sheets_count) : 0,
        item_cutting_time_sec: 0,
        raw_material_code: order.raw_material_code,
        raw_material_id: order.raw_material_id
      };

      setSelectedThickness(matchedPart.thickness || 2);
      setSelectedPart(matchedPart);
      setSheetsCount(order.sheets_count || 1);
      setSelectedOperators(operators);
      setActiveBatchId(order.id);
      setElapsedSeconds(0);
      setIsTimerRunning(true);
      setOrderToStart(null);
      setActiveTab('cutting');
      showToast(`🚀 Замовлення #${order.batch_number} взято в роботу!`);
      loadData();
    } catch (err) {
      console.error('[useRubberCuttingTerminal] Start task error:', err);
      showToast('❌ Помилка запуску замовлення');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit complete cutting
  const handleSubmitComplete = async () => {
    if (!selectedPart) return;
    setIsSubmitting(true);
    try {
      const res = await completeCuttingTransaction(supabase, {
        batchId: activeBatchId,
        part: selectedPart,
        sheetsCount,
        actualParts: actualProduced,
        scrapParts: scrapCount,
        scrapReason,
        elapsedSeconds,
        shift: selectedShift,
        operators: selectedOperators,
        notes: completionNotes
      });

      if (res.success) {
        showToast(`✅ Порізку завершено! Виготовлено ${actualProduced} шт. («${selectedPart.name}»)`);
        setShowCompleteModal(false);
        // Reset workstation
        setSelectedPart(null);
        setActiveBatchId(null);
        setSheetsCount(1);
        resetTimer();
        localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
        // Reload history & stock
        loadData();
      }
    } catch (err) {
      console.error('[useRubberCuttingTerminal] Submit error:', err);
      showToast('❌ Помилка збереження операції!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // Nav & System
    activeTab,
    setActiveTab,
    currentTime,
    selectedShift,
    setSelectedShift,
    selectedOperators,
    setSelectedOperators,
    onShiftOperators,
    allStageOperators,
    loading,
    toastMessage,
    showToast,
    loadData,

    // Catalogs & Stock
    rawStock,
    parts,
    batches,
    pendingBatches,
    activeBatch,

    // Order Start Flow
    orderToStart,
    setOrderToStart,
    handleTakeOrderToWork,
    handleConfirmStartTask,

    // Active Desk Selection
    selectedThickness,
    setSelectedThickness,
    selectedPart,
    setSelectedPart,
    sheetsCount,
    setSheetsCount,
    partSearch,
    setPartSearch,
    filteredParts,
    plannedDurationSec,
    plannedTotalParts,

    // Timer
    isTimerRunning,
    elapsedSeconds,
    startTimer,
    pauseTimer,
    resetTimer,

    // Complete Modal
    showCompleteModal,
    setShowCompleteModal,
    actualProduced,
    setActualProduced,
    scrapCount,
    setScrapCount,
    scrapReason,
    setScrapReason,
    completionNotes,
    setCompletionNotes,
    isSubmitting,
    handleOpenCompleteModal,
    handleSubmitComplete
  };
}

