-- Migration: Add work_card_comments table for Shop 1 card comment history
CREATE TABLE IF NOT EXISTS public.work_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id TEXT NOT NULL,
  task_id TEXT,
  order_id TEXT,
  author_id UUID,
  author_name TEXT NOT NULL,
  author_role TEXT,
  stage TEXT,
  machine TEXT,
  content TEXT NOT NULL,
  photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_card_comments_card_id ON public.work_card_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_work_card_comments_created_at ON public.work_card_comments(created_at DESC);

-- Enable RLS and grant permissions
ALTER TABLE public.work_card_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'work_card_comments' AND policyname = 'work_card_comments_select_all'
  ) THEN
    CREATE POLICY work_card_comments_select_all ON public.work_card_comments
      FOR SELECT TO authenticated, anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'work_card_comments' AND policyname = 'work_card_comments_insert_all'
  ) THEN
    CREATE POLICY work_card_comments_insert_all ON public.work_card_comments
      FOR INSERT TO authenticated, anon WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.work_card_comments TO authenticated, service_role, anon;

