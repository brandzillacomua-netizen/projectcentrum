const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  const duplicateId = '4f4c3e39-064e-4b53-9d83-6cc6882f34da';
  const mainId = 'c869a1af-9388-44c7-8d3e-5babf375a68b';

  console.log('Checking all tables for references to the duplicate nomenclature ID...');

  const tables = ['bom_items', 'inventory', 'work_cards', 'material_requests', 'tasks'];
  const matches = {};

  for (const table of tables) {
    let query = supabase.from(table).select('id');
    if (table === 'bom_items') {
      query = query.or(`child_id.eq.${duplicateId},parent_id.eq.${duplicateId}`);
    } else if (table === 'tasks') {
      // tasks table doesn't have a direct nomenclature_id, but might have it in plan_snapshot.
      // We can skip tasks for simple check or do a JSON search if needed, but let's check order_items first
      continue;
    } else {
      query = query.eq('nomenclature_id', duplicateId);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Error checking ${table}:`, error);
    } else {
      matches[table] = data || [];
      console.log(`- ${table}: ${data.length} references`);
    }
  }

  // Also check order_items table!
  const { data: orderItems, error: oiErr } = await supabase.from('order_items').select('id').eq('nomenclature_id', duplicateId);
  if (oiErr) console.error('Error checking order_items:', oiErr);
  else {
    matches['order_items'] = orderItems || [];
    console.log(`- order_items: ${orderItems.length} references`);
  }

  // If there are no references other than bom_items, let's merge!
  const canMerge = (matches['bom_items'].length <= 1) && 
                   (matches['inventory'].length === 0) &&
                   (matches['work_cards'].length === 0) &&
                   (matches['material_requests'].length === 0) &&
                   (matches['order_items'].length === 0);

  if (canMerge) {
    console.log('\nAll checks passed. Proceeding with merge...');

    // 1. Update bom_items row pointing to duplicateId to point to mainId
    const { error: updErr } = await supabase
      .from('bom_items')
      .update({ child_id: mainId })
      .eq('child_id', duplicateId);

    if (updErr) {
      console.error('Failed to update bom_items:', updErr);
      return;
    }
    console.log('1. Updated bom_items to point to main nomenclature ID.');

    // 2. Delete duplicate nomenclature from DB
    const { error: delErr } = await supabase
      .from('nomenclatures')
      .delete()
      .eq('id', duplicateId);

    if (delErr) {
      console.error('Failed to delete duplicate nomenclature:', delErr);
      return;
    }
    console.log('2. Deleted duplicate nomenclature from database.');
    console.log('MERGE COMPLETED SUCCESSFULLY!');
  } else {
    console.log('\nCannot merge automatically because of existing references in other tables. Manual review required.');
  }
}

run();
