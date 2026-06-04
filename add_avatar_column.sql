-- Run this SQL in the Supabase SQL Editor to add the avatar column natively:
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS avatar TEXT;
