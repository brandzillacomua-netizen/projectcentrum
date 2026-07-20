# План стабілізації Centrum MES для 50 активних користувачів

## Ціль

- 50 одночасно активних користувачів без `too many clients`, `queue timeout` і ручного перезавантаження сторінки.
- Realtime-зміни на терміналах і дашбордах з'являються не пізніше ніж за 2 секунди у нормальному режимі.
- Після короткого обриву мережі клієнт сам відновлює канал і показує стан з'єднання.
- Жодна оптимізація не змінює бізнес-результат складської або виробничої операції без окремого контрольованого переходу.

## Що входить у перший пакет

1. Авторизаційно-кероване завантаження: сторінка входу більше не завантажує операційні таблиці.
2. Single-flight і cooldown для повних/точкових refresh, jitter для масового входу та повернення вкладок.
3. Великі `work_card_flow_totals` завантажуються лише потрібними модулями й лише для активних/нещодавно завершених нарядів; production summary викликається on-demand.
4. Chat unread рахується одним RPC; до застосування міграції працює обмежений сумісний fallback.
5. Chat Realtime застосовує payload локально та об'єднує повторні reload-події.
6. Не більше одного паралельного Supabase read-запиту з однієї вкладки; записи та Realtime не стоять у цій черзі. Зависле читання скасовується через 20 секунд.
7. Realtime heartbeat працює у Web Worker, помилки каналів відображаються користувачу.
8. Error Boundary не дозволяє одиничній помилці React залишити білий екран.
9. Service Worker кешує лише оболонку застосунку; Supabase-відповіді та мутації не кешуються.
10. Додані індекси для активних нарядів, карт, заявок і часової історії.
11. Великий список `tasks` читається послідовними сторінками по 500 рядків; transient 500 для production summary відкриває 60-секундний circuit breaker замість повторного шторму.

## Порядок розгортання

### 1. Staging

1. Створити staging-копію Supabase зі структурою production і знеособленими даними.
2. Застосувати міграції:
   - `20260720110000_chat_unread_counts.sql`;
   - `20260720140000_operational_query_indexes.sql`;
   - `20260720150000_fulfillment_queue.sql`;
   - `20260720160000_production_summary_rollup.sql`.
3. Розгорнути фронтенд і перевірити входи, Chat, склад, цехові термінали, дашборди та відновлення після мережевого обриву.

`20260720160000_production_summary_rollup.sql` один раз рахує точний підсумок усієї `work_card_history` і на час backfill тримає `SHARE ROW EXCLUSIVE` lock. `SELECT` продовжують працювати, але `INSERT`/`UPDATE`/`DELETE` чекають завершення міграції, тому її потрібно запускати тільки поза зміною. Якщо lock не вдається отримати за 5 секунд, міграція завершується помилкою й повністю відкочується; не повторювати її під робочим навантаженням.

`20260720150000_fulfillment_queue.sql` створює індекси черг пакування/відвантаження та один раз знаходить максимальний номер пакувального листа. Її також застосовувати поза зміною перед frontend, щоб сумісний fallback не приховав стару активну партію.

### 2. Read-only тест на 50 користувачів

PowerShell:

```powershell
$env:SUPABASE_URL = 'https://STAGING_PROJECT.supabase.co'
$env:SUPABASE_ANON_KEY = 'STAGING_ANON_KEY'
$env:MES_SECRET = 'STAGING_MES_SECRET'
$env:LOAD_TEST_CONFIRM = 'STAGING_READ_ONLY'
$env:LOAD_USERS = '50'
$env:LOAD_DURATION_SEC = '120'
$env:LOAD_THINK_MIN_MS = '1500'
$env:LOAD_THINK_MAX_MS = '3500'
npm run load:test:staging
```

Скрипт чекає готовності всіх 50 віртуальних користувачів, одночасно відпускає їх через start barrier, а потім утримує змішане навантаження маршрутів Shop1, складу, майстра, начальника цеху, пакування, менеджера, дашборда, логістики та чату протягом заданого часу. Кожен користувач спочатку виконує route bootstrap, а далі — послідовні read-запити з випадковим think time. Профілі пакування та логістики читають той самий bounded RPC `mes_fulfillment_queue`, який використовує frontend. Глобальні запити без фільтра до `work_card_scrap_totals` і `work_card_flow_totals` навмисно не входять у route-профілі: у frontend ці проєкції запитуються для конкретних task ID, тому повне сканування було б окремим stress probe, а не точною імітацією користувача.

За замовчуванням тест проходить лише за умов: немає HTTP-помилок і timeout, p95 не перевищує 2 секунди, p99 — 5 секунд, стартовий розкид не перевищує 1 секунду, досягнуто щонайменше 80% запланованої одночасності, а кожен користувач виконав мінімум 10 запитів і 3 steady-state запити. Пороги налаштовуються змінними `LOAD_P95_LIMIT_MS`, `LOAD_P99_LIMIT_MS`, `LOAD_MAX_ERROR_RATE_PCT`, `LOAD_MAX_5XX`, `LOAD_MAX_TIMEOUTS`, `LOAD_MIN_CONCURRENCY`, `LOAD_MIN_REQUESTS_PER_USER` і `LOAD_MIN_STEADY_REQUESTS_PER_USER`.

Realtime вимкнений за замовчуванням. Для окремого read-only тесту підписок його треба ввімкнути явно:

```powershell
$env:LOAD_REALTIME = 'I_UNDERSTAND_READ_ONLY'
$env:LOAD_REALTIME_USERS = '50'
$env:LOAD_REALTIME_TABLES = 'tasks,work_cards,material_requests'
npm run load:test:staging
```

Realtime-режим лише підписується на явно перелічені таблиці, не надсилає broadcast і не виконує мутацій. Основний сценарій також не має mutation endpoints; POST дозволені лише для allow-listed `STABLE` RPC `mes_production_summary` і `mes_fulfillment_queue`. Скрипт відмовляється приймати `service_role` key і працювати з production-проєктом без окремого аварійного override.

### 3. Канарковий rollout

1. Один тестовий термінал на 2–4 години.
2. П'ять реальних користувачів протягом зміни.
3. 25 користувачів протягом зміни.
4. Усі 50 користувачів після перевірки метрик і бізнес-інваріантів.

На кожному етапі попередній frontend build має залишатися доступним для швидкого відкату.

## Метрики та стоп-умови

Під час rollout контролювати Supabase Reports, Query Performance і браузерні `window.__mesApiHealth` / `window.__mesRealtimeChannels`.

Цільові значення:

- DB connections: стабільно нижче 55–60 із 90 на Small;
- API p95: до 800 мс для звичайних операцій, read-only load test до 2 секунд;
- Realtime: до 2 секунд;
- нуль `too many clients`, `UnableToConnectToTenantDatabase`, `queue timeout`;
- відсутність тривалого IOwait/swap;
- після reconnect дані узгоджуються без `Ctrl+F5`.

Rollout зупиняється, якщо з'являється хоча б одна з умов:

- повторна або подвійна складська проводка;
- зникнення/подвоєння активного наряду;
- p95 понад 2 секунди протягом 10 хвилин;
- DB connections понад 70% ліміту протягом 5 хвилин;
- Realtime не відновився протягом 30 секунд.

## Як трактувати 500 разом із браузерним CORS

Якщо той самий момент дає HTTP 500 для RPC/REST і браузер пише `No Access-Control-Allow-Origin`, не додавати випадкові CORS-заголовки у Vercel. Supabase gateway часто не встигає сформувати нормальну відповідь із CORS-заголовками, коли tenant database недоступна або її пул вичерпаний. Перевірити:

1. офіційний Supabase Status для регіону;
2. стан compute та Database Connections у Dashboard;
3. Postgres/API/Realtime logs на `too many clients`, `queue timeout`, `UnableToConnectToTenantDatabase`;
4. один мінімальний read-only запит, не серію повторів.

Якщо офіційний статус зелений, а мінімальний запит не відповідає 20 секунд після завершеного restart/resize, припинити повторні рестарти й відкрити звернення в Supabase Support як project-specific stuck/degraded instance.

## Сценарії ручної перевірки

- 50 входів із ramp 30 секунд.
- Одночасне відкриття дашбордів, складу, Shop1/Shop2 і Chat.
- 20 повідомлень у кількох чатах за хвилину: unread не дублюється, інші користувачі не виконують масові refetch.
- Вкладка у фоні 10 хвилин, потім повернення.
- Offline на 20–60 секунд і автоматичне відновлення.
- Рестарт staging Supabase.
