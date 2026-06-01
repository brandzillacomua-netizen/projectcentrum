const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/orders?status=neq.completed&status=neq.shipped&status=neq.cancelled&select=*,order_items(*)', {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
.then(res => res.json())
.then(orders => {
  console.log(`Found ${orders.length} active orders:`);
  orders.forEach(o => {
    console.log(`Order ID: ${o.id}, Num: ${o.order_num}, Customer: ${o.customer}, Status: ${o.status}`);
    if (o.order_items) {
      console.log(`  Items (${o.order_items.length}):`);
      o.order_items.forEach(it => {
        console.log(`    Nomenclature ID: ${it.nomenclature_id}, Qty: ${it.quantity}`);
      });
    } else {
      console.log(`  Nomenclature ID: ${o.nomenclature_id}, Qty: ${o.quantity}`);
    }
  });
})
.catch(err => console.error(err));
