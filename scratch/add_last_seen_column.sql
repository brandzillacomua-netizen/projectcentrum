-- Run this SQL in the Supabase SQL Editor to add the last_seen column:
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
