const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  const code = fs.readFileSync('src/supabase.js', 'utf8');
  const urlMatch = code.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
  const keyMatch = code.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);
  if(urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);
    const { data: cards, error: err1 } = await supabase.from('work_cards')
      .select('id, operation, completed_at, quantity')
      .ilike('operation', '%Пак%')
      .eq('status', 'completed')
      .gte('completed_at', '2026-10-06T00:00:00Z')
      .lte('completed_at', '2026-10-07T23:59:59Z');
      
    console.log('Cards to SGP on Oct 6-7:', cards?.length || 0);
    if (cards && cards.length > 0) {
       console.log(cards.map(c => `ID: ${c.id}, Op: ${c.operation}, Date: ${c.completed_at}`).join('\n'));
    }
    if(err1) console.error(err1);
  }
}
run();
