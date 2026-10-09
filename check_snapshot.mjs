import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  // Find nomenclature F415-421-ІП27-В-3-26
  const { data: nom } = await supabase.from('nomenclatures').select('*').ilike('code', '%90800%');
  console.log('Nomenclature:', nom);

  if (!nom || nom.length === 0) return;
  const nomId = nom[0].id;

  // Find task and plan_snapshot
  const { data: tasks } = await supabase.from('tasks').select('id, name, order_id, plan_snapshot').not('plan_snapshot', 'is', null);
  
  for (const t of tasks) {
    if (t.plan_snapshot && t.plan_snapshot[nomId]) {
      console.log(`Task ${t.id} (${t.name}):`, t.plan_snapshot[nomId]);
    }
  }
}

checkData();
