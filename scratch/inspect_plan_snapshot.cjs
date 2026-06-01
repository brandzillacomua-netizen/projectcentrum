const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  const taskIds = [
    '2e64fb03-4c2c-4ce5-b319-dc2e2314f6fa',
    'ece177e3-07c4-4e22-8e85-37698935d434',
    '81e570a6-92f6-4f1d-a030-d005d2460005'
  ];
  for (const tid of taskIds) {
    const res = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.${tid}`, { headers });
    const tasks = await res.json();
    console.log(`\n=== Task ${tid} (Batch ${tasks[0]?.batch_index}) ===`);
    console.log(JSON.stringify(tasks[0]?.plan_snapshot, null, 2));
  }
}

run().catch(console.error);
