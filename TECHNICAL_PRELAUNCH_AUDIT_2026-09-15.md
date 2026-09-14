# CENTRUM MES — Technical Audit / Pre-Launch Architecture Review

**Дата аудиту:** 2026-09-15  
**Роль:** Senior Software Architect / Solution Architect, Senior Backend Engineer, QA Lead, DevOps/SRE, Application Security Engineer  
**Об'єкт:** репозиторій `A:\centrum`, гілка `main`, commit `cb22b85`  
**Рішення:** **NO-GO для неконтрольованого production release**  
**Enterprise pre-launch readiness:** **46/100**  
**Рівень довіри до висновку:** середньо-високий для коду та конфігурації; обмежений для фактичної production-інфраструктури, бо не виконувалися write-тести, повний role-by-role DB audit, load test і restore drill.

---

## 1. Executive summary

Система не є «все погано». У ній уже є хороші інженерні елементи: Supabase Auth JWT, атомарний production RPC для основного переходу картки, idempotency key, RLS lockdown для `anon`, security headers, secret scan, dependency audit, migration validators, 241 unit/contract tests, production build budget, зовнішній public smoke та production read-only security probes.

Але станом на цей commit система не проходить власний release gate і має фундаментальні розриви саме в тих місцях, де MES повинна бути найсуворішою:

1. **Атомарність не є обов'язковою.** При помилці RPC клієнт переходить на неатомарні прямі записи. Таким чином, гарантія `SELECT ... FOR UPDATE + idempotency` зникає саме в деградованому режимі.
2. **Каскадне видалення замовлення виконується з браузера десятками незалежних запитів.** Помилки дочірніх видалень ігноруються через `Promise.allSettled`, після чого система все одно намагається видалити батьківський order і приховує загальну помилку.
3. **Новий realtime hotfix, імовірно, не підписується на `sys_sync_pings`.** Обробник додається після виклику `.subscribe()`, тоді як Supabase формує список postgres filters синхронно під час `.subscribe()`.
4. **Поточний CI червоний.** Є security boundary violations, дві колізії timestamp міграцій і відсутні rollout/rollback contracts у нових production-міграціях.
5. **Одна з нових міграцій повторно відкриває анонімний `SECURITY DEFINER` RPC, який повертає повний JSON payload виробничої історії.** Це прямий regression від задекларованої моделі «anon має лише два QR RPC».
6. **Заявлений offsite encrypted backup не робить ані encryption, ані offsite upload.** Скрипт створює plaintext SQL у temp runner-а; workflow не відновлює цей dump перед parity check і не зберігає backup як artifact/S3 object.
7. **Повний authenticated RBAC для виробничого ядра не завершений.** 46 таблиць мають прямі клієнтські записи, а найкритичніші `orders`, `inventory`, `material_requests`, `work_cards`, `work_card_history` офіційно відкладені до Wave E.
8. **E2E доказів критичного виробничого маршруту немає.** У репозиторії є чотири поверхневі Playwright checks; вони не входять у CI, не логіняться валідною роллю, не створюють/проводять наряд, не тестують double-click, concurrency, partial completion, offline replay чи склад.

У такому стані реліз може працювати в нормальному happy path, але не має достатніх гарантій цілісності при concurrency, частковій відмові, нестабільній мережі, невідповідності схеми або аварійному відновленні.

---

## 2. Методика й фактичні перевірки

### 2.1. Що було перевірено

- структура `src`, `server`, `api`, `supabase/migrations`, `tests`, `.github/workflows`;
- authentication та serverless authorization boundaries;
- прямі клієнтські записи в БД, RPC, offline queue, idempotency і транзакційні межі;
- RLS/GRANT/`SECURITY DEFINER` зміни останніх міграцій;
- CI/CD, deployment verification, backup/restore scripts, monitoring, CSP;
- unit/contract tests, Playwright suite, build і bundle budget;
- read-only production probes для anonymous surface, auth bindings, Storage та atomic RPC contract;
- public production smoke.

### 2.2. Результати виконаних команд

| Перевірка | Результат | Інтерпретація |
|---|---:|---|
| TypeScript typecheck | PASS | Статичні типи не блокують build |
| Secret boundary | PASS, 2197 tracked files | У поточному дереві committed secret не знайдений |
| RLS boundary | **FAIL, 3 порушення** | Release blocker |
| Migration ordering | **FAIL, 2 timestamp collisions** | Release blocker |
| Production migration contract | **FAIL, 19 порушень** | Немає контрольованого rollout/rollback для нових міграцій |
| Read-only diagnostics guard | PASS | Діагностики не мутують production |
| Client access contract | PASS | Baseline не розширився; це не означає least privilege |
| Unit/contract tests | PASS, 57 files / 241 tests | Хороший regression signal, але не system proof |
| Production dependency audit | PASS, 0 known vulnerabilities | Перевірено через npm registry 2026-09-15 |
| Production build | PASS | Артефакт збирається |
| Entry bundle budget | PASS, 409.6 KB raw / 113.8 KB gzip | Entry в межах локального budget |
| Playwright E2E | **Не завершився; перерваний після тривалого зависання** | Не може бути release evidence |
| Public production smoke | PASS, 9 checks | Alias доступний, headers є, два serverless API відхиляють anon |
| Production anonymous table audit | PASS, 0/56 REST-reachable | Важливий позитивний security evidence |
| Auth binding audit | PASS, 139/139 linked | Усі видимі MES profiles прив'язані |
| Anonymous Storage probe | PASS, 0 visible objects | RLS не показав object rows anon-користувачу |
| Atomic transition read-only smoke | PASS, contract v4 | RPC доступний authenticated, anon отримує 401 |
| Backup preflight | **BLOCKED** | Немає доказу restore readiness у цьому середовищі |

### 2.3. Важливе обмеження

Read-only anonymous table audit не перевіряє кожний RPC. Тому результат `0 exposed tables` не спростовує finding про новий `SECURITY DEFINER` RPC: function execute privilege є окремою поверхнею атаки.

---

## 3. Прозора система оцінювання

Оцінка не є середнім «на око». Кожен домен має вагу, а release blockers обмежують максимальний результат. За правилами цієї матриці система з активним ризиком неконсистентних виробничих транзакцій, червоним CI та неперевіреним restore не може отримати 60+ незалежно від кількості feature-модулів.

| Домен | Вага | Бал | Обґрунтування |
|---|---:|---:|---|
| Architecture & boundaries | 15 | **8** | Модульність і DB RPC присутні; водночас браузер напряму володіє великим data-access surface, заявлений gateway обходиться, «пули» лише per-tab semaphore |
| Backend, DB, transactions | 20 | **6** | Primary atomic RPC сильний; fail-open fallbacks, browser cascade delete і reservation read-modify-write руйнують гарантії |
| Application security | 20 | **12** | JWT, anon lockdown, headers, secrets, dependency audit сильні; authenticated RBAC не завершений, нова anon function регресує privacy, rate limit не distributed |
| QA & correctness evidence | 15 | **6** | 241 tests проходять; немає production-like E2E, concurrency/partial-failure test matrix і coverage measurement |
| DevOps, SRE, DR | 15 | **5** | Public smoke та workflow scaffolding є; backup названий неправильно, restore не доведений, RPO/RTO відсутні, monitoring/SLO/rollback не підтверджені |
| Delivery & maintainability | 10 | **6** | CI дизайн корисний, typecheck/build PASS; сам CI FAIL, migration collisions, великі orchestrator files і docs drift |
| Performance & capacity | 5 | **3** | Bundle budget PASS, є load-test script; немає актуального PASS evidence, script використовує obsolete `x-mes-secret`, realtime hotfix має integration defect |
| **Разом** | **100** | **46** | **NO-GO** |

Це оцінка **enterprise pre-launch readiness**, а не таланту команди і не кількості реалізованих функцій.

---

## 4. Release-blocking findings

## P0-01. `anon` може отримати повний payload виробничої черги через `SECURITY DEFINER`

**Доказ:** `supabase/migrations/20260914030000_fix_vkya_rpc_500.sql:1-25`.

Функція:

- виконується як `SECURITY DEFINER`;
- читає `vkya_classification_queue_projection` незалежно від caller RLS;
- повертає `payload` без проєкції безпечних полів;
- надає `EXECUTE` ролям `anon, authenticated`.

Payload створюється через `to_jsonb(work_card_history row)` і `to_jsonb(vkya_reclassification_queue row)` у `20260724150000_vkya_classification_queue_projection.sql:56-62, 91-98, 114-119, 146-170`. Тобто це не мінімальний public DTO, а копія виробничого запису.

**Сценарій:** зовнішній користувач із публічним anon key викликає RPC без login і отримує активну чергу браку/відновлення з полями історії.

**Наслідок:** витік внутрішніх виробничих даних; обхід RLS; порушення власної allow-list моделі, де `anon` мав доступ лише до public machine-call RPC.

**Чому CI правильно блокує:** `security:rls` прямо повідомляє `anonymous EXECUTE is forbidden`.

**Виправлення:** grant лише `authenticated`; всередині function перевіряти `mes_current_system_user_id()` і право VKYA/quality/admin; повертати typed мінімальний DTO замість `payload`; додати negative test для anon та ролей без права; додати RPC inventory до production anonymous audit.

**Acceptance:** anon → 401/403; authenticated operator without VKYA right → 403/empty; VKYA role → тільки дозволені поля; postcondition перевіряє grants, owner, search path і function body.

## P0-02. «Atomic» core переходить у неатомарний fail-open режим

**Докази:**

- `src/services/atomicCardTransitionService.ts:125-166, 222-251`;
- `src/services/atomicInventoryService.js:22-79`;
- `src/services/offlineProcessor.js:64-82, 113-155`.

При RPC error код викликає `fallbackFn()` і повертає `{ success: true, viaRpc: false }`. Fallback виконує окремий `SELECT`, окремий history `INSERT`, окремий card/inventory `UPDATE`. Precondition read перед update не захищений row lock або compare-and-set version.

**Сценарій double-click / два планшети:** обидва клієнти читають однаковий status/stock, обидва проходять precondition, обидва пишуть. Можливі duplicate history, lost update, подвійний випуск/завершення або невідповідність card ↔ history.

**Сценарій schema drift:** RPC не розгорнутий або тимчасово повертає 500; замість fail-closed система silently переключається на старий алгоритм і повідомляє успіх.

**Наслідок:** корупція основного MES ledger. Це гірше за явну недоступність, бо оператор бачить success, а дані стають логічно суперечливими.

**Виправлення:** для production mutation видалити fallback direct writes. Network error → durable offline queue; business/schema/server error → visible failure + retry після відновлення RPC. Усі multi-row effects тільки однією DB transaction RPC. Додати optimistic version або expected status до RPC; заборонити прямі table grants для відповідних critical writes.

**Acceptance:** kill RPC/schema mismatch не змінює жодного рядка; два паралельні виклики з одним і різними idempotency keys дають один legal transition; fault injection між history і card update завершується повним rollback.

## P0-03. Видалення замовлення неатомарне й ігнорує часткові помилки

**Доказ:** `src/contexts/production/productionOrders.js:112-185, 350-469`.

Код запускає десятки DELETE у трьох фазах через `Promise.allSettled`, не аналізує `rejected`/Supabase `{ error }`, потім видаляє `orders`. Загальний `catch` логуватиме «non-critical cleanup warning», а `finally` refresh-ить UI. `superDeleteOrder` перед цим ще й перераховує inventory на клієнті та виконує `upsert`.

**Сценарій:** одна дочірня таблиця відмовила через RLS/FK/timeout, інші видалились; order row або видалився, або залишився без частини історії. Повторний клік працює вже з іншим набором children і може виконати інше коригування складу.

**Наслідок:** orphan rows, втрачена audit history, подвійне повернення резервів, order без task/cards або task/cards без order. Неможливо довести фінансову/складську правильність.

**Виправлення:** одна privileged RPC `rpc_delete_order_atomic(order_id, expected_version, idempotency_key, reason)`; `SELECT ... FOR UPDATE` на order та inventory rows у сталому порядку; перевірка статусу (не дозволяти hard delete активного/відвантаженого order); audit tombstone замість фізичного видалення де можливо; одна transaction; structured result.

**Acceptance:** fault injection на кожному кроці залишає DB byte/logically equivalent до pre-state; повторний request idempotent; паралельне видалення/завершення не створює partial state.

## P0-04. Realtime sync ping listener додається після subscribe і не входить у join filter

**Докази:**

- `src/contexts/data/dataRealtime.js:275-306` — `.subscribe()` на line 275, `.on(... sys_sync_pings ...)` на line 296;
- installed Supabase Realtime implementation `node_modules/@supabase/realtime-js/src/RealtimeChannel.ts:269-304` — `.subscribe()` синхронно бере `this.bindings.postgres_changes` і формує join payload;
- `.on()` після joined resubscribe-ить лише presence, не postgres changes: `RealtimeChannel.ts:532-544`.

**Сценарій:** heavy table Realtime вимкнений, система розраховує на lightweight ping. Але ping filter не відправлений серверу; інший планшет змінює task/inventory, поточний екран не отримує trigger для incremental catch-up до focus/reconnect/TTL path.

**Наслідок:** stale WIP/stock/status, оператор працює зі старим станом. Для MES це correctness issue, не лише UX.

**Виправлення:** зареєструвати всі `.on()` до `.subscribe()`; додати integration test із реальним/staging Realtime: mutation → ping event → targeted fetch ≤2 s; додати health telemetry last-ping/last-catchup age.

**Acceptance:** 50 підписників стабільно отримують ping; p95 propagation ≤2 s; reconnect не створює herd; тест підтверджує filter у join payload.

## P0-05. Міграційний ланцюг недетермінований і не проходить release contract

**Доказ:** фактичний output `npm run validate:migrations` і `npm run validate:production-migrations`.

Колізії:

- `20260914030000_fix_vkya_rpc_500.sql` ↔ `20260914030000_fix_fulfillment_queue_permissions.sql`;
- `20260914040000_optimize_fulfillment_indexes.sql` ↔ `20260914040000_add_sys_sync_pings.sql`.

Нові `fix_vkya_rpc_500` і `add_sys_sync_pings` не мають rollout contract, preflight, postcondition, rollback, lock/statement timeout. `optimize_fulfillment_indexes` також не має повного operational contract.

**Наслідок:** порядок застосування залежить від tooling/filesystem; production може отримати інший schema state, ніж staging; rollback і failure mode не визначені.

**Виправлення:** унікальні 14-digit timestamps; forward-only corrective migration замість перейменування вже застосованих remote migrations; додати metadata contract, bounded locks, diagnostics і rollback; перевірити remote migration history перед release.

**Acceptance:** обидва validators PASS на clean checkout; local/staging/production migration history parity; повторне застосування без side effects.

## P0-06. «Encrypted Offsite Backup» не є encrypted і не є offsite

**Докази:**

- `.github/workflows/scheduled-offsite-backup.yml:33-47` передає encryption/S3 variables;
- `scripts/create-production-backup.mjs:62-117` читає тільки DB URL/output path, створює `roles.sql`, `schema.sql`, `data.sql`, `manifest.json` у temp directory;
- у скрипті немає encryption, S3 upload, artifact upload або lifecycle/immutability;
- `scripts/verify-production-restore-parity.mjs:76-93` перевіряє вже наявний локальний Docker container; workflow не має кроку restore створеного backup у цей container.

Додатково dump scope лише `public` та `mes_private`; не включає повну `auth`, `storage`, migration history і самі Storage objects. На ephemeral GitHub runner plaintext dump зникає після job.

**Наслідок:** workflow або гарантовано впаде на fresh runner через відсутній restore container, або порівнюватиме не той restore; при provider/account incident немає незалежної копії для відновлення користувачів, файлів і повної системи.

**Виправлення:** створити dump → checksum → authenticated encryption → upload до versioned immutable bucket → download same object → isolated restore → schema/grants/policies/function hashes + row reconciliation + auth/storage checks → synthetic workflow → delete staging data per policy. Зберігати evidence artifact без секретів/PII.

**Acceptance:** quarterly restore drill з фактичним PASS, measured RPO/RTO, reviewer, hash, object version, tool versions, security probes й application E2E. До цього backup readiness = 0, незалежно від назви workflow.

---

## 5. High-priority findings

## P1-01. Authenticated RBAC для core data не завершений

`docs/security/RLS_MATRIX.md:41-65` фіксує 55 client tables, 1164 literal call sites і 46 таблиць із записом. Найбільші поверхні: `inventory` 110, `work_cards` 88, `material_requests` 83, `tasks` 60, `work_card_history` 60. Wave E для core tables офіційно ще не виконана.

**Ризик:** викрадений JWT low-privilege користувача може мати ширші прямі table capabilities, ніж UI показує. UI route/hidden button не є authorization control.

**Дія:** role × action × table/RPC matrix; deny-by-default grants; critical writes лише RPC; positive й negative tests кожної ролі; production shadow logging для RLS denies.

## P1-02. Offline conflict позначається success і видаляється з черги

`offlineProcessor.js:28-35, 53-59, 85-91` повертає `{ success: true, conflict: true }`. `offlineQueueService.ts:245-249` будь-який resolved response позначає processed і dequeue. Unknown action також повертає success (`offlineProcessor.js:172-175`).

**Сценарій:** оператор завершив картку offline, диспетчер змінив її online. Після reconnect conflict логуються, але mutation безповоротно видаляється з черги; оператор не має reconciliation task.

**Дія:** conflict ≠ success; переносити в durable reconciliation queue з UI для supervisor, зберігати intended action/server state/user/time; unknown action → dead letter/error; не видаляти, поки є business resolution.

## P1-03. Reservation updates мають lost-update race

`src/modules/Foreman/hooks/useMachineAssignment.js:40-56, 151-174, 258-268, 373-396` читає `reserved_qty`, обчислює нове значення в браузері і робить UPDATE. Кілька inventory rows і material requests не об'єднані однією transaction.

**Сценарій:** два майстри одночасно змінюють верстат/резерв; обидва читають reserved=10 і пишуть 12 та 13 — фінальне 13 замість 15.

**Дія:** RPC із row locks, check constraint `0 <= reserved_qty <= total_qty`, stable lock order, idempotency, ledger event.

## P1-04. `sys_sync_pings` migration має надмірну RLS policy і unsafe definer setup

`20260914040000_add_sys_sync_pings.sql:8-19` створює read-for-all та `FOR ALL USING(true) WITH CHECK(true)`, а trigger function `SECURITY DEFINER` не фіксує `search_path`. Навіть якщо table grants зараз випадково не дають anon write, policy є небезпечним майбутнім footgun.

**Дія:** `SELECT TO authenticated`; жодної client mutation policy; function `SET search_path = pg_catalog, public`; revoke execute from PUBLIC/anon/authenticated, бо це trigger-only function; postcondition на grants/policies.

## P1-05. Gateway і connection-pool claims не відповідають реалізації

`src/supabase.js:30-38, 121-127` примусово переводить gateway URL на прямий Supabase origin. `vercel.json:7` дозволяє прямі Supabase HTTP/WSS. Отже origin не прихований.

`src/supabase.js:40-97` реалізує два semaphore у пам'яті браузерної вкладки. Це не два PostgreSQL pools і не гарантує operational isolation між 50 користувачами.

**Наслідок:** threat model і capacity model побудовані на неіснуючих межах.

**Дія:** або чесно документувати direct Supabase + RLS/RPC security model, або реально впровадити gateway і заборонити direct origin. Для workload isolation потрібен server-side pool/role/resource governance або bounded RPC/query model, а не per-tab counters.

## P1-06. E2E suite не перевіряє бізнес

`tests/e2e/operatorWorkflow.spec.js` перевіряє login UI та неправильний пароль. `warehouseWorkflow.spec.js` перевіряє URL public route і branding. У `.github/workflows/ci.yml` запускаються Vitest і build, але немає `npm run test:e2e`.

Не покрито:

- valid login кожної ролі та negative permissions;
- order → task → cards → start → partial complete → buffer → QC → warehouse → shipment;
- double click, two devices, duplicate barcode scan;
- warehouse rejects/partially issues request;
- incomplete/partial naryad and rework;
- offline for 5/30/120 minutes, replay after conflicting online change;
- refresh/reconnect/realtime lag;
- API timeout, 500, 401 refresh, expired JWT;
- restore acceptance journey.

## P1-07. Немає measured SLO/observability proof

`src/services/sentryLogger.js:34-58` працює лише якщо DSN заданий; інакше local buffer. Код не доводить, що production DSN налаштований, alerts доходять, PII sanitation перевірена на реальних events, є dashboard/on-call/escalation.

**Дія:** SLI для mutation success/conflict, p95/p99 RPC, offline queue age/depth, dead letters, realtime catch-up age, DB saturation, 401/403/5xx; SLO та alert thresholds; synthetic probe; runbooks і ownership.

## P1-08. Serverless rate limit не є production-grade control

`api/_security.js:1-49` зберігає buckets у process-local `Map`. На serverless cold start/scale-out limit скидається і різні instances не ділять counter; Map не має cleanup для старих keys. Ключ бере перший `x-forwarded-for`, що без platform-normalized trust boundary може бути spoofable.

**Дія:** distributed edge/Redis/KV rate limit, trusted platform IP extraction, bounded TTL storage; окремий per-user + per-IP quota; upstream timeout і circuit breaker.

## P1-09. Telegram crash endpoint доступний будь-якому authenticated profile

`api/telegram-alert.js:17-31` вимагає rights лише для `kind=test`; crash може відправити будь-який authenticated user із довільним HTML message до внутрішнього chat. Per-instance 10/min rate limit легко обходиться scale-out.

**Ризик:** alert spam, соціальна інженія, masking реальних incidents.

**Дія:** server-generated structured alert payload, allow-listed fields, escape HTML, rate limit per user/device/error fingerprint; не приймати довільний final message від браузера.

## P1-10. Load-test tooling застарів відносно security model

`scripts/loadtest-readonly.mjs` і `docs/performance-rollout-50-users.md` усе ще вимагають `MES_SECRET`/`x-mes-secret`, хоча актуальний auth design декларує видалення цього механізму. Немає збереженого актуального PASS report для commit `cb22b85`.

**Дія:** staging users/JWT per role, anonymized dataset scale parity, HTTP + Realtime + reconnect profiles, versioned JSON results, thresholds in CI/manual release evidence.

---

## 6. QA scenario matrix перед релізом

| ID | Сценарій | Очікувана гарантія | Поточний evidence |
|---|---|---|---|
| Q-01 | Оператор натиснув Start двічі | Один transition/history; другий idempotent | RPC design частково є; browser fallback руйнує гарантію |
| Q-02 | Два планшети стартують одну картку | Один winner, другий conflict з актуальним owner/state | Немає DB concurrency test |
| Q-03 | Complete під час delete order | Один serializable outcome, без partial delete | Поточний browser cascade небезпечний |
| Q-04 | History insert успішний, card update впав | Повний rollback | Fallback залишає partial history |
| Q-05 | Склад видав лише частину | Явний partial state, залишок request, точні reserve/stock ledger | Немає E2E evidence |
| Q-06 | Склад не підтвердив | Наряд не переходить у незаконний stage | Немає E2E evidence |
| Q-07 | Наряд частково виконаний | Produced/scrap/WIP balance invariant | Є unit logic, немає full DB journey |
| Q-08 | Offline completion, стан змінено online | Supervisor reconciliation, action не губиться | Поточний conflict dequeue-иться |
| Q-09 | Offline queue item має невідому версію | Dead letter + alert, не success | Зараз unknown action = success |
| Q-10 | RPC 404/500 через schema drift | Fail closed, жодних прямих write | Зараз fallback direct write |
| Q-11 | Два майстри резервують один stock | Atomic increment, invariant preserved | Lost-update race можливий |
| Q-12 | Realtime ping після mutation | Targeted refresh ≤2 s | Listener order defect |
| Q-13 | JWT expired під час mutation | 401, refresh/relogin, no duplicate retry | Немає end-to-end evidence |
| Q-14 | RLS заборонила child delete | Вся delete transaction rollback | Зараз `allSettled` продовжує |
| Q-15 | DB/network timeout після commit, до response | Retry idempotent, UI reconciles server state | Лише частково покрито primary RPC |
| Q-16 | Restore backup на чистий target | Login + core workflow + security parity | Не доведено |

Обов'язково автоматизувати Q-01…Q-05, Q-08…Q-12, Q-14…Q-16. Решту — integration/E2E або контрольований manual evidence.

---

## 7. Архітектурний висновок

Поточна модель — **client-heavy SPA + direct Supabase/PostgREST + DB-centric RPC для частини critical flows + serverless proxies для секретних інтеграцій**.

Для невеликого MES це життєздатний підхід, якщо виконуються чотири жорсткі правила:

1. критичні мутації тільки через transactional RPC;
2. grants/RLS є повною авторизацією, а не UI;
3. offline — durable command log з reconciliation, не silent fallback;
4. schema/release/DR мають доказову дисципліну.

У цьому репозиторії кожне з цих правил реалізовано лише частково. Отже проблема не в самому виборі React/Supabase/Postgres, а в **непослідовності boundary enforcement**. Система одночасно має правильні atomic RPC і legacy direct-write обходи; правильний anon lockdown і нову anon definer function; backup runbook із чесними acceptance criteria і workflow, який фактично не робить offsite backup.

Рекомендована цільова схема без обов'язкового повного rewrite:

```text
React terminals
  ├─ read models через RLS-scoped SELECT/RPC
  ├─ commands тільки typed RPC/API
  └─ offline command outbox (idempotency + version + actor + device)
          │
          ▼
PostgreSQL command functions
  ├─ auth/right check
  ├─ row locks у сталому порядку
  ├─ FSM + invariants
  ├─ ledger/history/outbox в одній transaction
  └─ structured deterministic result
          │
          ├─ Realtime/outbox projection
          └─ monitoring/audit
```

Backend Node/Vercel потрібен для secret-bearing integrations, distributed rate limiting, webhook verification та, за потреби, orchestration. Не потрібно переносити всю бізнес-логіку з Postgres лише заради «класичного backend»; потрібно прибрати bypass paths.

---

## 8. План виправлення

### 0–48 годин: release freeze і P0 containment

1. Не застосовувати три проблемні міграції в production.
2. Прибрати `anon` grant з VKYA changes RPC; додати role check/DTO.
3. Переставити `sys_sync_pings.on()` перед `.subscribe()`; звузити policy/function privileges.
4. Усунути timestamp collisions і додати rollout contracts.
5. Заборонити atomic fallbacks у production feature flag/default; server errors мають бути fail-closed.
6. Заблокувати hard/super delete order до появи atomic RPC або дозволити лише через контрольований admin maintenance procedure.
7. CI має стати green на clean checkout.

### 3–7 днів: correctness baseline

1. Atomic order deletion/archive RPC.
2. Atomic reservation/machine reassignment RPC.
3. Offline conflict inbox + dead-letter UI.
4. DB integration harness із real PostgreSQL/Supabase-compatible schema.
5. Concurrency/fault-injection tests для core commands.
6. Включити Playwright у CI з synthetic staging dataset.
7. Оновити load test до JWT і провести 50-user test.

### 1–3 тижні: security і operational readiness

1. Waves D/E authenticated RBAC з role-by-role matrix.
2. Distributed API rate limiting та structured Telegram alerts.
3. Реальний encrypted immutable offsite backup + restore drill.
4. Sentry/metrics/tracing/SLO/on-call runbooks.
5. Staging promotion, immutable release SHA, canary/rollback criteria.
6. Узгодити документацію з реальною topology; прибрати claims про gateway/DB pools, якщо їх немає.

---

## 9. Формальні release gates

Release може перейти з **NO-GO** у **CONDITIONAL GO**, лише якщо одночасно:

- `npm run ci` PASS на clean checkout;
- усі migration timestamps unique, contracts/preflight/postcondition/rollback PASS;
- немає anon execute на business-data RPC;
- direct-write fallback для card/inventory/QC/buffer вимкнений;
- order deletion transactional або заблокований;
- realtime ping integration test PASS;
- authenticated RBAC negative tests для ролей critical tables PASS;
- Playwright critical journey PASS у staging;
- 50-user load test у межах затверджених p95/p99/error thresholds;
- backup object реально існує offsite, зашифрований і відновлений на clean isolated target;
- зафіксовані measured RPO/RTO;
- Sentry/metrics synthetic alert доходить on-call;
- public/authenticated smoke прив'язаний до exact release SHA.

Для **FULL GO** потрібні щонайменше один успішний canary release і повторний restore drill за графіком.

---

## 10. Що вже зроблено правильно і має бути збережено

- `anon` table surface у production зараз 0/56 за read-only audit;
- 139/139 MES profiles мають валідну identity binding;
- atomic transition RPC contract v4 доступний і anon-denied;
- service-role key не знайдений у browser code;
- Nova Poshta/Telegram anonymous requests відхиляються;
- CSP/HSTS/nosniff/frame protections реально віддаються production;
- dependency audit показав 0 known production vulnerabilities;
- migration/security validators існують і фактично спіймали регресії;
- 241 unit/contract tests і build budget дають корисний базовий regression signal;
- backup runbook чесно формулює, що backup не доведений без restore drill.

Ці сильні сторони — причина не переписувати систему з нуля. Потрібно довести до кінця transactional/security/operational boundaries і прибрати paths, які їх обходять.

---

## 11. Фінальний вердикт

**Архітектура має правильне ядро, але production guarantees зараз декларативні, а не наскрізні.** Найбільший ризик — не «впаде сайт», а **тиха логічна корупція виробничого стану**: картка, історія, склад, резерв і замовлення можуть розійтися після concurrency або partial failure, а UI все одно покаже success/refresh.

Тому професійний висновок: **46/100, NO-GO для широкого релізу.** Допустимий лише контрольований hotfix після закриття P0-01…P0-06 із перевіреним rollback. Після цього, але до RBAC/E2E/DR/observability, статус може бути лише **Conditional Go / limited pilot**, не Enterprise Production Grade.
