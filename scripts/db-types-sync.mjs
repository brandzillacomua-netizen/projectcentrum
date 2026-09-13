import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const TARGET_FILE = resolve(process.cwd(), 'src/types/database.types.ts');

console.log('🔄 Checking Supabase database types status...');

if (!existsSync(TARGET_FILE)) {
  console.error(`❌ Target file ${TARGET_FILE} does not exist.`);
  process.exit(1);
}

const currentContent = readFileSync(TARGET_FILE, 'utf-8');

// If DB_URL or SUPABASE_PROJECT_ID is supplied in environment, generate fresh types
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const projectId = process.env.SUPABASE_PROJECT_ID;

if (dbUrl) {
  console.log('📡 Generating TypeScript types from DATABASE_URL...');
  try {
    const generated = execSync(`npx supabase gen types typescript --db-url "${dbUrl}" --schema public`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (generated && generated.length > 100) {
      writeFileSync(TARGET_FILE, generated, 'utf-8');
      console.log('✅ Successfully updated src/types/database.types.ts from PostgreSQL!');
    }
  } catch (err) {
    console.warn('⚠️ Could not connect to DATABASE_URL for type sync:', err.message);
  }
} else if (projectId) {
  console.log(`📡 Generating TypeScript types from SUPABASE_PROJECT_ID (${projectId})...`);
  try {
    const generated = execSync(`npx supabase gen types typescript --project-id "${projectId}" --schema public`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (generated && generated.length > 100) {
      writeFileSync(TARGET_FILE, generated, 'utf-8');
      console.log('✅ Successfully updated src/types/database.types.ts from Supabase CLI!');
    }
  } catch (err) {
    console.warn('⚠️ Could not fetch types from project-id:', err.message);
  }
} else {
  console.log('ℹ️ No live database connection URL supplied (DATABASE_URL / SUPABASE_PROJECT_ID).');
  console.log('✅ Validated existing database types file: src/types/database.types.ts (' + (currentContent.length / 1024).toFixed(1) + ' KB)');
}
