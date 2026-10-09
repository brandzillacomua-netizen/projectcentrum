import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
// Using PROD_ANON_KEY which has RLS. Wait, I can't update using anon key if RLS restricts it!
// Let's use the local .env VITE_SUPABASE_ANON_KEY (Wait, anon key can update if the user has auth or if RLS allows it).
// Actually, it's better to provide a SQL snippet for the user to run in Supabase SQL Editor?
// But wait, what if I can get a Service Role Key from .env or just do search-and-replace on files.

// I will do file replacement first!
function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('Паквання') || content.includes('паквання')) {
        content = content.replace(/Паквання/g, 'Пакування');
        content = content.replace(/паквання/g, 'пакування');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed:', fullPath);
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'src'));
