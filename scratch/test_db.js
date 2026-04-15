const url = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/machines';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const payload = {
  name: "Debug Test",
  sheet_capacity: 1,
  type: "Laser",
  status: "active",
  inventory_no: "DEB-001",
  floor: "1",
  description: "debug"
};

async function test() {
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
    console.log(JSON.stringify({ status: res.status, data }, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err.message);
  }
}

test();
