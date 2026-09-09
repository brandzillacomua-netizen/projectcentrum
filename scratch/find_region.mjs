import pg from 'pg';

const regions = [
  'aws-0-eu-central-1',
  'aws-0-eu-west-1',
  'aws-0-eu-west-2',
  'aws-0-eu-west-3',
  'aws-0-eu-north-1',
  'aws-0-eu-south-1',
  'aws-0-us-east-1',
  'aws-0-us-east-2',
  'aws-0-us-west-1',
  'aws-0-ap-southeast-1',
  'aws-0-ap-northeast-1',
  'aws-0-ap-south-1',
  'aws-0-ca-central-1',
  'aws-0-sa-east-1'
];

async function check() {
  for (const r of regions) {
    const host = `${r}.pooler.supabase.com`;
    const client = new pg.Client({
      host,
      port: 6543,
      user: 'postgres.qpiysrkhvdgctaqmfsew',
      password: 'Centrum2026SecureTestDB!',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });
    try {
      await client.connect();
      console.log('SUCCESS! FOUND REGION:', r);
      await client.query('SELECT 1');
      await client.end();
      return r;
    } catch (e) {
      if (!e.message.includes('tenant/user') && !e.message.includes('ENOTFOUND')) {
        console.log(r, 'connected response:', e.message);
        return r;
      }
    }
  }
  console.log('Region not found in list');
}

check().catch(console.error);
