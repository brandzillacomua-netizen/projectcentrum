import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const code = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8');
const urlMatch = code.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
const keyMatch = code.match(/eyJ[a-zA-Z0-9_\-\.]+/);

const supabase = createClient(urlMatch[0], keyMatch[0]);

async function run() {
  const { data: fgItems } = await supabase
    .from('nomenclatures_v2')
    .select('*')
    .or('group_id.eq.cat_fg,group_id.eq.grp_test_samples');

  if (!fgItems) return;

  let movedCount = 0;
  for (const item of fgItems) {
    const name = item.name.toLowerCase();
    const isTestSample = name.includes('тестовий зразок') || name.includes('тестові') || name.includes('неактуальн') || name.includes('не актуальн');

    const targetGroupId = isTestSample ? 'grp_test_samples' : 'cat_fg';

    if (item.group_id !== targetGroupId) {
      await supabase
        .from('nomenclatures_v2')
        .update({ group_id: targetGroupId })
        .eq('id', item.id);
      movedCount++;
    }
  }

  console.log(`✅ Successfully updated ${movedCount} items!`);

  const { data: testFolderItems } = await supabase.from('nomenclatures_v2').select('*').eq('group_id', 'grp_test_samples');
  console.log(`Current items in 📁 Тестові зразки: ${testFolderItems ? testFolderItems.length : 0}`);
}

run();
