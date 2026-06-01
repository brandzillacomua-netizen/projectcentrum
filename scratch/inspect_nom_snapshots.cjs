const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

const taskIds = [
  '2e64fb03-4c2c-4ce5-b319-dc2e2314f6fa',
  'ece177e3-07c4-4e22-8e85-37698935d434',
  '81e570a6-92f6-4f1d-a030-d005d2460005'
];

const nomIds = {
  'В-3-45': '90c17a0c-2c69-485e-a2cf-ed10909c816d',
  'Н-3-50': 'dcef3b2e-de4d-4540-90a5-63ebcbab1545',
  'Х-2-63': '17908962-8294-4809-b80c-b906fbca25a4'
};

async function run() {
  for (const tid of taskIds) {
    const res = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.${tid}`, { headers });
    const tasks = await res.json();
    const task = tasks[0];
    console.log(`\n=== Task ${tid} (Batch ${task?.batch_index}) ===`);
    const snap = task?.plan_snapshot || {};
    for (const [name, nid] of Object.entries(nomIds)) {
      console.log(`${name}:`, snap[nid]);
    }
    console.log('arrivals:', snap.arrivals);
  }
}

run().catch(console.error);
