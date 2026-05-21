const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const parseSpecCSV = (text) => {
  const cleanedText = text.replace(/"([^"]*)"/g, (m, p1) => `"${p1.replace(/\r?\n/g, ' ')}"`);
  const lines = cleanedText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return null;
  
  const result = { components: [] };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
    
    const isGroupHeader = cols[0] && isNaN(parseInt(cols[0])) && cols.slice(1).every(c => !c || c === '');
    if (isGroupHeader) continue;

    const indexNum = parseInt(cols[0]);
    if (!isNaN(indexNum) && cols[1]) {
      const nomName = cols[1];
      const characteristics = cols[2] || '';
      const qty = parseFloat(cols[4]) || 1;
      
      const fullName = characteristics ? `${nomName} ${characteristics}`.trim() : nomName.trim();
      
      result.components.push({
        name: fullName,
        qty: qty
      });
    }
  }
  return result;
}

async function fixQtys() {
  const dirPath = 'a:/centrum';
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.csv'));
  
  const componentQtys = new Map();
  
  for (const file of files) {
    const text = fs.readFileSync(path.join(dirPath, file), 'utf8');
    const parsed = parseSpecCSV(text);
    if (parsed) {
      for (const comp of parsed.components) {
        componentQtys.set(comp.name.toLowerCase(), comp.qty);
      }
    }
  }

  console.log(`Found ${componentQtys.size} unique components with quantities in CSV files.`);
  
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const { data: bom } = await supabase.from('bom_items').select('*');
  
  let updatedCount = 0;
  
  for (const b of bom) {
    const childNom = noms.find(n => n.id === b.child_id);
    if (!childNom) continue;
    
    const childNameLower = childNom.name.toLowerCase();
    
    if (componentQtys.has(childNameLower)) {
      const targetQty = componentQtys.get(childNameLower);
      if (b.quantity_per_parent !== targetQty) {
        console.log(`Updating ${childNom.name} qty: ${b.quantity_per_parent} -> ${targetQty}`);
        const { error } = await supabase.from('bom_items').update({ quantity_per_parent: targetQty }).eq('id', b.id);
        if (error) {
          console.error(`Failed to update ${childNom.name}:`, error.message);
        } else {
          updatedCount++;
        }
      }
    }
  }
  
  console.log(`Successfully updated quantities for ${updatedCount} BOM items.`);
}

fixQtys();
