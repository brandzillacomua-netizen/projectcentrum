alter table public.chat_threads
  add column if not exists avatar_url text,
  add column if not exists avatar_path text,
  add column if not exists avatar_type text,
  add column if not exists avatar_size integer;
