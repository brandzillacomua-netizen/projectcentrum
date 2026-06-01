const url = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/material_requests';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const payload = [
  {
    id: "465f2e3a-3ea6-412c-8dd3-1cae9a280d08",
    status: "completed",
    inventory_id: "d4dd1285-78fd-4169-9f6e-5baa4398a129"
  }
];

fetch(url, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  },
  body: JSON.stringify(payload)
})
.then(res => {
  console.log('Status code:', res.status);
  return res.text();
})
.then(text => console.log('Response:', text))
.catch(err => console.error(err));
