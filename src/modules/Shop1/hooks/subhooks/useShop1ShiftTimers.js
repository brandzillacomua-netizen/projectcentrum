import { useState, useEffect, useMemo, useCallback } from 'react';
import { getCurrentTime } from '../../../../supabase';
import { formatSec, parseDBTime } from '../../utils/shop1Helpers';

export const computeShiftHistoryBaseSec = (historyList, card) => {
  if (!historyList || historyList.length === 0) return 0;

  let lastHandoverMs = 0;
  for (const h of historyList) {
    const stage = String(h?.stage_name || '').toLowerCase();
    if (stage.includes('перезмінка') || String(h?.card_info || '').includes('[REPLACED_BY:')) {
      const t = parseDBTime(h?.completed_at || h?.started_at)?.getTime() || 0;
      if (t > lastHandoverMs) lastHandoverMs = t;
    }
  }

  const intervals = [];
  const cardShift = String(card?.shift_name || '').trim();

  for (const h of historyList) {
    const stage = String(h?.stage_name || '').toLowerCase();
    if (stage.includes('пауза') || stage.includes('зупинка')) continue;

    const s = parseDBTime(h?.started_at)?.getTime();
    const e = parseDBTime(h?.completed_at)?.getTime();
    if (!s || !e || e <= s) continue;

    // If there was a handover, skip work records that finished before or at the handover
    if (lastHandoverMs > 0 && e <= lastHandoverMs) continue;

    // If both card and history record specify a shift, they must match
    const hShift = String(h?.shift_name || '').trim();
    if (cardShift && hShift && cardShift !== hShift) continue;

    intervals.push([s, e]);
  }

  if (intervals.length === 0) return 0;

  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of intervals) {
    const last = merged[merged.length - 1];
    if (!last || s > last[1]) merged.push([s, e]);
    else last[1] = Math.max(last[1], e);
  }

  return merged.reduce((sum, [s, e]) => sum + Math.max(0, Math.floor((e - s) / 1000)), 0);
};

export function useShop1ShiftTimers({
  selectedCardId,
  selectedCardHistory,
  workCardHistory
}) {
  const [currentTime, setCurrentTime] = useState(getCurrentTime());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(getCurrentTime()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pre-index workCardHistory by card_id (O(1) lookups instead of O(N) array filtering)
  const historyByCardId = useMemo(() => {
    const map = new Map();
    for (const h of workCardHistory || []) {
      if (!h || !h.card_id) continue;
      const cid = String(h.card_id);
      let list = map.get(cid);
      if (!list) {
        list = [];
        map.set(cid, list);
      }
      list.push(h);
    }
    return map;
  }, [workCardHistory]);

  // Pre-calculate base duration from completed historical stages once per history update
  const cardHistoryBaseSec = useMemo(() => {
    const map = new Map();
    for (const [cardId, list] of historyByCardId.entries()) {
      const intervals = [];
      for (const h of list) {
        const stage = String(h.stage_name || '').toLowerCase();
        if (stage.includes('пауза') || stage.includes('зупинка')) continue;
        const s = parseDBTime(h.started_at)?.getTime();
        const e = parseDBTime(h.completed_at)?.getTime();
        if (s && e && e > s) {
          intervals.push([s, e]);
        }
      }
      if (intervals.length > 0) {
        intervals.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const [s, e] of intervals) {
          const last = merged[merged.length - 1];
          if (!last || s > last[1]) merged.push([s, e]);
          else last[1] = Math.max(last[1], e);
        }
        const total = merged.reduce((sum, [s, e]) => sum + Math.max(0, Math.floor((e - s) / 1000)), 0);
        map.set(cardId, total);
      }
    }
    return map;
  }, [historyByCardId]);

  const getCardTimeMetrics = useCallback((card) => {
    if (!card) return { totalSec: 0, currentSec: 0, shiftSec: 0 };
    const nowMs = currentTime.getTime();
    const cardIdStr = String(card.id);
    const inBuf = card.status === 'at-buffer';

    let activeSec = 0;
    if (card.status === 'in-progress') {
      const s = parseDBTime(card.started_at)?.getTime() || 0;
      activeSec = s ? Math.max(0, Math.floor((nowMs - s) / 1000)) : 0;
    }

    let bufferSec = 0;
    if (inBuf) {
      const bufferStart = card.completed_at || card.started_at;
      const s = parseDBTime(bufferStart)?.getTime() || 0;
      bufferSec = s ? Math.max(0, Math.floor((nowMs - s) / 1000)) : 0;
    }

    // If active selected card has dedicated real-time history records
    if (cardIdStr === String(selectedCardId) && selectedCardHistory && selectedCardHistory.length > 0) {
      const intervals = selectedCardHistory
        .filter(h => {
          const stage = String(h.stage_name || '').toLowerCase();
          return !stage.includes('пауза') && !stage.includes('зупинка');
        })
        .map(h => [parseDBTime(h.started_at)?.getTime(), parseDBTime(h.completed_at)?.getTime()])
        .filter(([start, end]) => start && end && end > start);

      if (inBuf && bufferSec > 0) {
        const bufferStart = parseDBTime(card.completed_at || card.started_at)?.getTime();
        if (bufferStart) intervals.push([bufferStart, nowMs]);
      } else if (activeSec > 0) {
        const currentStart = parseDBTime(card.started_at)?.getTime();
        if (currentStart) intervals.push([currentStart, nowMs]);
      }

      intervals.sort((a, b) => a[0] - b[0]);
      const merged = [];
      intervals.forEach(([start, end]) => {
        const last = merged[merged.length - 1];
        if (!last || start > last[1]) merged.push([start, end]);
        else last[1] = Math.max(last[1], end);
      });

      const totalSec = merged.reduce((sum, [start, end]) => (
        sum + Math.max(0, Math.floor((end - start) / 1000))
      ), 0);

      const shiftHistorySec = inBuf ? 0 : computeShiftHistoryBaseSec(selectedCardHistory, card);
      const shiftSec = inBuf ? 0 : (shiftHistorySec + activeSec);
      const currentSec = inBuf ? bufferSec : shiftSec;

      return { totalSec, currentSec, shiftSec };
    }

    // High performance path for table cards: baseSec + activeSec / bufferSec
    const baseSec = cardHistoryBaseSec.get(cardIdStr) || 0;
    const historyList = historyByCardId.get(cardIdStr) || [];
    const shiftHistorySec = inBuf ? 0 : computeShiftHistoryBaseSec(historyList, card);
    const shiftSec = inBuf ? 0 : (shiftHistorySec + activeSec);
    const currentSec = inBuf ? bufferSec : shiftSec;
    const totalSec = inBuf ? (baseSec + bufferSec) : (baseSec + activeSec);

    return { totalSec, currentSec, shiftSec };
  }, [currentTime, selectedCardId, selectedCardHistory, cardHistoryBaseSec, historyByCardId]);

  // Pre-indexed start dates
  const cardStartDates = useMemo(() => {
    const map = new Map();
    for (const [cardId, list] of historyByCardId.entries()) {
      let minTime = Infinity;
      for (const h of list) {
        if (h.started_at) {
          const t = parseDBTime(h.started_at)?.getTime();
          if (t && t < minTime) minTime = t;
        }
      }
      if (minTime !== Infinity) {
        map.set(cardId, new Date(minTime));
      }
    }
    return map;
  }, [historyByCardId]);

  const getCardStartDate = useCallback((card) => {
    if (!card) return null;
    const cached = cardStartDates.get(String(card.id));
    if (cached) return cached;
    return parseDBTime(card.started_at ? card.started_at : card.created_at);
  }, [cardStartDates]);

  const formatTime = useCallback((iso) => {
    if (!iso) return '00:00:00';
    const s = parseDBTime(iso)?.getTime() || 0;
    if (!s) return '00:00:00';
    const d = Math.max(0, Math.floor((currentTime.getTime() - s) / 1000));
    return formatSec(d);
  }, [currentTime]);

  return {
    currentTime,
    getCardTimeMetrics,
    getCardStartDate,
    formatTime
  };
}
