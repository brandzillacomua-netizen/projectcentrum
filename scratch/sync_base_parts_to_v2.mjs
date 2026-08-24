import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const code = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8');
const urlMatch = code.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
const keyMatch = code.match(/eyJ[a-zA-Z0-9_\-\.]+/);

const supabase = createClient(urlMatch[0], keyMatch[0]);

async function run() {
  console.log('1. Deleting all incorrect items in Category 03 (cat_parts) from nomenclatures_v2...');
  const { error: delErr } = await supabase.from('nomenclatures_v2').delete().eq('group_id', 'cat_parts');
  if (delErr) {
    console.error('Error deleting cat_parts from nomenclatures_v2:', delErr);
  } else {
    console.log('✅ Deleted all old incorrect items from Category 03 in nomenclatures_v2!');
  }

  console.log('2. Fetching parts from original nomenclatures table (type = part)...');
  const { data: baseParts, error: fetchErr } = await supabase
    .from('nomenclatures')
    .select('*')
    .eq('type', 'part');

  if (fetchErr) {
    console.error('Error fetching base parts:', fetchErr);
  } else {
    console.log(`Found ${baseParts ? baseParts.length : 0} parts in original nomenclatures table.`);
  }

  // Also include the real parts extracted from CSV specs
  const csvParts = [
    { name: 'ІП-72-F5-В-3-45 Верхня пластина F5 3мм', unit: 'шт' },
    { name: 'ІП-72-F5-Н-3-50 Нижня пластина F5 3мм', unit: 'шт' },
    { name: 'ІП-72-F5-Х-5-63 Хрестик F5 2мм', unit: 'шт' },
    { name: 'ІП-72-F5-П-5-147 Промені F5 5мм', unit: 'шт' },
    { name: 'Накладка під АКБ F5 Гума', unit: 'шт' },
    { name: 'Тримач кабелю 10x45 Пластик', unit: 'шт' }
  ];

  const itemsToInsertMap = new Map();

  if (baseParts && baseParts.length > 0) {
    baseParts.forEach(p => {
      itemsToInsertMap.set(p.name.trim().toLowerCase(), {
        name: p.name.trim(),
        unit: p.unit || 'шт'
      });
    });
  }

  csvParts.forEach(p => {
    if (!itemsToInsertMap.has(p.name.trim().toLowerCase())) {
      itemsToInsertMap.set(p.name.trim().toLowerCase(), {
        name: p.name.trim(),
        unit: p.unit || 'шт'
      });
    }
  });

  const finalItems = Array.from(itemsToInsertMap.values());
  console.log(`3. Inserting ${finalItems.length} real details from BASE into nomenclatures_v2 (03. Деталі)...`);

  let codeCounter = 90701;
  const records = finalItems.map(item => ({
    code: 'V2-' + (codeCounter++),
    name: item.name,
    group_id: 'cat_parts',
    unit: item.unit || 'шт',
    rule_type: 'frame_part',
    rule_params: { customName: item.name },
    status: 'active'
  }));

  if (records.length > 0) {
    const { error: insErr } = await supabase.from('nomenclatures_v2').upsert(records, { onConflict: 'code' });
    if (insErr) {
      console.error('Error inserting real parts to nomenclatures_v2:', insErr.message);
    } else {
      console.log('✅ Successfully inserted real BASE details into nomenclatures_v2 under Category 03 (Деталі)!');
    }
  }

  // Double check current count of Category 03 in nomenclatures_v2
  const { data: cat3Data } = await supabase.from('nomenclatures_v2').select('*').eq('group_id', 'cat_parts');
  console.log(`Current items in 03. Деталі in nomenclatures_v2: ${cat3Data ? cat3Data.length : 0}`);
  if (cat3Data) {
    cat3Data.forEach(it => console.log(`- [${it.code}] ${it.name}`));
  }
}

run();
