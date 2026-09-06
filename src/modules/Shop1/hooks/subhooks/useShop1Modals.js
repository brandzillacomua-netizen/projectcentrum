import { useState, useEffect, useMemo, useCallback } from 'react';

export function useShop1Modals({
  currentUser,
  systemUsers,
  selectedOperator,
  supabase
}) {
  // Complete modal & completion inputs
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSortingModal, setShowSortingModal] = useState(false);
  const [scrapCount, setScrapCount] = useState(0);
  const [reworkCount, setReworkCount] = useState(0);
  const [cuttersUsed, setCuttersUsed] = useState(0);
  const [cuttersBreakdown, setCuttersBreakdown] = useState({});
  const [cuttersTouched, setCuttersTouched] = useState({});
  const [galtPriority, setGaltPriority] = useState(2);

  // Shift Change modal
  const [showShiftChangeModal, setShowShiftChangeModal] = useState(false);
  const [shiftChangeOperator, setShiftChangeOperator] = useState('');
  const [shiftChangeShift, setShiftChangeShift] = useState('');

  // Pause modal
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('Поломка верстата');
  const [customPauseReason, setCustomPauseReason] = useState('');

  // QC modal
  const [showQCModal, setShowQCModal] = useState(false);
  const [qcScrapCount, setQcScrapCount] = useState(0);
  const [qcInspector, setQcInspector] = useState('');
  const [qcReason, setQcReason] = useState('Биття цанги');
  const [qcCustomReason, setQcCustomReason] = useState('');

  // Machine Call modal
  const [machineCallModal, setMachineCallModal] = useState(null);
  const [machineCallSuccess, setMachineCallSuccess] = useState('');
  const [selectedCallMasterId, setSelectedCallMasterId] = useState('');
  const [selectedCallEngineerId, setSelectedCallEngineerId] = useState('');
  const [selectedCallQCId, setSelectedCallQCId] = useState('');

  // Custom Alert dialog
  const [customAlert, setCustomAlert] = useState(null);
  const showAlert = useCallback((message, title = 'Сповіщення') => {
    setCustomAlert({ title, message });
  }, []);

  // Card Reset method - eliminates hidden coupling from coordinator
  const resetForCard = useCallback((card, configuredCutters = []) => {
    setScrapCount(0);
    setReworkCount(0);
    setQcScrapCount(0);
    setQcInspector('');
    setCuttersUsed(0);
    if (card?.operation === 'Розкрій') {
      const initBreakdown = {};
      (configuredCutters || []).forEach(name => { initBreakdown[name] = 0; });
      setCuttersBreakdown(initBreakdown);
      setCuttersTouched({});
    } else {
      setCuttersBreakdown({});
      setCuttersTouched({});
    }
    setGaltPriority(card?.galt_priority || 2);
  }, []);

  // Roles for machine call
  const callMasters = useMemo(() => (systemUsers || []).filter(u =>
    u.access_rights?.master ||
    u.access_rights?.foreman ||
    (u.position && u.position.toLowerCase().includes('майстер'))
  ), [systemUsers]);

  const callEngineers = useMemo(() => (systemUsers || []).filter(u =>
    u.access_rights?.engineer ||
    (u.position && u.position.toLowerCase().includes('інженер'))
  ), [systemUsers]);

  const callQCs = useMemo(() => (systemUsers || []).filter(u =>
    u.access_rights?.brak ||
    (u.position && (u.position.toLowerCase().includes('вкя') || u.position.toLowerCase().includes('якост')))
  ), [systemUsers]);

  useEffect(() => {
    if (!machineCallModal) {
      setSelectedCallMasterId('');
      setSelectedCallEngineerId('');
      setSelectedCallQCId('');
    }
  }, [machineCallModal]);

  const handleCreateCall = useCallback(async (role, employeeId = null) => {
    if (!machineCallModal?.id) return;
    try {
      const operatorName = selectedOperator || currentUser?.name || currentUser?.login || 'Оператор терміналу';
      const emp = (systemUsers || []).find(u => u.id === employeeId);
      const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : null;

      const { error } = await supabase.from('machine_calls').insert({
        machine_id: machineCallModal.id,
        called_role: role === 'qc' ? 'quality' : role,
        operator_name: operatorName,
        called_employee_id: employeeId || null,
        called_employee_name: empName || null,
        status: 'pending'
      });
      if (error) throw error;

      const label = role === 'master' ? 'Майстра' : role === 'engineer' ? 'Інженера' : 'ВКЯ';
      setMachineCallSuccess(`Виклик для ${label} надіслано!`);
      setTimeout(() => {
        setMachineCallSuccess('');
        setMachineCallModal(null);
      }, 2000);
    } catch (err) {
      alert('Помилка надсилання виклику: ' + err.message);
    }
  }, [machineCallModal, selectedOperator, currentUser, systemUsers, supabase]);

  return useMemo(() => ({
    showCompleteModal,
    setShowCompleteModal,
    showSortingModal,
    setShowSortingModal,
    scrapCount,
    setScrapCount,
    reworkCount,
    setReworkCount,
    cuttersUsed,
    setCuttersUsed,
    cuttersBreakdown,
    setCuttersBreakdown,
    cuttersTouched,
    setCuttersTouched,
    galtPriority,
    setGaltPriority,
    showShiftChangeModal,
    setShowShiftChangeModal,
    shiftChangeOperator,
    setShiftChangeOperator,
    shiftChangeShift,
    setShiftChangeShift,
    showPauseModal,
    setShowPauseModal,
    pauseReason,
    setPauseReason,
    customPauseReason,
    setCustomPauseReason,
    showQCModal,
    setShowQCModal,
    qcScrapCount,
    setQcScrapCount,
    qcInspector,
    setQcInspector,
    qcReason,
    setQcReason,
    qcCustomReason,
    setQcCustomReason,
    machineCallModal,
    setMachineCallModal,
    machineCallSuccess,
    setMachineCallSuccess,
    selectedCallMasterId,
    setSelectedCallMasterId,
    selectedCallEngineerId,
    setSelectedCallEngineerId,
    selectedCallQCId,
    setSelectedCallQCId,
    customAlert,
    setCustomAlert,
    showAlert,
    resetForCard,
    callMasters,
    callEngineers,
    callQCs,
    handleCreateCall
  }), [
    showCompleteModal,
    showSortingModal,
    scrapCount,
    reworkCount,
    cuttersUsed,
    cuttersBreakdown,
    cuttersTouched,
    galtPriority,
    showShiftChangeModal,
    shiftChangeOperator,
    shiftChangeShift,
    showPauseModal,
    pauseReason,
    customPauseReason,
    showQCModal,
    qcScrapCount,
    qcInspector,
    qcReason,
    qcCustomReason,
    machineCallModal,
    machineCallSuccess,
    selectedCallMasterId,
    selectedCallEngineerId,
    selectedCallQCId,
    customAlert,
    showAlert,
    resetForCard,
    callMasters,
    callEngineers,
    callQCs,
    handleCreateCall
  ]);
}
