/**
 * use_refactor_as_main.cjs
 * Copies the fixed NomenclatureCardModalRefactor/index.jsx to NomenclatureCardModal/index.jsx
 * but fixes the supabase import path (4 levels up instead of 3).
 */
const fs = require('fs');

const SRC = 'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModalRefactor\\index.jsx';
const DST = 'A:\\centrum\\src\\modules\\Nomenclature\\components\\NomenclatureCardModal\\index.jsx';

let content = fs.readFileSync(SRC, 'utf8');

// Fix supabase path: Refactor is at components/NomenclatureCardModalRefactor/ = 3 levels up from src
// CardModal is at components/NomenclatureCardModal/ = same depth, same path
// Both are under src/modules/Nomenclature/components/[Folder]/
// So '../../../supabase' should be correct for both. But the Refactor file also has '../../../supabase'
// Let's verify what path is in the file.
console.log('Supabase import in source:', content.match(/from '[^']*supabase[^']*'/)?.[0]);

// Both folders are at the same depth, so path is the same - just write as-is
fs.writeFileSync(DST, content, 'utf8');
console.log('Done! Copied Refactor index.jsx to CardModal index.jsx');
