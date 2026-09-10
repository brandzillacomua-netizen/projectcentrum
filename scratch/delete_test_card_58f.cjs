const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://qpiysrkhvdgctaqmfsew.supabase.co';
const STAGING_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTcxMzUsImV4cCI6MjEwNDQ3MzEzNX0.Jvx-saMNE97zyy8IaXk9dd7C1q-quoK-R0IopUsVXI8';

async function main() {
  const client = createClient(STAGING_URL, STAGING_KEY);
  const { data: cards, error } = await client.from('work_cards').select('*');
  if (error) {
    console.error(error);
    return;
  }
  console.log(`STAGING Work Cards (${cards.length}):`);
  for (const c of cards) {
    console.log(`ID: ${c.id} | NomId: ${c.nomenclature_id} | Machine: ${c.machine} | Op: ${c.operation} | Status: ${c.status} | Info: ${c.card_info}`);
  }
}

main();
