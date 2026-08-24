import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const code = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8');
const urlMatch = code.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
const keyMatch = code.match(/eyJ[a-zA-Z0-9_\-\.]+/);

const supabase = createClient(urlMatch[0], keyMatch[0]);

async function run() {
  const { data: catFgItems } = await supabase
    .from('nomenclatures_v2')
    .select('*')
    .eq('group_id', 'cat_fg');

  if (!catFgItems || catFgItems.length === 0) {
    console.log('No items currently under root cat_fg.');
    return;
  }

  console.log(`Moving ${catFgItems.length} serial items from cat_fg to grp_production_frames...`);

  for (const item of catFgItems) {
    await supabase
      .from('nomenclatures_v2')
      .update({ group_id: 'grp_production_frames' })
      .eq('id', item.id);
  }

  console.log('✅ Successfully moved all serial items to 📁 Продакшн!');

  const { data: prodItems } = await supabase.from('nomenclatures_v2').select('*').eq('group_id', 'grp_production_frames');
  const { data: testItems } = await supabase.from('nomenclatures_v2').select('*').eq('group_id', 'grp_test_samples');

  console.log(`Current items in 📁 Продакшн: ${prodItems ? prodItems.length : 0}`);
  console.log(`Current items in 📁 Тестові зразки: ${testItems ? testItems.length : 0}`);
}

run();
