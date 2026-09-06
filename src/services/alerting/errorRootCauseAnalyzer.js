/**
 * @file errorRootCauseAnalyzer.js
 * @description Чиста доменна логіка діагностики причин збоїв (без побічних ефектів і залежностей).
 */

/**
 * Евристичний аналізатор виняткових ситуацій JavaScript
 * @param {Object} errorRecord - Об'єкт зафіксованої помилки
 * @returns {Object} Результат діагностики { category, causeTitle, causeDescription, recommendedAction }
 */
export function analyzeRootCause(errorRecord = {}) {
  const msg = String(errorRecord.message || '').toLowerCase()
  const stack = String(errorRecord.stack || '').toLowerCase()
  const compStack = String(errorRecord.componentStack || '').toLowerCase()
  const name = String(errorRecord.name || '').toLowerCase()

  // 1. Помилка завантаження динамічних модулів (Vite chunk load failure після деплою)
  if (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('vite:preloaderror') ||
    msg.includes('loading chunk')
  ) {
    return {
      category: 'CHUNK_LOAD',
      causeTitle: 'Застарілий кеш сторінки після оновлення версії (Deploy)',
      causeDescription: 'Браузер намагався завантажити старий хеш JavaScript-файлу, який був замінений на сервері після нового релізу.',
      recommendedAction: 'Оновити сторінку (F5 / Ctrl+F5) або натиснути кнопку «Перезавантажити» на терміналі.'
    }
  }

  // 2. Мережеві помилки та зв'язок із сервером / Supabase
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('timeout') ||
    msg.includes('abortcontroller') ||
    msg.includes('connection refused') ||
    msg.includes('net::err_') ||
    msg.includes('сервер не відповідає')
  ) {
    return {
      category: 'NETWORK',
      causeTitle: 'Втрата зв’язку з сервером або Wi-Fi збій',
      causeDescription: 'Планшет втратив зв’язок із базою даних Supabase або локальним шлюзом через падіння Wi-Fi покриття у цеху.',
      recommendedAction: 'Перевірити підключення до Wi-Fi на планшеті. Якщо мережа є — перевірити статус сервера баз даних.'
    }
  }

  // 3. Звернення до властивостей null/undefined (NullPointer / Type Integrity)
  if (
    msg.includes('cannot read properties of undefined') ||
    msg.includes('cannot read properties of null') ||
    msg.includes('is not a function') ||
    msg.includes('undefined is not an object') ||
    name.includes('typeerror')
  ) {
    // Уточнена діагностика по контексту
    let detail = 'Спроба звернутися до поля картки/замовлення, яке не заповнене або не прийшло з бази.'
    if (msg.includes('map') || msg.includes('filter') || msg.includes('foreach')) {
      detail = 'Очікувався масив даних, але з сервера прийшов null або порожній об’єкт.'
    } else if (msg.includes('status') || msg.includes('stage')) {
      detail = 'Картка має некоректний або відсутній статус/етап у базі даних.'
    }

    return {
      category: 'DATA_INTEGRITY',
      causeTitle: 'Невідповідність структури даних (TypeError)',
      causeDescription: detail,
      recommendedAction: 'Перевірити цілісність даних картки/запису в Supabase або оновити таблицю через кнопку синхронізації.'
    }
  }

  // 4. Помилки авторизації, RLS та сесії
  if (
    msg.includes('jwt') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('session expired')
  ) {
    return {
      category: 'AUTH_RLS',
      causeTitle: 'Закінчилась сесія або спрацювало обмеження доступу (RLS)',
      causeDescription: 'Токен користувача застарів або в цієї посади немає дозволу на виконання даної операції в базі даних.',
      recommendedAction: 'Вийти та повторно зайти в обліковий запис робітника або надати відповідні права доступу.'
    }
  }

  // 5. Переповнення сховища браузера
  if (
    msg.includes('quotaexceedederror') ||
    msg.includes('storage quota') ||
    name.includes('quotaexceeded')
  ) {
    return {
      category: 'STORAGE',
      causeTitle: 'Переповнено сховище браузера (localStorage / IndexedDB)',
      causeDescription: 'На планшеті закінчилося виділене місце для локальних даних та офлайн-буфера.',
      recommendedAction: 'Очистити кеш та дані сайту в налаштуваннях браузера планшета.'
    }
  }

  // 6. Помилка парсингу JSON
  if (
    msg.includes('unexpected token') ||
    msg.includes('json.parse') ||
    name.includes('syntaxerror')
  ) {
    return {
      category: 'SYNTAX_JSON',
      causeTitle: 'Помилка розбору JSON-відповіді',
      causeDescription: 'Сервер або локальне сховище повернули некоректний JSON (можливо, відповідь із помилкою 502/504 у форматі HTML).',
      recommendedAction: 'Перевірити працездатність API-сервера та формат збережених налаштувань.'
    }
  }

  // Загальний fallback
  return {
    category: 'UNHANDLED_EXCEPTION',
    causeTitle: 'Непередбачена виняткова ситуація JavaScript',
    causeDescription: `Виникла помилка [${errorRecord.name || 'Error'}]: ${errorRecord.message || 'без опису'}.`,
    recommendedAction: 'Натиснути кнопку «Відновити робоче місце» або перезавантажити вкладку термінала.'
  }
}
