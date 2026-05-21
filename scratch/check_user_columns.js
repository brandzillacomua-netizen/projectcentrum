const baseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

async function run() {
  try {
    const res = await fetch(`${baseUrl}system_users?limit=1`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const data = await res.json();
    console.log("system_user columns:", Object.keys(data[0] || {}));
    console.log("Sample system_user record:", data[0]);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
