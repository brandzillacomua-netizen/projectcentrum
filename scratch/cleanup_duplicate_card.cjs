const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const cardId = '3fefa8ef-937e-4c45-9312-71b87e2668bc';

async function cleanup() {
  // Check if there is history for this card
  const histRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_card_history?card_id=eq.${cardId}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const history = await histRes.json();
  console.log(`History count for duplicate card: ${history.length}`);
  if (history.length > 0) {
    console.log('History data:', JSON.stringify(history, null, 2));
  }

  // Delete the card
  console.log(`Deleting duplicate card ${cardId}...`);
  const delRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${cardId}`, {
    method: 'DELETE',
    headers: { 
      'apikey': key, 
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  console.log(`Delete response status: ${delRes.status}`);
}

cleanup();
