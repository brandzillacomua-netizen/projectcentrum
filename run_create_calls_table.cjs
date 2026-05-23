const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sql = `
-- 1. Create machine_calls table
CREATE TABLE IF NOT EXISTS machine_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
  called_role TEXT NOT NULL, -- 'master', 'engineer', 'qc'
  operator_name TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved'
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

-- Enable RLS
ALTER TABLE machine_calls ENABLE ROW LEVEL SECURITY;

-- Drop policies if exist
DROP POLICY IF EXISTS "Allow public read and write" ON machine_calls;
DROP POLICY IF EXISTS "Allow anon read and write" ON machine_calls;

-- Create policy
CREATE POLICY "Allow public read and write" ON machine_calls
  FOR ALL TO public USING (true) WITH CHECK (true);
`;

async function run() {
  console.log('Running SQL query via RPC exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql: sql });
  if (error) {
    console.error('SQL Execution Error:', error);
  } else {
    console.log('SQL Execution Success:', data);
  }
}

run();
