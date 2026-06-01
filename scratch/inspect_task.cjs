const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.4bc6d29f-2d75-438b-b8c0-6e1c99878e63', {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
.then(res => res.json())
.then(tasks => {
  console.log(JSON.stringify(tasks[0], null, 2));
})
.catch(err => console.error(err));
