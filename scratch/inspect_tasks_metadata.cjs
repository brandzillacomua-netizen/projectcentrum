const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function run() {
  const t1Res = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.4811515f-681a-4c62-a80e-d2f0a185e044`, { headers });
  const t1 = (await t1Res.json())[0];
  const nomId = '90c17a0c-2c69-485e-a2cf-ed10909c816d';
  console.log('Nom detail in Task 1 plan_snapshot:', t1.plan_snapshot[nomId]);
}

run().catch(console.error);
