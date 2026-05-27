const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWarehouses() {
  const { data, error } = await supabase.from('inventory').select('warehouse, type');
  if (error) {
    console.error(error);
    return;
  }
  const warehouses = {};
  const types = {};
  data.forEach(item => {
    warehouses[item.warehouse] = (warehouses[item.warehouse] || 0) + 1;
    types[item.type] = (types[item.type] || 0) + 1;
  });
  console.log('Warehouses in inventory table:', warehouses);
  console.log('Types in inventory table:', types);
}

checkWarehouses();
