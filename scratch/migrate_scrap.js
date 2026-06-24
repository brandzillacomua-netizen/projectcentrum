import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function migrate() {
  console.log('Starting migration...');

  // 1. Fetch categorized scrap from inventory
  const { data: invScrap, error: invErr } = await supabase.from('inventory').select('*').eq('warehouse', 'scrap');
  if (invErr) throw invErr;

  const categories = invScrap.filter(i => i.type.startsWith('scrap_cat_') || i.type === 'restoration');
  console.log(`Found ${categories.length} categorized inventory records.`);

  const nomCats = {};
  for (const cat of categories) {
    if (!nomCats[cat.nomenclature_id]) {
      nomCats[cat.nomenclature_id] = { cat1: 0, cat2: 0, cat3: 0, cat4: 0, restoration: 0 };
    }
    const numQty = Number(cat.total_qty) || 0;
    if (cat.type === 'scrap_cat_1') nomCats[cat.nomenclature_id].cat1 += numQty;
    if (cat.type === 'scrap_cat_2') nomCats[cat.nomenclature_id].cat2 += numQty;
    if (cat.type === 'scrap_cat_3') nomCats[cat.nomenclature_id].cat3 += numQty;
    if (cat.type === 'scrap_cat_4') nomCats[cat.nomenclature_id].cat4 += numQty;
    if (cat.type === 'restoration') nomCats[cat.nomenclature_id].restoration += numQty;
  }

  // 2. Fetch history records with scrap
  const { data: history, error: histErr } = await supabase.from('work_card_history').select('*').gt('scrap_qty', 0).order('created_at', { ascending: true });
  if (histErr) throw histErr;

  console.log(`Found ${history.length} work_card_history records with scrap.`);

  const updates = [];
  
  for (const row of history) {
    if (row.qc_scrap_comment && row.qc_scrap_comment.includes('SCRAP_CAT:')) continue;
    
    let remainingToAssign = Number(row.scrap_qty) || 0;
    const assigned = { cat1: 0, cat2: 0, cat3: 0, cat4: 0, restoration: 0 };
    const avail = nomCats[row.nomenclature_id];
    
    if (avail && remainingToAssign > 0) {
      const catKeys = ['cat1', 'cat2', 'cat3', 'cat4', 'restoration'];
      for (const k of catKeys) {
        if (avail[k] > 0 && remainingToAssign > 0) {
          const take = Math.min(avail[k], remainingToAssign);
          assigned[k] += take;
          avail[k] -= take;
          remainingToAssign -= take;
        }
      }
    }
    
    const sumAssigned = Object.values(assigned).reduce((a,b)=>a+b,0);
    if (sumAssigned > 0) {
      const jsonStr = `[SCRAP_CAT:${JSON.stringify(assigned)}]`;
      const newComment = row.qc_scrap_comment ? `${row.qc_scrap_comment} ${jsonStr}` : jsonStr;
      updates.push({ id: row.id, qc_scrap_comment: newComment });
    }
  }

  console.log(`Need to update ${updates.length} history records.`);

  // 3. Batch updates
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    await Promise.all(batch.map(u => supabase.from('work_card_history').update({ qc_scrap_comment: u.qc_scrap_comment }).eq('id', u.id)));
    console.log(`Updated ${Math.min(i + 100, updates.length)} / ${updates.length}`);
  }

  // 4. Delete old uncategorized scrap
  console.log('Deleting legacy scrap_new from inventory...');
  await supabase.from('inventory').delete().eq('type', 'scrap_new');
  
  console.log('Migration complete!');
}

migrate().catch(console.error);
