# CENTRUM MES — P0 Security Gate і дорожня карта Enterprise

Дата контрольної оцінки: 2026-09-12.

## Чесний статус

Після P0 кодова база оцінюється у **57/100** за enterprise-readiness. Це не сертифікація і не означає «готово до великого підприємства». P0 прибрав найбільш небезпечні способи компрометації, але не замінює E2E-тести, disaster recovery, спостережуваність, повну RLS-матрицю та контрольований release process.

## Що закрито в P0

- `.env` вилучено з Git; значення скомпрометованих секретів прибрано з поточного дерева, а старі діагностичні скрипти навмисно переведено у fail-closed стан.
- Вхід працює тільки через Supabase Auth JWT. Парольний RPC і довільний `p_admin_id` більше не є зовнішнім контуром довіри.
- Додано атомарну міграцію прив’язки `system_users.auth_user_id` до `auth.uid()` з abort-guard, якщо хоча б один профіль не зіставлено.
- Ключі Нової пошти й Telegram перенесено у server-side змінні. Створення/пошук/друк ТТН проходять через same-origin API, JWT, allow-list і rate limit.
- Core Engine працює fail-closed; анонімний shadow-доступ і фонове дублювання виробничих транзакцій вимкнено.
- Додано CSP, HSTS, clickjacking/MIME/referrer/permissions headers.
- Оновлено React Router, SheetJS, Vite та транзитивні пакети; production dependency audit: 0 відомих вразливостей.
- CI тепер блокує committed secrets, high-вразливості, помилки security-lint, некоректні міграції, провал тестів або збірки.
- Додано Dependabot і регресійні P0-тести.

## Перевірені acceptance criteria

- `npm run ci` — PASS.
- 21 test suites / 94 tests — PASS.
- Security lint — 0 errors, 0 warnings.
- Secret boundary — 2057 tracked files, PASS.
- Production dependency audit — 0 vulnerabilities.
- Production build — PASS.
- Production audit login → own profile → logout — PASS.
- Анонімний доступ до legacy password RPC — 401.
- Анонімний доступ до Nova Poshta, Telegram і PDF gateway — 401.

## Що ще не можна називати завершеним enterprise-рівнем

1. Старі секрети залишаються в Git history. Їх необхідно ротувати; переписування історії виконується окремо після координації з усіма клонами.
2. Немає підтвердженого offsite backup/restore drill з виміряними RPO/RTO.
3. Немає Playwright E2E для критичного виробничого циклу та контрактних тестів усіх RPC.
4. RLS не доведена до матриці «роль × дія × таблиця» для всіх виробничих таблиць; публічний QR-виклик верстата потребує окремого rate-limited gateway.
5. Немає staging promotion, canary rollout і автоматичного rollback за SLO.
6. Немає централізованих метрик, трасування та on-call alerting; Telegram не є заміною observability.
7. Основний JS chunk близько 780 kB, SheetJS близько 500 kB, QR scanner близько 335 kB; потрібне ліниве завантаження.

## P0.2 — підготовлено локально, ще не розгорнуто

Read-only перевірка production від 2026-09-12 виявила, що анонімний ключ бачить щонайменше один рядок у **35 із 55** клієнтських таблиць. Серед них були клієнти, чати, задачі, виробнича історія, push-підписки, брак і складські резерви. Тому P0.2 містить реальні зміни БД, а не лише опис матриці:

- публічний QR-виклик переведено на два мінімальні `SECURITY DEFINER` RPC;
- прямий `anon`-доступ до таблиць, колонок, sequence та інших функцій закривається глобально;
- права `authenticated` і `service_role` перед зміною знімаються у snapshot і відновлюються без зміни поведінки;
- старі анонімні RLS-політики видаляються або звужуються до `authenticated`;
- додано автоматичний read-only аудит `npm run audit:anon` та postcondition, що перериває lockdown-міграцію при залишковому grant;
- персональний виклик отримує відсутні у production колонки, серверну валідацію, дедуплікацію та rate limit.

Цей приріст не включено в оцінку, доки не виконані двофазне розгортання і повторний production-аудит із результатом **0 exposed tables**.

## Безпечний порядок production-релізу P0

1. Оголосити коротке вікно тільки для адміністративних змін користувачів; виробничі картки не зупиняти.
2. Зробити point-in-time backup і перевірити можливість відновлення на окремому staging-проєкті.
3. Додати server-side variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NOVA_POSHTA_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `APP_ORIGIN`.
4. У staging виконати міграцію. Abort через незв’язаний профіль означає «не продовжувати», а не обходити guard.
5. Перевірити login кожної класової ролі, admin CRUD користувача, presence, read-only NP probe і Telegram test.
6. Виконати production migration, потім одразу frontend/serverless deploy. Не міняти цей порядок.
7. Провести smoke: login, відкриття активного наряду, операція на тестовій картці, звіт, склад, ТТН без збереження, logout.
8. 30 хвилин контролювати 401/403/5xx, latency RPC і помилки Realtime. При перевищенні порога — rollback frontend; БД-міграцію не відкочувати до caller-controlled auth.
9. Ротувати MES secret, audit password, Nova Poshta token і Telegram token. Після ротації повторити secret scan та інтеграційні probes.

## Наступні етапи до 100/100

| Пріоритет | Етап | Приріст | Ризик впровадження | Обов’язковий запобіжник |
|---|---|---:|---|---|
| P0.1 | Ротація секретів, очищення Git history, branch protection | +5 | Високий | inventory усіх consumers, dual-key window, перевірка кожного інтеграційного каналу |
| P0.2 | Повна RLS/RBAC-матриця та gateway для public QR machine calls | +8 | Високий | shadow audit logs, role-by-role contract tests, поетапне deny |
| P1 | Playwright E2E критичного маршруту цеху й API/RPC contract tests | +8 | Середній | ізольований staging dataset, idempotency fixtures |
| P1 | Sentry/metrics/tracing, SLO та on-call runbooks | +5 | Низький | маскування PII, sampling, test alerts |
| P1 | Offsite encrypted backups і quarterly restore drill | +6 | Середній | immutable bucket, checksum, documented RPO/RTO |
| P2 | Staging promotion, canary, feature flags, automated rollback | +5 | Середній | 5–10% canary, error-budget gates |
| P2 | Lazy loading scanner/SheetJS, query budgets, WebSocket scoping | +3 | Низький | bundle budgets і performance regression tests |
| P2 | HA/DR topology, capacity/load tests, dependency/SBOM governance | +3 | Високий | failure drills, signed artifacts, rollback rehearsal |

Ціль **100/100** досягається лише після документально підтверджених restore/failover drills, повного role-based security test matrix та кількох стабільних canary-релізів. Сам факт наявності коду або міграції балів не додає без доказу експлуатаційної готовності.
