import { useState, useEffect } from 'react';
import { getCurrentTime } from '../../../../supabase';
import { formatSec, parseDBTime } from '../../utils/shop1Helpers';

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

  const getCardTimeMetrics = (card) => {
    if (!card) return { totalSec: 0, currentSec: 0 };
    const nowMs = currentTime.getTime();

    const sourceHistory = String(card.id) === String(selectedCardId) && selectedCardHistory.length > 0
      ? selectedCardHistory
      : workCardHistory;

    const intervals = (sourceHistory || [])
      .filter(h => String(h.card_id) === String(card.id))
      .filter(h => {
        const stage = String(h.stage_name || '').toLowerCase();
        return !stage.includes('пауза') && !stage.includes('зупинка');
      })
      .map(h => [parseDBTime(h.started_at)?.getTime(), parseDBTime(h.completed_at)?.getTime()])
      .filter(([start, end]) => start && end && end > start);

    let currentSec = 0;
    if (card.status === 'in-progress') {
      const s = parseDBTime(card.started_at)?.getTime() || 0;
      currentSec = s ? Math.max(0, Math.floor((nowMs - s) / 1000)) : 0;
    } else if (card.status === 'at-buffer') {
      const bufferStart = card.completed_at || card.started_at;
      const s = parseDBTime(bufferStart)?.getTime() || 0;
      currentSec = s ? Math.max(0, Math.floor((nowMs - s) / 1000)) : 0;
    }

    if (currentSec > 0) {
      const currentStart = card.status === 'at-buffer'
        ? parseDBTime(card.completed_at || card.started_at)?.getTime()
        : parseDBTime(card.started_at)?.getTime();
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

    return { totalSec, currentSec };
  };

  const getCardStartDate = (card) => {
    const history = (workCardHistory || []).filter(h => String(h.card_id) === String(card?.id) && h.started_at);
    if (history.length > 0) {
      return new Date(Math.min(...history.map(h => parseDBTime(h.started_at).getTime())));
    }
    return parseDBTime(card?.started_at ? card.started_at : card?.created_at);
  };

  const formatTime = (iso) => {
    if (!iso) return '00:00:00';
    const s = parseDBTime(iso)?.getTime() || 0;
    if (!s) return '00:00:00';
    const d = Math.max(0, Math.floor((currentTime.getTime() - s) / 1000));
    return formatSec(d);
  };

  return {
    currentTime,
    getCardTimeMetrics,
    getCardStartDate,
    formatTime
  };
}
