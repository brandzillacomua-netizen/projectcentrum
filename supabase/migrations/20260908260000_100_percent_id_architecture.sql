-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 ARCHITECTURAL MILESTONE: 100% ID-Based Relational Core & Magic String Purge
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Додати поле is_box_prepared boolean у work_cards (ліквідація [BOX_PREPARED:true])
-- 2. Додати поле customer_id UUID у orders (ліквідація текстового зв'язку замовник-замовлення)
-- 3. Автоматичний бекфіл історичних даних
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Додавання is_box_prepared у work_cards
ALTER TABLE public.work_cards 
  ADD COLUMN IF NOT EXISTS is_box_prepared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_work_cards_box_prepared 
  ON public.work_cards(is_box_prepared) 
  WHERE is_box_prepared = true;

-- Бекфіл прапорця готовності боксів з історичного рядка card_info
UPDATE public.work_cards
SET is_box_prepared = true
WHERE (card_info ILIKE '%[BOX_PREPARED:true]%' OR card_info ILIKE '%BOX_PREPARED%')
  AND is_box_prepared = false;

-- КРОК 2: Додавання customer_id у orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id 
  ON public.orders(customer_id);

-- Бекфіл customer_id для всіх замовлень за точним співпадінням імені клієнта
UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE o.customer_id IS NULL
  AND o.customer IS NOT NULL
  AND (
    trim(lower(o.customer)) = trim(lower(c.name))
    OR trim(lower(o.customer)) = trim(lower(COALESCE(c.company, '')))
    OR trim(lower(o.customer)) = trim(lower(COALESCE(c.official_name, '')))
  );

-- ПІДТВЕРДЖЕННЯ РЕЗУЛЬТАТІВ:
SELECT 
  COUNT(*) FILTER (WHERE is_box_prepared = true) AS cards_with_box_prepared,
  COUNT(*) FILTER (WHERE is_box_prepared = false) AS cards_without_box
FROM public.work_cards;

SELECT 
  COUNT(*) FILTER (WHERE customer_id IS NOT NULL) AS orders_with_customer_id,
  COUNT(*) FILTER (WHERE customer_id IS NULL) AS orders_without_customer_id
FROM public.orders;
