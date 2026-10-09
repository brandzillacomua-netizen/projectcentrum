const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.hurzutjytlcvtbvihnry:Slavik14881488148@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
const run = async () => {
  await client.connect();
  const res = await client.query("UPDATE work_cards SET operation = 'Склад СГП', status = 'completed' WHERE operation ILIKE '%пак%' AND status IN ('new', 'waiting-machines', 'at-buffer') RETURNING id, operation, status;");
  console.log('Updated rows:', res.rowCount);
  await client.end();
};
run().catch(console.error);
