const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const orderId = '9df3ef35-491f-4e8b-af52-2a6cc410f553';

fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?order_id=eq.${orderId}`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
.then(res => res.json())
.then(tasks => {
  console.log('Total tasks for order:', tasks.length);
  tasks.forEach(t => {
    console.log(`Task ID: ${t.id}`);
    console.log(`  Step: ${t.step}`);
    console.log(`  Status: ${t.status}`);
    console.log(`  Planned Sets: ${t.planned_sets}`);
    console.log(`  Batch Index: ${t.batch_index}`);
    console.log(`  Metadata:`, JSON.stringify(t.plan_snapshot?._metadata || {}, null, 2));
  });
})
.catch(err => console.error(err));
