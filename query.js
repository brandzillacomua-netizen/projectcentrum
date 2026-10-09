const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.hurzutjytlcvtbvihnry:Slavik14881488148@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
async function run() {
  await client.connect();
  let res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%vkya%'");
  console.log("Tables:", res.rows);
  
  // also let's just query vkya_classification_queue_projection to see what it is
  res = await client.query("SELECT * FROM vkya_classification_queue_projection LIMIT 10");
  console.log("vkya_classification_queue_projection:", res.rows);
  
  await client.end();
}
run();
