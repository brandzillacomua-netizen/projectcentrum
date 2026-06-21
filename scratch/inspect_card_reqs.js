global.window = {
  myConfirmedWrites: new Set()
};

const run = async () => {
  const { supabase } = await import('../src/supabase.js');

  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .ilike('name', '%лист%');
  
  if (error) {
    console.error(error);
  } else {
    console.log('List of sheet inventory items:');
    data.forEach(i => {
      console.log(`- ID: ${i.id}, Name: "${i.name}", Wh: ${i.warehouse}, NomID: ${i.nomenclature_id}, Total: ${i.total_qty}, Res: ${i.reserved_qty}`);
    });
  }
};

run();
