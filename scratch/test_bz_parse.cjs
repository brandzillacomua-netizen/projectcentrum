const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

const normalizeHomoglyphs = (str) => {
  if (!str) return ''
  const mapper = {
    'а': 'a', 'в': 'v', 'с': 'c', 'е': 'e', 'н': 'h', 'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x', 'у': 'y', 'і': 'i', 'ї': 'i', 'є': 'e',
    'А': 'a', 'В': 'v', 'С': 'c', 'Е': 'e', 'Н': 'h', 'К': 'k', 'М': 'm', 'О': 'o', 'Р': 'p', 'Т': 't', 'Х': 'x', 'У': 'y', 'І': 'i', 'Ї': 'i', 'Є': 'e'
  }
  return str.toLowerCase().trim().split('').map(c => mapper[c] || c).join('').replace(/[^a-z0-9]/g, '')
}

async function test() {
  try {
    const { data: nomenclatures, error: nomErr } = await supabase.from('nomenclatures').select('*');
    if (nomErr) throw nomErr;
    const { data: bomItems, error: bomErr } = await supabase.from('bom_items').select('*');
    if (bomErr) throw bomErr;
    
    const text = fs.readFileSync('a:\\centrum\\Залишки сировини актуалка - Аркуш1 (1).csv', 'utf-8');
    
    // parseCSV simulation
    const lines = []
    let row = ['']
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const nextChar = text[i + 1]
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"'; i++
        } else { inQuotes = !inQuotes }
      } else if (char === ',' && !inQuotes) {
        row.push('')
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++
        lines.push(row.map(cell => cell.trim()))
        row = ['']
      } else {
        row[row.length - 1] += char
      }
    }
    if (row.length > 1 || row[0] !== '') lines.push(row.map(cell => cell.trim()))
    
    const headers = lines[0];
    console.log('Headers:', headers);
    
    const nameColIdx = headers.findIndex(h => {
      const norm = h.toLowerCase().trim()
      return norm.includes('номенклатура') || norm.includes('назва') || norm === 'name'
    })
    const qtyColIdx = headers.findIndex(h => {
      const norm = h.toLowerCase().trim()
      return norm.includes('склад') || norm.includes('кількість') || norm === 'qty' || norm === 'quantity'
    })
    
    console.log('nameColIdx:', nameColIdx, 'qtyColIdx:', qtyColIdx);
    
    const parsedRows = lines.slice(1);
    const matchedItems = [];
    const unrecognized = [];
    
    const dbNomMap = {};
    nomenclatures.forEach(n => {
      dbNomMap[normalizeHomoglyphs(n.name)] = n;
    });
    
    parsedRows.forEach((r, idx) => {
      const nameVal = r[nameColIdx];
      const qtyVal = parseInt(r[qtyColIdx]) || 0;
      if (!nameVal || qtyVal <= 0) return;
      const normName = normalizeHomoglyphs(nameVal);
      const matchedNom = dbNomMap[normName];
      if (matchedNom) {
        matchedItems.push({ name: matchedNom.name, qty: qtyVal });
      } else {
        unrecognized.push({ name: nameVal, qty: qtyVal });
      }
    });
    
    console.log('Matched items count:', matchedItems.length);
    console.log('Unrecognized count:', unrecognized.length);
    if (unrecognized.length > 0) {
      console.log('Sample unrecognized:', unrecognized.slice(0, 3));
    }
  } catch (e) {
    console.error(e);
  }
}
test();
