const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.hurzutjytlcvtbvihnry:Slavik14881488148@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
async function run() {
  await client.connect();
  const q3 = await client.query("SELECT * FROM vkya_restoration_cards WHERE quantity IN (700, 670, 1370) OR id IN (851, 852, 853)");
  console.log('Restoration items:', JSON.stringify(q3.rows, null, 2));
  await client.end();
}
run();
