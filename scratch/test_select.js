const url = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/machines?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

async function run() {
  console.log("--- SELECT WITHOUT header ---");
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
    if (data.length > 0) {
      console.log("First item:", data[0]);
    }
  } catch (err) {
    console.error("Error:", err);
  }

  console.log("\n--- SELECT WITH header ---");
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
    if (data.length > 0) {
      console.log("First item:", data[0]);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
