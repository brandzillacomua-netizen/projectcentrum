const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Each index in its own statement for safe execution
const indexes = [
  // system_users
  `CREATE INDEX IF NOT EXISTS idx_system_users_login ON system_users(login)`,
  // tasks
  `CREATE INDEX IF NOT EXISTS idx_tasks_order_id ON tasks(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at DESC NULLS LAST)`,
  // work_cards
  `CREATE INDEX IF NOT EXISTS idx_work_cards_task_id ON work_cards(task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_work_cards_status ON work_cards(status)`,
  `CREATE INDEX IF NOT EXISTS idx_work_cards_status_created ON work_cards(status, created_at ASC)`,
  // material_requests
  `CREATE INDEX IF NOT EXISTS idx_material_requests_task_id ON material_requests(task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_material_requests_order_id ON material_requests(order_id)`,
  // inventory
  `CREATE INDEX IF NOT EXISTS idx_inventory_nomenclature_id ON inventory(nomenclature_id)`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse)`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory(type)`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_nom_type ON inventory(nomenclature_id, type)`,
  // orders
  `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
  // reception_docs
  `CREATE INDEX IF NOT EXISTS idx_reception_docs_status ON reception_docs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_reception_docs_task_id ON reception_docs(task_id)`,
  // purchase_requests
  `CREATE INDEX IF NOT EXISTS idx_purchase_requests_task_id ON purchase_requests(task_id)`,
  `CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_purchase_requests_dest_warehouse ON purchase_requests(destination_warehouse)`,
  // work_card_history
  `CREATE INDEX IF NOT EXISTS idx_work_card_history_completed_at ON work_card_history(completed_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_work_card_history_card_id ON work_card_history(card_id)`,
  // management_tasks
  `CREATE INDEX IF NOT EXISTS idx_management_tasks_status ON management_tasks(status)`,
];

async function applyIndexes() {
  console.log(`🚀 Applying ${indexes.length} performance indexes to Supabase...\n`);
  let ok = 0;
  let fail = 0;

  for (const sql of indexes) {
    const name = sql.match(/idx_[\w]+/)?.[0] || sql.slice(0, 60);
    const { error } = await supabase.rpc('exec_sql', { sql: sql + ';' });
    if (error) {
      console.error(`  ❌ FAIL — ${name}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✅ OK   — ${name}`);
      ok++;
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`Done: ${ok} success, ${fail} failed`);
  if (fail === 0) {
    console.log('🎉 All indexes applied successfully!');
  } else {
    console.log('⚠️  Some indexes failed. Check output above.');
  }
}

applyIndexes();
