-- SQL скрипт для додавання колонки shift_calendar у таблицю system_users
-- Виконайте його в SQL Editor вашого кабінету Supabase

ALTER TABLE system_users 
ADD COLUMN IF NOT EXISTS shift_calendar JSONB DEFAULT '{}'::jsonb;

-- Опціонально: додаємо коментар для кращої документації БД
COMMENT ON COLUMN system_users.shift_calendar IS 'Календар змін та фактичних відміток роботи оператора цеху';
