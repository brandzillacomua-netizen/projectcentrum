# Wave C1 — RBAC для довідників

Дата підготовки: 2026-09-12. Статус: **застосовано; production postcondition PASS**.

## Підтверджений стан до змін

- `system_configs`, `scrap_reasons`, `vkya_restoration_stages` існують і мають увімкнений RLS.
- Будь-який `authenticated` користувач має `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES`.
- Чинні write-policy дозволяють операції через вираз `true`.
- Право `brak` мають 6 користувачів.
- Право `settings` мають 22 користувачі; ще 2 профілі відповідають admin-fallback інтерфейсу.
- `nomenclature_prices` у production не існує і виключена з хвилі.

## Цільовий стан

| Таблиця | Читання | Створення/зміна | Видалення | Інші table privileges |
|---|---|---|---|---|
| `system_configs` | Усі авторизовані | `settings` або дозволений admin-fallback | Заборонено | Заборонено |
| `scrap_reasons` | Усі авторизовані | Тільки `brak` | Тільки `brak` | Заборонено |
| `vkya_restoration_stages` | Усі авторизовані | Тільки `brak` | Тільки `brak` | Заборонено |

Production postcondition після застосування:

- `status`: `PASS`;
- `grant_differences`: 0;
- `policy_differences`: 0;
- `unsafe_write_policies`: 0;
- `tables_without_rls`: 0;
- `target_tables_found`: 3.

## Порядок застосування

1. Застосувати `supabase/migrations/20260912200000_wave_c_catalog_rbac.sql` у Supabase SQL Editor одним запуском.
2. Якщо міграція повернула помилку, нічого повторно не запускати: транзакція автоматично скасує всі її зміни.
3. Після успіху виконати `supabase/diagnostics/wave_c_catalogs_postcondition.sql`.
4. Приймати результат лише якщо `status = PASS`, усі лічильники порушень дорівнюють нулю, `target_tables_found = 3`.
5. Перевірити в інтерфейсі завантаження причин браку та етапів відновлення звичайним виробничим користувачем.
6. Перевірити редагування довідників користувачем із правом `brak` та системного прапорця користувачем із правом `settings` під час контрольованого вікна.

## Rollback

Файл `supabase/rollbacks/20260912200000_wave_c_catalog_rbac_rollback.sql` відновлює grants і policies, зафіксовані production preflight.

Rollback виконується тільки якщо після успішної postcondition:

- авторизований користувач не може прочитати один із трьох довідників;
- користувач із підтвердженим `brak` не може керувати довідниками ВКЯ;
- користувач із підтвердженим `settings` не може зберегти системне налаштування;
- у журналах з'явилися повторювані помилки RLS для цих таблиць.

Не застосовувати rollback через відмову запису користувачу без відповідного права — це очікувана робота RBAC.
