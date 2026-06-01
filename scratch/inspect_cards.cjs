const url = 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?select=id,task_id,order_id,nomenclature_id,operation,quantity,status,card_info,created_at';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/orders?order_num=eq.№29052026-07', {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
.then(res => res.json())
.then(orders => {
  if (orders.length === 0) {
    console.log('Order not found');
    return;
  }
  const orderId = orders[0].id;
  console.log(`Matched Order ID: ${orderId}`);

  // Fetch all tasks for this order to find task IDs
  fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?order_id=eq.${orderId}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
  .then(res => res.json())
  .then(tasks => {
    console.log('Tasks:', tasks.map(t => ({ id: t.id, step: t.step, status: t.status, batch: t.batch_index })));

    // Fetch work cards
    fetch(`${url}&order_id=eq.${orderId}`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
    .then(res => res.json())
    .then(cards => {
      // Fetch nomenclatures to map names
      fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/nomenclatures?select=id,name', {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      })
      .then(res => res.json())
      .then(noms => {
        const nomMap = noms.reduce((acc, n) => {
          acc[n.id] = n.name;
          return acc;
        }, {});

        const mapped = cards.map(c => ({
          ...c,
          nomenclature_name: nomMap[c.nomenclature_id] || 'unknown'
        }));
        console.log(JSON.stringify(mapped, null, 2));
      });
    });
  });
})
.catch(err => console.error(err));
