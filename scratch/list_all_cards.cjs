const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

async function listCards() {
  const taskId = '4bc6d29f-2d75-438b-b8c0-6e1c99878e63';
  const url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?task_id=eq.${taskId}`;
  const res = await fetch(url, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const cards = await res.json();
  
  const nomRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/nomenclatures?select=id,name', {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const noms = await nomRes.json();
  const nomMap = noms.reduce((acc, n) => {
    acc[n.id] = n.name;
    return acc;
  }, {});

  const mapped = cards.map(c => ({
    id: c.id,
    nomenclature_name: nomMap[c.nomenclature_id] || 'unknown',
    operation: c.operation,
    quantity: c.quantity,
    status: c.status,
    card_info: c.card_info,
    created_at: c.created_at
  }));
  console.log(JSON.stringify(mapped, null, 2));
}

listCards();
