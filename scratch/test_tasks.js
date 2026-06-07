const url = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?select=*&limit=1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

async function run() {
  console.log("--- SELECT tasks WITHOUT header ---");
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log("Data count:", data.length);
  } catch (err) {
    console.error("Error:", err);
  }

  console.log("\n--- SELECT tasks WITH header ---");
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log("Data count:", data.length);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
