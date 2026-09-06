import { useState, useEffect } from 'react';
import scannerDebounceGuard, { triggerHapticAudioFeedback } from '../../../../services/scannerDebounceGuard';
import {
  cyrillicToLatinMap,
  translateCyrillic,
  CHAIN
} from '../../utils/shop1Helpers';
import { getPendingRequestsForCard } from '../../../../utils/materialCardMatching.js';

export function useShop1Scanner({
  workCards,
  setWorkCards,
  requests,
  tasks = [],
  nomenclatures = [],
  supabase,
  scannedIds,
  setScannedIds,
  setSelectedCardId,
  onMachineCallTrigger,
  showAlert
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualId, setManualId] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleMachineQRScan = async (text) => {
    const cleanText = translateCyrillic(text);
    const match = String(cleanText || '').match(/\/machines\/([a-f0-9-]+)\/call/i);
    if (match) {
      const machineId = match[1];
      try {
        const { data: mData, error } = await supabase
          .from('machines')
          .select('*')
          .eq('id', machineId)
          .maybeSingle();

        if (mData && typeof onMachineCallTrigger === 'function') {
          onMachineCallTrigger({
            id: mData.id,
            name: mData.name,
            type: mData.type,
            sequence_number: mData.sequence_number,
            floor: mData.floor,
            inventory_no: mData.inventory_no
          });
        } else if (!mData) {
          alert('Верстат з таким ID не знайдено в базі.');
        }
      } catch (err) {
        console.error(err);
      }
      return true;
    }
    return false;
  };

  const checkCardMaterials = (card) => {
    if (!card) return false;
    if (card.status !== 'waiting_material' && card.status !== 'waiting-materials' && card.status !== 'waiting-cutters') return false;

    const parentTask = (tasks || []).find(t => String(t.id) === String(card.task_id));
    const pendingReqs = getPendingRequestsForCard(card, requests || [], parentTask, nomenclatures || []);
    if (pendingReqs.length > 0) {
      const materialList = pendingReqs.map((r, idx) => {
        return `${idx + 1}. ${r.details || 'Матеріали / фрези'}`;
      }).join('\n');
      if (typeof showAlert === 'function') {
        showAlert(
          `Дана картка очікує забезпечення складом:\n\n${materialList}\n\nБудь ласка, зверніться до працівника складу для підтвердження видачі перед початком роботи.`,
          `⏳ Очікування забезпечення матеріалів`
        );
      }
      return true;
    }
    return false;
  };

  const processCardScan = async (rawInput) => {
    if (!rawInput) return false;

    // Hardware Barcode Scanner Race & Debounce Guard
    if (!scannerDebounceGuard.shouldProcessScan(rawInput)) {
      return false;
    }

    let clean = translateCyrillic(String(rawInput).trim())
      .replace(/^CENTRUM_CARD_/i, '')
      .replace(/^#/, '')
      .trim();

    if (!clean) return false;

    const isMachineQR = await handleMachineQRScan(rawInput) || await handleMachineQRScan(clean);
    if (isMachineQR) return true;

    const queryLower = clean.toLowerCase();
    const hexSuffix = queryLower.slice(-8);

    let card = (workCards || []).find(c => {
      if (!c || !c.id) return false;
      const idLower = String(c.id).trim().toLowerCase();
      if (idLower === queryLower) return true;
      if (idLower.endsWith(hexSuffix)) return true;
      if (c.card_info && String(c.card_info).toLowerCase().includes(hexSuffix)) return true;
      return false;
    });

    if (!card) {
      setIsSyncing(true);
      try {
        const { data: freshCards } = await supabase
          .from('work_cards')
          .select('*')
          .ilike('id', `%${hexSuffix}`)
          .limit(10);

        if (freshCards && freshCards.length > 0) {
          card = freshCards[0];
        } else {
          const { data: directCard } = await supabase
            .from('work_cards')
            .select('*')
            .eq('id', clean)
            .maybeSingle();

          if (directCard) card = directCard;
        }
      } catch (err) {
        console.error('Error fetching scanned card from Supabase:', err);
      } finally {
        setIsSyncing(false);
      }
    }

    if (!card) {
      setScanError(`Картку №${clean.slice(-8).toUpperCase()} не знайдено в системі.`);
      triggerHapticAudioFeedback(false);
      return false;
    }

    if (typeof setWorkCards === 'function') {
      setWorkCards(prev => prev.some(c => c.id === card.id)
        ? prev.map(c => c.id === card.id ? { ...c, ...card } : c)
        : [card, ...prev]);
    }

    const isNew = card.status === 'new' || card.status === 'waiting-materials' || card.status === 'waiting_material' || card.status === 'waiting-cutters' || !card.operation || card.operation === 'Нова';
    const isInChain = CHAIN.includes(card.operation) ||
      String(card.operation).startsWith('Розкрій') ||
      String(card.operation).startsWith('Галтовка') ||
      card.operation === 'Прийомка' ||
      card.operation === 'Сортування';
    const isSorting = card.status === 'at-buffer' && card.operation === 'Сортування';

    if (!isNew && !isInChain && !isSorting) {
      setScanError(`Картка #${card.id.slice(-8).toUpperCase()} — не для Цеху №1 (${card.operation || 'невідомий етап'})`);
      triggerHapticAudioFeedback(false);
      return false;
    }

    if (card.status === 'completed') {
      setScanError(`Картка #${card.id.slice(-8).toUpperCase()} вже завершена`);
      triggerHapticAudioFeedback(false);
      return false;
    }

    setScannedIds(prev => prev.includes(card.id) ? prev : [...prev, card.id]);
    setSelectedCardId(card.id);
    setScanError(null);
    checkCardMaterials(card);
    triggerHapticAudioFeedback(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  };

  // Global keydown listener for barcode scanners
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length > 3) {
          const scannedText = buffer.trim();
          buffer = '';
          await processCardScan(scannedText);
        }
        buffer = '';
      } else if (e.key.length === 1) {
        const char = cyrillicToLatinMap[e.key] || e.key;
        buffer += char;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [workCards, requests]);

  const handleManualEntry = async (e) => {
    if (e) e.preventDefault();
    if (!manualId) return;

    const success = await processCardScan(manualId);
    if (success) {
      setManualId('');
      setShowManualInput(false);
      setIsScanning(false);
    }
  };

  return {
    isScanning,
    setIsScanning,
    manualId,
    setManualId,
    showManualInput,
    setShowManualInput,
    scanError,
    setScanError,
    isSyncing,
    processCardScan,
    handleManualEntry
  };
}
