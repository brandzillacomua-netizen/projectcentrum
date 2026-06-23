const url = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/company_positions?select=*';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

async function test() {
  console.log('Sending fetch request...');
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 200));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();
