# Цех №1 — аудит коду та безпечний Phase 0/1

Дата: 2026-09-09. Репозиторій: A:\centrum. HEAD: 3ec44eaf79574b7930c51f7511314757192049b3.
Початковий локальний diff: змінений dist/index.html; його не чіпати.
Це аудит локального коду, не підтвердження версії розгорнутого production або стану БД. Старий Rust-проєкт A:\centrum-digital-core-stable не є поточним шляхом API: src/services/apiDispatcher.js використовує Supabase та передані JS-функції.

## Карта поточного коду

Шляхи нижче відносні до A:\centrum; номери рядків зафіксовані до змін.

| Етап | Реальна точка | Залежності / поведінка |
|---|---|---|
| Активні екрани | src/App.jsx:875,880 | /foreman та /foreman2 → Foreman2Module; /shop1 → Shop1Terminal |
| Створити / друкувати наряд | src/modules/Foreman2/features/create-naryad/CreateNaryadModal.jsx:248 | викликає createNaryad |
| Наряд і потреба листів | src/contexts/production/productionCards.js:867,1359,1410 | tasks, plan_snapshot.materialSummary, material_requests категорії sheet; task і запити створюються окремими записами |
| Резервування | src/contexts/useWarehouse.js:507,549,694,750,760 | inventory.reserved_qty та material_requests.status=issued; пакетна видача допускає часткову кількість |
| Три погодження | src/contexts/production/productionHandovers.js:11,15,19 | tasks.warehouse_conf (text), engineer_conf, director_conf (boolean) |
| Доступність генерації | src/modules/Foreman2/features/task-loading/taskSelectors.js:19; features/card-generation/useCardGeneration.js:28 | склад true АБО partial + інженер + директор; перевірка в клієнті |
| Генерація пакетів | src/modules/Foreman2/features/card-generation/useCardGeneration.js:188 → src/services/apiDispatcher.js:74 → src/contexts/production/productionCards.js:63 | insert work_cards; спільна функція не перевіряє погодження |
| Генерація одиночної карти | src/contexts/production/productionCards.js:29 | інший прямий insert; також немає перевірки трьох погоджень |
| Запити фрез | src/modules/Foreman2/features/card-generation/useCardGeneration.js:193,208 → src/contexts/production/productionOrders.js:897 | консолідований запит пакета; card_id=null; режим cutters_only або both; резервування через useWarehouse |
| Завершення розкрою | src/modules/Shop1/hooks/useShop1TerminalState.js:200 → subhooks/useShop1CardWorkflow.js:862 | handleCompleteToBuffer; умовне оновлення in-progress → at-buffer |
| Списання листів / фрез | той самий useShop1CardWorkflow.js:98,240,1010 | дві окремі функції; atomicInventoryService + наступні оновлення material_requests |
| Повний брак | той самий useShop1CardWorkflow.js:1194,1207 | додатковий шлях списання під час розкрою |
| Інший шлях підтвердження | src/contexts/production/productionCards.js:315,581,714 | confirmBuffer має окрему реалізацію списання; необхідно врахувати при майбутньому перемиканні |
| Подальший маршрут | useShop1CardWorkflow.js:1238,1397,1475 | буфер, сортування, at-shop2-buffer; рух напівфабрикатів слід відрізняти від листів/фрез |
| Перерахунок резервів | supabase/migrations/20260818190000_auto_reconcile_inventory_reserve.sql:4 | trigger material_requests → SUM(quantity WHERE issued) → inventory.reserved_qty |

Старі useShop1Actions.js та Foreman/hooks/useForemanHandlers.js також містять складські алгоритми. Їх наявність не доводить використання активним маршрутом; не слід виправляти лише старий файл і вважати проблему вирішеною.

## Точні ризики перед зміною поведінки

1. **Весь резерв на останній згенерованій карті.** useShop1CardWorkflow.js:128–135 визначає isLastCard за клієнтським списком наявних карт. Рядки 207–225 вивільняють весь taskReservedForSheet та обнуляють запити. Наступні ще не створені пакети не враховані. Аналог у productionCards.js:487–611. Це кодовий механізм, що пояснює 15→0 резерву при списанні 3 листів; факт конкретного production-інциденту потребує журналу БД.
2. **Чужі резерви / матеріали.** Workflow:160 бере перший inventory_id із запитів листів, :199 допускає перший лист складу; :204 підсумовує всі листові запити задачі. :208 за відсутності task reserve бере curReserved усього складського рядка. Фрези :398–418 мають аналогічне вивільнення. Потрібні явні ID матеріалу та розподіл резерву на карту.
3. **Позначка списання до списання.** Workflow:905–924 записує tags SHEETS_DEDUCTED/CUTTERS_DEDUCTED та at-buffer; лише :1009–1016 виконує складські зміни. Частковий збій може залишити карту з неправдивою позначкою. Повторна спроба може бути пропущена.
4. **Атомарна назва не означає атомарний бізнес-процес.** src/services/atomicInventoryService.js:10 викликає RPC тільки для stock row, а на RPC-помилку переходить до read-modify-write. Повертає success:false замість throw; виклики Workflow:214 та :406 результат не перевіряють. Карта, запити і history поза єдиною транзакцією.
5. **Два власники reserved_qty.** useWarehouse та списання змінюють reserve вручну, а тригер 20260818190000 перераховує його зі статусів запитів. Додавати новий ledger як ще одного writer до перевірки deployed trigger небезпечно.
6. **Повторний запит листів при генерації.** Активний useCardGeneration.js:203–210 шукає незавершений листовий запит у mes.requests; відсутність переводить режим у both. Це особливо ризиковано після передчасного обнулення попереднього резерву або неповного клієнтського кешу.
7. **Gateway не доведений на сервері.** Активний клієнт приймає partial; спільні createWorkCard/createWorkCardsBatch не перевіряють погодження. Локальний пошук міграцій не підтвердив потрібного insert-trigger. Без каталогу production не можна стверджувати відсутність серверного захисту. Цільовий контракт потребує трьох повних погоджень під серверним блокуванням перед insert будь-якого пакета.
8. **Небезпечна стара міграція.** supabase/migrations/20260908150000_cleanup_orphan_warehouse_reserves.sql:8–11 робить UPDATE inventory SET reserved_qty=0 WHERE reserved_qty>0 без обмеження orphan. Не запускати загальний migration push у рамках Phase 1. Факт її застосування не перевірений.
9. **Неповний наряд / пакет після помилки.** Наряд і material requests — окремі записи; карти вставляються до запитів фрез, а useCardGeneration.js:211 ловить помилку запиту без відкату карт. Потрібна транзакційна межа в наступній фазі.

## Мінімальні доповнення Phase 1

Додані чотири автономні модулі src/domain/shop1Inventory/*.mjs і scripts/check-shop1-phase01.mjs. Вони не імпортуються робочими екранами, не мають доступу до мережі/БД і не змінюють поточні операції.

- flags: shadow=false і чотири v2=false; спроба ввімкнути live v2 відхиляється, оскільки writer ще не реалізований. Це заготовка конфігурації, не розгорнута система керування production.
- approvalGateway: розрахунковий контракт трьох повних погоджень; partial відхиляється. Він поки не є захистом активної генерації.
- cuttingPlan: чистий розрахунок за явними ID та цілими кількостями. Листи зменшують physical і task reserve рівно на card.sheetQty. Фрези зменшують physical на actual, reserve на allocation цієї карти; різниця стає вільною. Подальші етапи відхиляються. Немає isLastCard.
- shadow: за замовчуванням повертає null; при явному ввімкненні рахує переданий snapshot без записів.

Нормалізований snapshot навмисно не виводиться з неоднозначного card_info. Перевищення факту фрез над allocation відхиляється до явного додаткового розподілу. Event key є лише пропозицією: без унікального запису в БД він не гарантує exactly-once. Модулі не здійснюють реального резервування і не виправляють чинний production-баг.

## Верифікація та межі

Запустити node scripts/check-shop1-phase01.mjs. Перевірки: усі комбінації погоджень, partial, вимкнені прапорці, 15−3=12, наступний пакет, чужий резерв, факт фрез 1 із 2, нульове використання, недостатній резерв, некоректні кількості, чужа карта, повторна фіналізація, подальші етапи, незмінність входу.

БД, міграції, deployment не запускались. UI-файли та production imports не змінюються; тому збірка UI не потрібна для цього непідключеного модуля. Конкурентність, RLS, атомарність і відновлення після мережевого збою цими чистими перевірками не доведені.

## Rollback

Для цього Phase 1: залишити всі прапорці false; видалити лише нові чотири файли, скрипт та цей аудит або відкотити окремий commit доповнень. Відновлення БД не потрібне — записів немає. Не відкотити сторонню зміну dist/index.html.

Після майбутнього live cutover одного вимкнення прапорця недостатньо: не можна відправляти вже мігровані карти старому writer. Потрібні версія обліку на наряді/карті, зупинка нових операцій для affected cohort, перевірка ledger і завершення/компенсація лише за журналом. Старий writer дозволений тільки для немігрованих нарядів.

## Перед наступною фазою

1. Підтвердити production commit та прочитати каталог БД: applied migrations, functions, triggers, RLS/policies, constraints, типи ID. Без міграцій і виправлень залишків.
2. Звірити 15→3 на конкретному наряді: усі його запити, всі картки, історія та відповідні stock rows. Окремо перевірити інші резерви того самого inventory_id.
3. Узгодити один authoritative writer; підготувати additive таблиці reservations, card allocations і immutable consumption ledger з унікальністю card/event та повним відображенням legacy requests. Не backfill автоматично з неоднозначних даних.
4. Єдина серверна транзакція завершення розкрою: авторизація → locks у сталому порядку → stage/version/idempotency → перевірка allocation → stock + reserve + unused release + ledger + history + at-buffer. При будь-якому збої rollback усієї операції; без клієнтського fallback.
5. Серверний gateway трьох погоджень для всіх insert карт; серверна ідемпотентність наряду та його sheet requests. Визначити окремий контракт довипуску/заміни матеріалу без повторного резерву звичайного пакета.
6. Перевірити конкурентне завершення двох карт, повтор запиту після timeout, збій кожного запису, два матеріали одного наряду, залишок під ще не згенерований пакет, 0/часткові/надпланові фрези, брак і подальшу маршрутизацію. Лише потім обговорювати ввімкнення для нових нарядів.
