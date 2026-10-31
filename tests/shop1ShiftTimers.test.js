import { describe, it, expect } from 'vitest';
import { computeShiftHistoryBaseSec } from '../src/modules/Shop1/hooks/subhooks/useShop1ShiftTimers';

describe('Shop1 Shift Timers & Pause Handling', () => {
  it('correctly sums pre-pause work in the same shift (10h work + 2h pause + 1h work)', () => {
    // 10 hours of work before pause
    const t0 = new Date('2026-10-31T08:00:00Z').toISOString();
    const t1 = new Date('2026-10-31T18:00:00Z').toISOString(); // 10h later
    // 2 hours pause
    const t2 = new Date('2026-10-31T20:00:00Z').toISOString(); // 2h pause

    const historyList = [
      {
        card_id: 'card-1',
        stage_name: 'Розкрій',
        started_at: t0,
        completed_at: t1,
        shift_name: 'Зміна 3',
        card_info: '[PAUSED_WORK_LOG][REASON:Обслуговування]'
      },
      {
        card_id: 'card-1',
        stage_name: 'Розкрій (зупинка)',
        started_at: t1,
        completed_at: t2,
        shift_name: 'Зміна 3',
        card_info: 'Причина зупинки: Обслуговування'
      }
    ];

    const card = {
      id: 'card-1',
      shift_name: 'Зміна 3',
      status: 'in-progress'
    };

    // Base history for the current shift should be exactly 10 hours (36000 seconds), ignoring the 2h pause
    const baseSec = computeShiftHistoryBaseSec(historyList, card);
    expect(baseSec).toBe(10 * 3600);
  });

  it('resets shift history after an official shift handover (перезмінка)', () => {
    // Shift 2 worked 10 hours
    const t0 = new Date('2026-10-31T08:00:00Z').toISOString();
    const t1 = new Date('2026-10-31T18:00:00Z').toISOString();

    const historyList = [
      {
        card_id: 'card-1',
        stage_name: 'Розкрій (перезмінка)',
        started_at: t0,
        completed_at: t1,
        shift_name: 'Зміна 2',
        card_info: '[REPLACED_BY:Іванов І. (Зміна 3)]'
      }
    ];

    // Card is now in Shift 3
    const card = {
      id: 'card-1',
      shift_name: 'Зміна 3',
      status: 'in-progress'
    };

    // Base history for Shift 3 should be 0 because all past work was before the handover
    const baseSec = computeShiftHistoryBaseSec(historyList, card);
    expect(baseSec).toBe(0);
  });

  it('handles multiple pauses within the same shift without losing accumulated work time', () => {
    // 3 hours work -> pause -> 4 hours work -> pause
    const t0 = new Date('2026-10-31T08:00:00Z').toISOString();
    const t1 = new Date('2026-10-31T11:00:00Z').toISOString(); // 3h work
    const t2 = new Date('2026-10-31T11:30:00Z').toISOString(); // 30m pause
    const t3 = new Date('2026-10-31T15:30:00Z').toISOString(); // 4h work
    const t4 = new Date('2026-10-31T16:00:00Z').toISOString(); // 30m pause

    const historyList = [
      {
        card_id: 'card-2',
        stage_name: 'Розкрій',
        started_at: t0,
        completed_at: t1,
        shift_name: 'Зміна 1',
        card_info: '[PAUSED_WORK_LOG]'
      },
      {
        card_id: 'card-2',
        stage_name: 'Розкрій (зупинка)',
        started_at: t1,
        completed_at: t2,
        shift_name: 'Зміна 1',
        card_info: 'Причина зупинки: Фреза'
      },
      {
        card_id: 'card-2',
        stage_name: 'Розкрій',
        started_at: t2,
        completed_at: t3,
        shift_name: 'Зміна 1',
        card_info: '[PAUSED_WORK_LOG]'
      },
      {
        card_id: 'card-2',
        stage_name: 'Розкрій (зупинка)',
        started_at: t3,
        completed_at: t4,
        shift_name: 'Зміна 1',
        card_info: 'Причина зупинки: Чай'
      }
    ];

    const card = {
      id: 'card-2',
      shift_name: 'Зміна 1',
      status: 'paused'
    };

    // Total accumulated work in this shift = 3h + 4h = 7 hours (25200s)
    const baseSec = computeShiftHistoryBaseSec(historyList, card);
    expect(baseSec).toBe(7 * 3600);
  });
});

