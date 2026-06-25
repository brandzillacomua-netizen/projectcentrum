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

// Mapping of nomenclature IDs and their target total_qty values for type = 'bz'
const updates = [
  { id: '076ba504-b3f6-4ec8-8844-fe9515077d9c', name: 'KR-Line-210-415-В-3-28', qty: 0 },
  { id: '447e35fd-0139-4fc2-9bf3-dc445014cf8f', name: 'KR-Line-235-415-Н-3-24', qty: 68 },
  { id: 'bea6dd03-b66a-495f-bcdc-33ed8040d054', name: 'RND-107-KR-325-Хв-5-54', qty: 0 },
  { id: '6f542ceb-281b-4805-94f8-992ee530a80d', name: 'RND-107-KR-325-Хн-5-54', qty: 0 },
  { id: '2d0fb65f-68e3-43d9-94d0-3073f68b8fda', name: 'KR-325-К-4-6', qty: 96 },
  { id: '3222d4f9-4275-4d91-af58-728dba0b13ef', name: 'KR-325-П-10-31', qty: 106 },
  { id: 'c869a1af-9388-44c7-8d3e-5babf375a68b', name: 'KF-Пластинка-3-162', qty: 0 },
  { id: '593efd08-86b4-4c60-8789-eb6c87e1e915', name: 'KR-F-line-Підкладка-10-238', qty: 0 },
  { id: '374cd1ce-dac7-4d26-b1af-8336bc7351e1', name: 'KR-210-415-В-широкий-3-8', qty: 81 }
];

async function run() {
  console.log('Starting BZ inventory updates...');
  
  for (const item of updates) {
    console.log(`\nUpdating ${item.name} (ID: ${item.id}) to Qty: ${item.qty}...`);
    
    // First, check if the record exists for type = 'bz'
    const { data: existing, error: findError } = await supabase
      .from('inventory')
      .select('*')
      .eq('nomenclature_id', item.id)
      .eq('type', 'bz');
      
    if (findError) {
      console.error(`Error finding inventory for ${item.name}:`, findError);
      continue;
    }
    
    if (existing && existing.length > 0) {
      for (const row of existing) {
        console.log(`  Updating inventory row ID: ${row.id} from ${row.total_qty} to ${item.qty}`);
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ total_qty: item.qty, updated_at: new Date().toISOString() })
          .eq('id', row.id);
          
        if (updateError) {
          console.error(`  Failed to update row ${row.id}:`, updateError);
        } else {
          console.log(`  Successfully updated row ${row.id}`);
        }
      }
    } else {
      console.log(`  No 'bz' inventory row found for ${item.name}. Creating one...`);
      const { error: insertError } = await supabase
        .from('inventory')
        .insert([{
          nomenclature_id: item.id,
          name: item.name,
          type: 'bz',
          warehouse: 'operational',
          unit: 'шт',
          total_qty: item.qty,
          reserved_qty: 0,
          updated_at: new Date().toISOString()
        }]);
        
      if (insertError) {
        console.error(`  Failed to insert inventory row for ${item.name}:`, insertError);
      } else {
        console.log(`  Successfully inserted inventory row for ${item.name}`);
      }
    }
  }
  
  console.log('\nUpdates completed.');
}

run();
