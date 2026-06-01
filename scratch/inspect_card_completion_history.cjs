const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  const cardId = '2af808d7-ae60-4455-9830-1e6beb591a51'; // В-3-45 completed card
  
  // Fetch history for this card
  const histRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_card_history?card_id=eq.${cardId}`, { headers });
  const history = await histRes.json();
  console.log('=== CARD HISTORY ===');
  console.log(JSON.stringify(history, null, 2));
}

run().catch(console.error);
