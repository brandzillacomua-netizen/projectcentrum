const url = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/nomenclatures?type=eq.part&select=id,name,type';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

fetch(url, {
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log(`Found ${data.length} parts:`);
  console.log(JSON.stringify(data.slice(0, 30), null, 2));
})
.catch(err => console.error(err));
