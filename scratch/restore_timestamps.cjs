const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

// Ці timestamps є "підписом" зіпсованих даних (встановлені скриптом 22.06)
const BAD_COMPLETED_PATTERNS = [
  '2026-06-22T19:44:55',
  '2026-06-22T20:01:51',
  '2026-06-22T19:44:20',
  '2026-06-22T19:45:30',
];
const BAD_STARTED_PATTERNS = [
  '2026-06-22T19:14:55',
  '2026-06-22T19:31:51',
  '2026-06-22T19:44:55',
  '2026-06-22T19:44:20',
  '2026-06-22T20:01:51',
  '2026-06-22T19:15:30',
];

function isBadTimestamp(ts, patterns) {
  if (!ts) return false;
  return patterns.some(p => ts.startsWith(p));
}

function extractOriginalStart(cardInfo) {
  if (!cardInfo) return null;
  const match = cardInfo.match(/\[ORIGINAL_START:([^\]]+)\]/);
  if (match) return match[1];
  return null;
}

function isFuture(ts) {
  if (!ts) return false;
  return new Date(ts) > new Date();
}

async function run() {
  const now = new Date();
  console.log('=== Відновлення timestamps ===');
  console.log('Поточний час (UTC):', now.toISOString());
  console.log('Поточний час (Київ):', now.toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' }));

  // Завантажити всю history
  const { data: history, error: herr } = await supabase.from('work_card_history').select('*');
  if (herr) { console.error('Помилка history:', herr); return; }

  // Зробити map: card_id -> список history entries (відсортовані за created_at desc)
  const historyByCard = {};
  for (const h of history) {
    if (!h.card_id) continue;
    if (!historyByCard[h.card_id]) historyByCard[h.card_id] = [];
    historyByCard[h.card_id].push(h);
  }
  for (const key of Object.keys(historyByCard)) {
    historyByCard[key].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Завантажити всі активні картки
  const { data: cards, error: cerr } = await supabase.from('work_cards').select('*');
  if (cerr) { console.error('Помилка cards:', cerr); return; }

  let fixedCount = 0;

  for (const c of cards) {
    const needsCompletedFix = isBadTimestamp(c.completed_at, BAD_COMPLETED_PATTERNS) || isFuture(c.completed_at);
    const needsStartedFix = isBadTimestamp(c.started_at, BAD_STARTED_PATTERNS) || isFuture(c.started_at);

    if (!needsCompletedFix && !needsStartedFix) continue;

    console.log(`\nКартка ${c.id.slice(-8)} [${c.status}] ${c.operation} - ${c.operator_name}`);
    console.log(`  started_at=${c.started_at} (${needsStartedFix ? 'ЗІПСОВАНО' : 'ОК'})`);
    console.log(`  completed_at=${c.completed_at} (${needsCompletedFix ? 'ЗІПСОВАНО' : 'ОК'})`);

    let newStarted = c.started_at;
    let newCompleted = c.completed_at;

    // 1) Спробуємо знайти реальний час з history
    const cardHistory = historyByCard[c.id] || [];

    if (needsCompletedFix) {
      // Для at-buffer: шукаємо найпізніший completed_at з history що не зіпсований
      let histCompleted = null;
      for (const h of cardHistory) {
        if (h.completed_at && !isBadTimestamp(h.completed_at, BAD_COMPLETED_PATTERNS) && !isFuture(h.completed_at)) {
          histCompleted = h.completed_at;
          break;
        }
      }
      if (histCompleted) {
        console.log(`  -> completed_at з history: ${histCompleted}`);
        newCompleted = histCompleted;
      } else {
        // Якщо in-progress: completed_at не потрібен
        if (c.status === 'in-progress') {
          newCompleted = null;
          console.log(`  -> completed_at=null (in-progress)`);
        } else {
          // Для at-buffer без history: встановити 1 годину тому
          newCompleted = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
          console.log(`  -> completed_at = зараз - 1 год: ${newCompleted}`);
        }
      }
    }

    if (needsStartedFix) {
      // Шукаємо реальний started_at з history (беремо найстаріший валідний)
      let histStarted = null;
      const validHistEntries = cardHistory.filter(h =>
        h.started_at &&
        !isBadTimestamp(h.started_at, BAD_STARTED_PATTERNS) &&
        !isFuture(h.started_at)
      );
      if (validHistEntries.length > 0) {
        // Найстаріший запис для цієї картки = коли реально почали
        validHistEntries.sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
        histStarted = validHistEntries[0].started_at;
      }

      if (histStarted) {
        console.log(`  -> started_at з history: ${histStarted}`);
        newStarted = histStarted;
      } else {
        // Перевірити ORIGINAL_START в card_info
        const origStart = extractOriginalStart(c.card_info);
        if (origStart && !isBadTimestamp(origStart, BAD_STARTED_PATTERNS) && !isFuture(origStart)) {
          console.log(`  -> started_at з ORIGINAL_START: ${origStart}`);
          newStarted = origStart;
        } else {
          // Якщо in-progress: started_at = зараз (таймер скинеться, але хоча б не 44 години)
          if (c.status === 'in-progress') {
            newStarted = now.toISOString();
            console.log(`  -> started_at = зараз (in-progress без history): ${newStarted}`);
          } else {
            // at-buffer: started_at = completed_at - 30 хв
            const compRef = newCompleted || now.toISOString();
            newStarted = new Date(new Date(compRef).getTime() - 30 * 60 * 1000).toISOString();
            console.log(`  -> started_at = completed - 30хв: ${newStarted}`);
          }
        }
      }
    }

    // Перевірити що started_at < completed_at
    if (newStarted && newCompleted && new Date(newStarted) >= new Date(newCompleted)) {
      newStarted = new Date(new Date(newCompleted).getTime() - 30 * 60 * 1000).toISOString();
      console.log(`  -> (корекція: started_at має бути < completed_at) -> ${newStarted}`);
    }

    const updates = {};
    if (needsStartedFix) updates.started_at = newStarted;
    if (needsCompletedFix) updates.completed_at = newCompleted;

    console.log(`  => Оновлення:`, updates);

    const { error: uerr } = await supabase.from('work_cards').update(updates).eq('id', c.id);
    if (uerr) {
      console.error(`  ПОМИЛКА при оновленні:`, uerr);
    } else {
      fixedCount++;
      console.log(`  ✓ Виправлено`);
    }
  }

  console.log(`\n=== Готово! Виправлено ${fixedCount} карток ===`);
}

run().catch(console.error);
