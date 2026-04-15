const fetch = require('node-fetch');

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

fetch(url, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify(payload)
})
.then(res => res.json().then(data => ({ status: res.status, data })))
.then(res => console.log(JSON.stringify(res, null, 2)))
.catch(err => console.error(err));
