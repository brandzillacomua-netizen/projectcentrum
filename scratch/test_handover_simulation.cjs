const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  const cardId = '3b258fcb-76d9-4938-a980-e365e2bbcc67';
  
  // 1. Fetch card
  const cardRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?id=eq.${cardId}`, { headers });
  const cards = await cardRes.json();
  const card = cards[0];
  console.log('Card:', card);

  const nomId = card.nomenclature_id;
  const totalQty = Number(card.quantity) || 0;
  const isRework = card.card_info?.includes('[REWORK]') || card.operation === 'Доопрацювання' || card.card_info?.includes('Автоматично з Сортування');
  console.log('isRework:', isRework);

  // 2. Fetch task
  let plannedNeed = 0;
  if (card.task_id) {
    const tRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?id=eq.${card.task_id}`, { headers });
    const tasks = await tRes.json();
    const task = tasks[0];
    if (task && task.plan_snapshot) {
      const snap = task.plan_snapshot;
      plannedNeed = Number(snap[String(nomId)]?.need) || 0;
      if (!plannedNeed && snap.arrivals) {
        const arrVal = snap.arrivals.find(a => String(a.id) === String(nomId));
        if (arrVal) plannedNeed = Number(arrVal.semi) || 0;
      }
    }
  }
  console.log('plannedNeed:', plannedNeed);

  // 3. Fetch sibling cards
  const sibRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?task_id=eq.${card.task_id}&nomenclature_id=eq.${nomId}&status=eq.completed`, { headers });
  const siblingCards = await sibRes.json();
  console.log('Sibling completed cards:', siblingCards);

  let siblingFinishedSum = 0;
  for (const sib of (siblingCards || [])) {
    if (sib.id === cardId) continue;
    const sibTotal = Number(sib.quantity) || 0;
    const sibBzTotal = Number(sib.card_info?.match(/\[BZ:(\d+)\]/)?.[1]) || 0;
    const sibNeedQty = Number(sib.card_info?.match(/\[NEED:(\d+)\]/)?.[1]) || (Math.max(0, sibTotal - sibBzTotal));
    const sibIsRework = sib.card_info?.includes('[REWORK]') || sib.operation === 'Доопрацювання' || sib.card_info?.includes('Автоматично з Сортування');
    const sibFinished = sibIsRework ? 0 : Math.min(sibTotal, sibNeedQty);
    siblingFinishedSum += sibFinished;
    console.log(`Sibling ${sib.id}: total=${sibTotal}, bz=${sibBzTotal}, need=${sibNeedQty}, isRework=${sibIsRework}, finished=${sibFinished}`);
  }
  console.log('siblingFinishedSum:', siblingFinishedSum);

  const remainingNeed = Math.max(0, plannedNeed - siblingFinishedSum);
  const finishedQty = Math.min(totalQty, remainingNeed);
  const actualBzQty = Math.max(0, totalQty - finishedQty);
  console.log('remainingNeed:', remainingNeed, 'finishedQty:', finishedQty, 'actualBzQty:', actualBzQty);

  // 4. Fetch existing inventory
  const nomName = card.card_info?.split('\n')[0]?.trim();
  const typesToFetch = ['semi_shop2', 'bz_shop2', 'finished', 'bz'];
  const orFilters = [];
  if (nomId) orFilters.push(`nomenclature_id.eq.${nomId}`);
  if (nomName) orFilters.push(`name.eq."${nomName.replace(/"/g, '""')}"`);

  let url = `https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/inventory?type=in.(${typesToFetch.map(t => `"${t}"`).join(',')})`;
  if (orFilters.length > 0) {
    url += `&or=(${encodeURIComponent(orFilters.join(','))})`;
  }
  const invRes = await fetch(url, { headers });
  const existingInv = await invRes.json();
  console.log('existingInv:', existingInv);

  const updates = [];
  if (!isRework && finishedQty > 0) {
    let remainingNeedQty = finishedQty;
    const s2SemiRows = existingInv?.filter(i => (nomId && String(i.nomenclature_id) === String(nomId) || i.name === nomName) && i.type === 'semi_shop2') || [];
    console.log('s2SemiRows:', s2SemiRows);
    for (const r of s2SemiRows) {
      const current = Number(r.total_qty) || 0;
      const take = Math.min(current, remainingNeedQty);
      if (take > 0) {
        updates.push({ ...r, total_qty: current - take });
        remainingNeedQty -= take;
      }
      console.log(`Deducting semi_shop2: current=${current}, remainingNeedQty=${remainingNeedQty}, take=${take}`);
      if (remainingNeedQty <= 0) break;
    }
  }
  console.log('Pending updates:', updates);
}

run().catch(console.error);
