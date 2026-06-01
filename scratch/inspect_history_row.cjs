const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  const ids = [
    '389b2942-1d2a-4b1a-9c79-298278ffa7be', // H-3-50 card 3b258fcb-76d9-4938-a980-e365e2bbcc67 completion
    'db99005c-17dd-4544-b60d-fbe6f1ca2a0e'  // H-3-50 card 174cf47f-e7e6-41cf-8460-dafb03b9ff2f completion
  ];
  for (const id of ids) {
    const res = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_card_history?id=eq.${id}`, { headers });
    const rows = await res.json();
    console.log(`\n=== History Row ${id} ===`);
    console.log(JSON.stringify(rows[0], null, 2));
  }
}

run().catch(console.error);
