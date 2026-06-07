const url = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/machines';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const payload = {
  name: "Debug Test RLS",
  sheet_capacity: 1,
  type: "Laser",
  status: "active",
  inventory_no: "DEB-999",
  floor: "1",
  description: "testing RLS blocking"
};

async function run() {
  console.log("--- TEST 1: Request WITHOUT secret header (should be blocked by RLS) ---");
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log("Data:", data);
  } catch (err) {
    console.error("Error in Test 1:", err);
  }

  console.log("\n--- TEST 2: Request WITH secret header (should succeed) ---");
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log("Data:", data);
  } catch (err) {
    console.error("Error in Test 2:", err);
  }
}

run();
