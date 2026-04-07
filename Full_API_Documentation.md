# Повна документація REST API проєкту

Ця документація описує всі наявні модулі та кінцеві точки (ендпоінти) API системи.

## Загальна інформація
- **Базовий шлях:** Усі запити мають префікс `/api` (наприклад, `/api/auth/login`).
- **Авторизація:** Усі закриті маршрути вимагають заголовок з JWT-токеном: 
  `Authorization: Bearer <ваш_токен>`.
- **Формат даних:** Система очікує і повертає дані у форматі `application/json`.
- **Пагінація:** Спискові (List) запити можуть приймати Query-параметри `page` та `per_page` (наприклад: `?page=1&per_page=20`).

---

## 1. Auth (Авторизація)
| Метод  | Маршрут            | Опис                                         | JSON Тіло запиту / Тіло відповіді |
|--------|--------------------|----------------------------------------------|--------------------------------|
| `POST` | `/api/auth/login`  | Логін в систему та отримання токена          | `{"email": "...", "password": "..."}` -> Повертає `{"token": "..."}` |
| `GET`  | `/api/auth/me`     | Отримати дані поточного користувача          | Не вимагає тіла. Повертає об'єкт користувача з масивом його ролей. |
| `POST` | `/api/auth/refresh`| Оновлення сесії (Refresh token)              | - |

---

## 2. Users (Користувачі)
Керування працівниками та доступами.

| Метод   | Маршрут                        | Опис                                      | Тіло запиту (Request Body) |
|---------|--------------------------------|-------------------------------------------|-----------------------------|
| `GET`   | `/api/users`                   | Список користувачів (з пагінацією)          | - |
| `POST`  | `/api/users`                   | Створення нового користувача              | `{"full_name": "..", "email": "..", "password": "..", "department": ".."}` |
| `GET`   | `/api/users/:id`               | Дані конкретного користувача              | - |
| `PATCH` | `/api/users/:id/deactivate`    | Деактивувати користувача                  | - |
| `GET`   | `/api/users/:id/roles`         | Список призначених ролей                  | - |
| `PUT`   | `/api/users/:id/roles`         | Встановити список ролей (повна заміна)    | `{"role_ids": ["uuid", "uuid"]}` |

---

## 3. RBAC (Ролі та Права)
| Метод   | Маршрут                                | Опис                                      | Тіло запиту (Request Body) |
|---------|----------------------------------------|-------------------------------------------|-----------------------------|
| `GET`   | `/api/rbac/roles`                      | Список усіх ролей                         | - |
| `POST`  | `/api/rbac/roles`                      | Створити нову роль                        | `{"code": "..", "name": "..", "description": ".."}` |
| `GET`   | `/api/rbac/roles/:id`                  | Деталі ролі + масив `permissions`         | - |
| `PUT`   | `/api/rbac/roles/:id`                  | Оновити дані ролі (ім'я/опис)             | `{"name": "..", "description": ".."}` |
| `DELETE`| `/api/rbac/roles/:id`                  | Видалити роль (лише ті де `is_system=false`)  | - |
| `GET`   | `/api/rbac/permissions`                | Список усіх доступних прав у системі      | - |
| `PUT`   | `/api/rbac/roles/:id/permissions`      | Перезаписати права для визначеної ролі    | `{"permission_ids": ["uuid", "uuid"]}` |

---

## 4. Nomenclature (Номенклатура та Довідники)
Гнучка система ведення матеріалів, товарів, та характеристик.

| Метод   | Маршрут                               | Опис                                                | Приклад тіла запиту |
|---------|---------------------------------------|-----------------------------------------------------|---------------------|
| `GET`   | `/api/nomenclature/groups`            | Дерево або список груп номенклатури                | - |
| `POST`  | `/api/nomenclature/groups`            | Створити групу                                     | `{"code": "..", "name": "..", "parent_id": null}` |
| `GET`   | `/api/nomenclature/types`             | Список типів номенклатури (сировина, тощо)         | - |
| `POST`  | `/api/nomenclature/types`             | Створити тип                                       | `{"name": "..", "description": ".."}` |
| `DELETE`| `/api/nomenclature/types/:id`         | Видалити тип                                       | - |
| `GET`   | `/api/nomenclature`                   | Загальний список базових номенклатур (пошук)      | - |
| `POST`  | `/api/nomenclature`                   | Створити базову номенклатуру                       | `{"base_code": 123, "name": "..", "group_id": "..", "unit_of_measure": ".."}` |
| `GET`   | `/api/nomenclature/search`            | Повнотекстовий пошук                              | `?q=searchterm` |
| `GET`   | `/api/nomenclature/:id`               | Отримати дані бази + всі характеристики            | - |
| `DELETE`| `/api/nomenclature/:id`               | Видалити (якщо не використовується)                | - |
| `PATCH` | `/api/nomenclature/:id/deactivate`    | Деактивувати базову номенклатуру                   | - |
| `PATCH` | `/api/nomenclature/:id/activate`      | Активувати базову номенклатуру                     | - |

### 4.1. Характеристики та Атрибути (EAV)
Кожна "Базова номенклатура" розширюється характеристиками (різні розміри, кольори, габарити).
| Метод   | Маршрут                                      | Опис                                          | Тіло запиту |
|---------|----------------------------------------------|-----------------------------------------------|-------------|
| `GET`   | `/api/nomenclature/:id/characteristics`      | Список характеристик базової номенклатури      | - |
| `POST`  | `/api/nomenclature/:id/characteristics`      | Додати характеристику                         | `{"full_code": "..", "name": "..", "nom_type": "material", "can_be_produced": true}` |
| `GET`   | `/api/characteristics/:id`                   | Деталі конкретної характеристики              | - |
| `PATCH` | `/api/characteristics/:id`                   | Редагування характеристики                    | `{"name": "..", "is_active": true}` |
| `PATCH` | `/api/characteristics/:id/deactivate`        | Відключити характеристику                     | - |
| `GET`   | `/api/characteristics/:id/attributes`        | Динамічні EAV-атрибути для цієї х-ки          | - |
| `PUT`   | `/api/characteristics/:id/attributes`        | Оновити/Додати (Upsert) атрибут (колір, вага)| `{"key": "weight", "value": "10", "unit": "kg"}` |
| `DELETE`| `/api/characteristics/:id/attributes?key=X`  | Видалити атрибут за його `key`                | - |

---

## 5. Counterparties (Контрагенти)
Постачальники та клієнти.

| Метод  | Маршрут                               | Опис                                      | Структура JSON |
|--------|---------------------------------------|-------------------------------------------|----------------|
| `GET`  | `/api/counterparties`                 | Список контрагентів                       | - |
| `POST` | `/api/counterparties`                 | Створити контрагента                      | `{"code": "..", "name": "..", "counterparty_type": "supplier|customer", "tax_code": "..", ...}` |
| `GET`  | `/api/counterparties/search`          | Пошук за назвою або кодом                 | `?q=...` |
| `GET`  | `/api/counterparties/:id`             | Деталі                                    | - |
| `PUT`  | `/api/counterparties/:id`             | Оновлення інформації                      | (Подібний до POST) |
| `POST` | `/api/counterparties/:id/contacts`    | Додати контактну особу або номер          | `{"name": "..", "phone": ".."}` |

---

## 6. Warehouses & Stock (Склади та Рух Товару)

### 6.1. Складові одиниці та комірки (Warehouses)
| Метод   | Маршрут                               | Опис                                  | Тіло запиту |
|---------|---------------------------------------|---------------------------------------|-------------|
| `GET`   | `/api/warehouses`                     | Список складів                        | - |
| `POST`  | `/api/warehouses`                     | Створити склад (`main`, `defect`, ітд)| `{"code": "..", "name": "..", "warehouse_type": "main"}` |
| `GET`   | `/api/warehouses/:id`                 | Деталі                                | - |
| `PATCH` | `/api/warehouses/:id/deactivate`      | Деактивувати склад                    | - |
| `GET`   | `/api/warehouses/:id/locations`       | Список місць зберігання (комірок)     | - |
| `POST`  | `/api/warehouses/:id/locations`       | Створити комірку                      | `{"code": "..", "name": ".."}` |

### 6.2. Документи та Залишки (Stock Documents & Balances)
| Метод   | Маршрут                               | Опис                                                   | Тіло запиту |
|---------|---------------------------------------|--------------------------------------------------------|-------------|
| `GET`   | `/api/stock/documents`                | Список накладних/актів                                 | - |
| `POST`  | `/api/stock/documents`                | Створити чернетку (Draft) документа                    | `{"doc_type": "receipt", "warehouse_id": "..", "lines": [...]}` |
| `GET`   | `/api/stock/documents/:id`            | Перегляд документа                                     | - |
| `PATCH` | `/api/stock/documents/:id/confirm`    | Провести документ (рухає залишки на складі)            | - |
| `PATCH` | `/api/stock/documents/:id/cancel`     | Скасувати документ                                     | - |
| `GET`   | `/api/stock/balances`                 | Звіт: загальні залишки по складах                      | `?warehouse_id=...` |
| `GET`   | `/api/stock/balances/:wh/:ch`         | Залишок конкретної `characteristic` на складі `:wh`    | - |
| `GET`   | `/api/stock/movements`                | Звіт: історія руху для картки товару                   | `?characteristic_id=...` |

### 6.3. Purchase Orders (Замовлення постачальнику)
| Метод   | Маршрут                               | Опис                                  | Тіло запиту |
|---------|---------------------------------------|---------------------------------------|-------------|
| `GET`   | `/api/purchase-orders`                | Список замовлень                      | - |
| `POST`  | `/api/purchase-orders`                | Створити нове замовлення              | `{"supplier_id": "..", "planned_date": "..", "lines": [...]}` |
| `GET`   | `/api/purchase-orders/:id`            | Деталі                                | - |
| `PATCH` | `/api/purchase-orders/:id/confirm`    | Затвердити до закупівлі               | - |
| `PATCH` | `/api/purchase-orders/:id/cancel`     | Відмінити                             | - |

---

## 7. Production (Виробництво)

### 7.1. Виробничі наряди (Production Orders)
| Метод   | Маршрут                                      | Опис                                  | Тіло запиту |
|---------|----------------------------------------------|---------------------------------------|-------------|
| `GET`   | `/api/production-orders`                     | Список нарядів на виробництво         | - |
| `POST`  | `/api/production-orders`                     | Створити наряд                        | `{"order_id": "..", "equipment_id": "..", "bom_header_id": ".."}` |
| `GET`   | `/api/production-orders/:id`                 | Інформація про наряд                  | - |
| `PATCH` | `/api/production-orders/:id/approve`         | Підтвердити старт виробництва         | - |
| `POST`  | `/api/production-orders/:id/generate-cards`  | Згенерувати робочі карти (Work Cards) | - |
| `PATCH` | `/api/production-orders/:id/cancel`          | Скасувати наряд                       | - |

### 7.2. Work cards (Робочі Карти / Операції)
Кожен наряд розбивається на карти, які містять QR-коди і скануються операторами на цеху.
| Метод   | Маршрут                               | Опис                                  |
|---------|---------------------------------------|---------------------------------------|
| `GET`   | `/api/work-cards/qr/:qr_code`         | Знайти карту за сканованим QR-кодом   |
| `PATCH` | `/api/work-cards/:id/start`           | Взяти в роботу (Оператор почав)       |
| `PATCH` | `/api/work-cards/:id/complete`        | Завершити цикл виробництва за картою  |
