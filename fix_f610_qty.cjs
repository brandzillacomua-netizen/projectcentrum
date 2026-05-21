const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixSpecificQty() {
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const part = noms.find(n => n.name === 'F610-ІП24-П-7-35');
  const parent = noms.find(n => n.name === 'Рама (інд.проект 24), F610, Київ К');
  
  if (part && parent) {
    console.log(`Found part: ${part.name} and parent: ${parent.name}`);
    
    const { data: bomItem, error: fetchErr } = await supabase.from('bom_items')
      .select('*')
      .eq('parent_id', parent.id)
      .eq('child_id', part.id)
      .single();
      
    if (bomItem) {
      console.log(`Current qty: ${bomItem.quantity_per_parent}. Updating to 6...`);
      const { error: upErr } = await supabase.from('bom_items')
        .update({ quantity_per_parent: 6 })
        .eq('id', bomItem.id);
        
      if (upErr) console.error("Update error:", upErr);
      else console.log("Successfully updated to 6!");
    } else {
      console.log("BOM link not found. Need to insert...");
      const { error: insErr } = await supabase.from('bom_items')
        .insert([{ parent_id: parent.id, child_id: part.id, quantity_per_parent: 6 }]);
      if (insErr) console.error("Insert error:", insErr);
      else console.log("Successfully inserted with qty 6!");
    }
  } else {
    console.log("Could not find part or parent by name.");
  }
}

fixSpecificQty();
